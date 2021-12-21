import json
import multiprocessing
import sys
import traceback
from typing import Optional, Awaitable

import joblib
import numpy as np
import pandas as pd
import tornado.web
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from sklearn.pipeline import Pipeline

from xautoml.config_similarity import ConfigSimilarity
from xautoml.hp_importance import HPImportance
from xautoml.model_details import ModelDetails, LimeResult, DecisionTreeResult
from xautoml.output import OutputCalculator, DESCRIPTION, COMPLETE
from xautoml.roc_auc import RocCurve
from xautoml.util import pipeline_utils
from xautoml.util.async_queue import AsyncProcessQueue
from xautoml.util.constants import SOURCE, SINK


class ChildTaskException(Exception):
    pass


class BaseHandler(APIHandler):
    is_async = False
    MAX_SAMPLES = 5000

    def data_received(self, chunk: bytes) -> Optional[Awaitable[None]]:
        pass

    @tornado.web.authenticated
    async def post(self):
        model = self.get_json_body()

        if model is not None:
            try:
                if self.is_async:
                    await self._process_async(model)
                else:
                    self._process_post(model)
            except FileNotFoundError as ex:
                self.log.exception(ex)
                self.set_status(500)
                await self.finish({'name': type(ex).__name__, 'message': '{} can not be read'.format(ex.filename)})
            except Exception as ex:
                self.log.exception(ex)
                self.set_status(500)
                await self.finish({'name': type(ex).__name__, 'message': 'Unhandled exception {}'.format(ex)})
        else:
            self.set_status(400)
            await self.finish({'name': type(KeyError).__name__, 'message': 'Excepted a model parameter in request'})

    def _process_post(self, model):
        pass

    @staticmethod
    def _process_post_async(model, queue):
        pass

    async def _process_async(self, model):
        def exception_safe(model, queue, func):
            try:
                func(model, q)
            except Exception:
                error_type, error, tb = sys.exc_info()
                error_lines = traceback.format_exception(error_type, error, tb)
                error_msg = ''.join(error_lines)
                queue.put(ChildTaskException(error_msg))

        q = AsyncProcessQueue()
        p = multiprocessing.Process(target=exception_safe, args=(model, q, self._process_post_async))
        p.start()

        res = await q.coro_get()
        p.join()
        if isinstance(res, Exception):
            raise res
        await self.finish(res)

    @staticmethod
    def fixed_precision(func, precision: int = 3):
        def wrapper(*args, **kwargs):
            with pd.option_context('display.precision', precision):
                return func(*args, **kwargs)

        return wrapper

    @staticmethod
    def limited_entries(func, max_columns: int = 30, max_rows: int = 10):
        def wrapper(*args, **kwargs):
            with pd.option_context('display.max_columns', max_columns, 'display.max_rows', max_rows):
                return func(*args, **kwargs)

        return wrapper

    @staticmethod
    def load_models(model, n_samples: int = MAX_SAMPLES) -> tuple[pd.DataFrame, pd.Series, list[Pipeline], bool]:
        data_file = model.get('data_file')
        model_files = model.get('model_files').split(',')

        with open(data_file, 'rb') as f:
            X, y, feature_labels = joblib.load(f)

        models = []
        for model_file in model_files:
            try:
                with open(model_file, 'rb') as f:
                    models.append(joblib.load(f))
            except FileNotFoundError:
                # Failed configurations do not have a model file
                pass

        X = pd.DataFrame(X, columns=feature_labels).convert_dtypes()
        y = pd.Series(y)

        downsample = X.shape[0] > n_samples
        if downsample:
            idx = np.random.choice(X.shape[0], size=n_samples, replace=False)
            X = X.loc[idx, :].reset_index(drop=True)
            y = y.loc[idx].reset_index(drop=True)

        return X, y, models, downsample

    @staticmethod
    def load_model(model, n_samples: int = MAX_SAMPLES) -> tuple[pd.DataFrame, pd.Series, Pipeline, bool]:
        X, y, models, downsampled = BaseHandler.load_models(model, n_samples=n_samples)
        if len(models) == 0:
            raise ValueError('Unable to use failed pipeline to evaluate model.')

        assert len(models) == 1, 'Expected exactly 1 model, got {}'.format(len(models))
        pipeline = models[0]
        return X, y, pipeline, downsampled

    def _get_intermediate_output(self, X, y, model, method):
        df_handler = OutputCalculator()
        try:
            _, outputs = df_handler.calculate_outputs(model, X, y, method=method)
            return outputs
        except ValueError as ex:
            self.log.error('Failed to calculate intermediate dataframes', exc_info=ex)


class OutputHandler(BaseHandler):

    def _calculate_output(self, model, method):
        X, y, pipeline, downsampled = self.load_model(model)
        steps = self._get_intermediate_output(X, y, pipeline, method=method)
        self.finish(json.dumps({'data': steps, 'downsampled': downsampled}))


class OutputDescriptionHandler(OutputHandler):

    @BaseHandler.fixed_precision
    def _process_post(self, model):
        with pd.option_context('display.max_columns', 30, 'display.max_rows', 10):
            self._calculate_output(model, DESCRIPTION)


class OutputCompleteHandler(OutputHandler):

    @BaseHandler.fixed_precision
    def _process_post(self, model):
        with pd.option_context('display.max_columns', 1024, 'display.max_rows', 30, 'display.min_rows', 20):
            self._calculate_output(model, COMPLETE)


