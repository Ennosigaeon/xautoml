import json
import multiprocessing
import os
from typing import Optional, Awaitable

import joblib
import numpy as np
import pandas as pd
import tornado.web
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from xautoml.model_details import ModelDetails, LimeResult, DecisionTreeResult
from xautoml.output import OutputCalculator, DESCRIPTION, COMPLETE
from xautoml.roc_auc import RocCurve
from xautoml.util import internal_cid_name, pipeline_utils
from xautoml.util.async_queue import AsyncProcessQueue
from xautoml.util.constants import SOURCE, SINK


class BaseHandler(APIHandler):
    is_async = False

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
            except Exception as ex:
                queue.put(ex)

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
    def load_models(model) -> tuple[np.ndarray, np.ndarray, list[str], dict[str, any]]:
        cids: list[str] = model.get('cids').split(',')
        data_file = model.get('data_file')
        model_dir = model.get('model_dir')

        with open(data_file, 'rb') as f:
            X, y, feature_labels = joblib.load(f)

            model_names = map(lambda cid: os.path.join(model_dir, 'models_{}.pkl'.format(
                internal_cid_name(cid).replace(":", "-"))), cids)

        models = {}
        for model_file, cid in zip(model_names, cids):
            try:
                with open(model_file, 'rb') as f:
                    models[cid] = joblib.load(f)
            except FileNotFoundError:
                # Failed configurations do not have a model file
                pass

        return X, y, feature_labels, models

    @staticmethod
    def load_model(model):
        X, y, feature_labels, models = BaseHandler.load_models(model)
        assert len(models) == 1, 'Expected exactly 1 model, got {}'.format(len(models))
        pipeline = models.popitem()[1]
        return X, y, feature_labels, pipeline

    def _get_intermediate_output(self, X, label, model, method):
        df_handler = OutputCalculator()
        try:
            steps = df_handler.calculate_outputs(model, X, label, method=method)
            return steps
        except ValueError as ex:
            self.log.error('Failed to calculate intermediate dataframes', exc_info=ex)


class OutputHandler(BaseHandler):

    def _calculate_output(self, model, method):
        X, y, feature_labels, pipeline = self.load_model(model)
        steps = self._get_intermediate_output(X, feature_labels, pipeline, method=method)
        self.finish(json.dumps(steps))


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
        X, y, _, models = self.load_models(model)

        result = {}
        for cid, pipeline in models.items():
            try:
                roc = RocCurve(micro=micro, macro=macro)
                roc.score(pipeline, X, y, json=True)

                # Transform into format suited for recharts
                for fpr, tpr, label in roc.get_data(cid):
                    ls = []
                    for f, t in zip(fpr, tpr):
                        ls.append({'x': f, 'y': t})
                    result[label] = ls
            except ValueError as ex:
                self.log.error('Failed to calculate ROC for {}'.format(cid), exc_info=ex)
        self.finish(json.dumps(result))


class LimeHandler(BaseHandler):
    is_async = True

    @staticmethod
    def _process_post_async(model, queue):
        X, y, feature_labels, pipeline = BaseHandler.load_model(model)
        idx = model.get('idx', None)
        step = model.get('step', SOURCE)

        if step == pipeline.steps[-1][0] or step == SINK:
            res = LimeResult(idx, {}, {}, y[idx].tolist())
        else:
            pipeline, X, feature_labels = pipeline_utils.get_subpipeline(pipeline, step, X, feature_labels)
            details = ModelDetails()
            res = details.calculate_lime(X, y, pipeline, feature_labels, idx)

        queue.put(res.to_dict())


class DecisionTreeHandler(BaseHandler):

    def _process_post(self, model):
        X, y, feature_labels, pipeline = self.load_model(model)
        step = model.get('step', SOURCE)
        max_leaf_nodes = model.get('max_leaf_nodes', 10)

        if step == pipeline.steps[-1][0] or step == SINK:
            self.log.debug('Unable to calculate LIME on predictions')
            res = DecisionTreeResult(pipeline_utils.Node('empty', []), 0, 0, 0)
        else:
            pipeline, X, feature_labels = pipeline_utils.get_subpipeline(pipeline, step, X, feature_labels)
            details = ModelDetails()
            res = details.calculate_decision_tree(X, pipeline, feature_labels, max_leaf_nodes=max_leaf_nodes)

        self.finish(json.dumps(res.as_dict()))


class FeatureImportanceHandler(BaseHandler):
    is_async = True

    @staticmethod
    def _process_post_async(model, queue):
        X, y, feature_labels, pipeline = FeatureImportanceHandler.load_model(model)
        step = model.get('step', SOURCE)

        if step == pipeline.steps[-1][0] or step == SINK:
            res = pd.DataFrame(data={'0': {'0': 1, '1': 0}})
        else:
            pipeline, X, feature_labels = pipeline_utils.get_subpipeline(pipeline, step, X, feature_labels)
            details = ModelDetails()
            res = details.calculate_feature_importance(X, y, pipeline, feature_labels)
        queue.put(res.to_dict())


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    handlers = [
        (url_path_join(base_url, 'xautoml', 'output/complete'), OutputCompleteHandler),
        (url_path_join(base_url, 'xautoml', 'output/description'), OutputDescriptionHandler),
        (url_path_join(base_url, 'xautoml', 'roc_auc'), RocCurveHandler),
        (url_path_join(base_url, 'xautoml', 'explanations/lime'), LimeHandler),
        (url_path_join(base_url, 'xautoml', 'explanations/feature_importance'), FeatureImportanceHandler),
        (url_path_join(base_url, 'xautoml', 'explanations/dt'), DecisionTreeHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)