class RocCurveHandler(BaseHandler):

    def _process_post(self, model):
        micro = model.get('micro', False)
        macro = model.get('macro', True)
        max_samples = model.get('sample_rate', 50)
        cids = model.get('cids').split(',')
        X, y, models, _ = self.load_models(model)

        result = {}
        for cid, pipeline in zip(cids, models):
            try:
                roc = RocCurve(micro=micro, macro=macro)
                roc.score(pipeline, X, y)

                # Transform into format suited for recharts
                for fpr, tpr, label in roc.get_data(cid):
                    ls = []

                    sample_rate = max(1, len(fpr) // max_samples)
                    for f, t in zip(fpr[::sample_rate], tpr[::sample_rate]):
                        ls.append({'x': f, 'y': t})
                    result[label] = ls
            except ValueError as ex:
                self.log.error('Failed to calculate ROC for {}'.format(cid), exc_info=ex)
        self.finish(json.dumps(result))


class LimeHandler(BaseHandler):
    # TODO should be async

    def _process_post(self, model):
        X, y, pipeline, _ = BaseHandler.load_model(model)
        idx = model.get('idx', 0)
        step = model.get('step', SOURCE)

        if step == pipeline.steps[-1][0] or step == SINK:
            res = LimeResult(idx, {}, {}, getattr(y[idx], "tolist", lambda: y[idx])())
            additional_features = False
        else:
            pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
            details = ModelDetails()
            try:
                res = details.calculate_lime(X, y, pipeline, idx)
            except TypeError:
                res = LimeResult(idx, {}, {}, getattr(y[idx], "tolist", lambda: y[idx])(), categorical_input=True)

        self.finish(json.dumps(res.to_dict(additional_features)))


class ConfusionMatrixHandler(BaseHandler):

    def _process_post(self, model):
        X, y, pipeline, _ = self.load_model(model)
        details = ModelDetails()
        cm = details.calculate_performance_data(X, y, pipeline, model['metric'])
        self.finish(json.dumps(cm))


class DecisionTreeHandler(BaseHandler):

    def _process_post(self, model):
        X, y, pipeline, downsampled = self.load_model(model)
        step = model.get('step', SOURCE)
        max_leaf_nodes = model.get('max_leaf_nodes', None)

        if step == pipeline.steps[-1][0] or step == SINK:
            self.log.debug('Unable to calculate decision tree on predictions')
            res = DecisionTreeResult(pipeline_utils.Node('empty', []), 0, 0, 0, 2)
            additional_features = False
        else:
            pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
            details = ModelDetails()
            res = details.calculate_decision_tree(X, pipeline, max_leaf_nodes=max_leaf_nodes)

        self.finish(json.dumps(res.as_dict(additional_features, downsampled)))


class FeatureImportanceHandler(BaseHandler):
    # TODO should be async

    def _process_post(self, model):
        X, y, pipeline, downsampled = FeatureImportanceHandler.load_model(model)
        step = model.get('step', SOURCE)

        if step == pipeline.steps[-1][0] or step == SINK:
            res = pd.DataFrame(data={'0': {'0': 1, '1': 0}})
            additional_features = []
        else:
            pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
            details = ModelDetails()
            res = details.calculate_feature_importance(X, y, pipeline)
        self.finish(json.dumps({'data': res.to_dict(), 'additional_features': additional_features, 'downsampled': downsampled}))


class FANOVAHandler(BaseHandler):

    def _process_post(self, model):
        step = model.get('step', None)
        f, X = HPImportance.load_model(model)

        if X.shape[0] < 2:
            self.finish(json.dumps({
                'error': 'Not enough evaluated configurations to calculate hyperparameter importance.'
            }))
            return

        overview = HPImportance.calculate_fanova_overview(f, X, step=step)
        details = HPImportance.calculate_fanova_details(f, X)

        self.finish(json.dumps({'overview': overview, 'details': details}))


class SimulatedSurrogate(BaseHandler):

    def _process_post(self, model):
        try:
            f, X = HPImportance.load_model(model)
            explanations = HPImportance.simulate_surrogate(f, X)
            self.finish(json.dumps(explanations))
        except IndexError:
            raise ValueError('Unable to simulate surrogate model without trainings data')


class ConfigSimilarityHandler(BaseHandler):

    def _process_post(self, model):
        res = ConfigSimilarity.compute(model)
        self.finish(json.dumps(res))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    handlers = [
        (url_path_join(base_url, 'xautoml', 'output/complete'), OutputCompleteHandler),
        (url_path_join(base_url, 'xautoml', 'output/description'), OutputDescriptionHandler),
        (url_path_join(base_url, 'xautoml', 'roc_auc'), RocCurveHandler),
        (url_path_join(base_url, 'xautoml', 'confusion_matrix'), ConfusionMatrixHandler),
        (url_path_join(base_url, 'xautoml', 'explanations/lime'), LimeHandler),
        (url_path_join(base_url, 'xautoml', 'explanations/feature_importance'), FeatureImportanceHandler),
        (url_path_join(base_url, 'xautoml', 'explanations/dt'), DecisionTreeHandler),
        (url_path_join(base_url, 'xautoml', 'hyperparameters/fanova'), FANOVAHandler),
        (url_path_join(base_url, 'xautoml', 'surrogate/simulate'), SimulatedSurrogate),
        (url_path_join(base_url, 'xautoml', 'config_similarity'), ConfigSimilarityHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)
