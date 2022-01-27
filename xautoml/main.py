import time
import warnings
from copy import deepcopy
from typing import Optional

import numpy as np
import pandas as pd
from ConfigSpace import Configuration
from IPython.display import JSON
from sklearn.pipeline import Pipeline

from xautoml._helper import XAutoMLManager
from xautoml.config_similarity import ConfigSimilarity
from xautoml.ensemble import EnsembleInspection
from xautoml.graph_similarity import pipeline_to_networkx, GraphMatching, export_json
from xautoml.hp_importance import HPImportance
from xautoml.model_details import ModelDetails, DecisionTreeResult, LimeResult, GlobalSurrogateResult
from xautoml.models import RunHistory, CandidateId, CandidateStructure
from xautoml.output import DESCRIPTION, OutputCalculator, COMPLETE
from xautoml.roc_auc import RocCurve
from xautoml.util import pipeline_utils
from xautoml.util.constants import SINK
from xautoml.util.datasets import down_sample


def as_json(func):
    def wrapper(*args, **kwargs):
        return JSON(func(*args, **kwargs))

    return wrapper


def no_warnings(func):
    def wrapper(*args, **kwargs):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return func(*args, **kwargs)

    return wrapper


class XAutoML:
    MAX_SAMPLES = 5000

    def __init__(self, run_history: RunHistory, X: pd.DataFrame, y: pd.Series, n_samples: int = 5000):
        self.run_history = run_history

        if X.shape[0] > n_samples:
            warnings.warn(
                'The data set exceeds the maximum number of samples with {}. Selecting {} random samples...'.format(
                    X.shape, n_samples)
            )
            X, y = down_sample(X, y, n_samples)
        self.X: pd.DataFrame = X.reset_index(drop=True)
        self.y: pd.Series = y.reset_index(drop=True)
        self._calc_pred_times()

        XAutoMLManager.open(self)

    # Helper Methods

    @no_warnings
    def _calc_pred_times(self):
        for candidate in self.run_history.cid_to_candidate.values():
            try:
                start = time.time()
                candidate.model.predict(self.X)
                end = time.time()
                candidate.runtime['prediction_time'] = end - start
            except Exception:
                candidate.runtime['prediction_time'] = 1000

    def _load_models(self, cids: list[CandidateId]) -> tuple[pd.DataFrame, pd.Series, list[Pipeline]]:
        models = []
        for cid in cids:
            try:
                if cid == 'ENSEMBLE':
                    models.append(deepcopy(self.run_history.ensemble.candidate.model))
                else:
                    models.append(deepcopy(self.run_history.cid_to_candidate[cid].model))
            except FileNotFoundError:
                pass

        return self.X.copy(), self.y.copy(), models

    def _load_model(self, cid: CandidateId) -> tuple[pd.DataFrame, pd.Series, Pipeline]:
        X, y, models = self._load_models([cid])
        pipeline = models[0]
        return X, y, pipeline

    @staticmethod
    def _get_intermediate_output(X, y, model, method):
        df_handler = OutputCalculator()
        _, outputs = df_handler.calculate_outputs(model, X, y, method=method)
        return outputs

    def _calculate_output(self, cid: CandidateId, method: str):
        X, y, pipeline = self._load_model(cid)
        steps = self._get_intermediate_output(X, y, pipeline, method=method)
        return steps

    def _get_equivalent_configs(self,
                                structure: Optional[CandidateStructure],
                                timestamp: float = np.inf) -> tuple[list[Configuration], np.ndarray]:
        configs = []
        loss = []
        hash_ = structure.hash if structure is not None else hash(str(None))

        # join equivalent structures
        for s in self.run_history.structures:
            if s.hash == hash_:
                configs += [c.config for c in s.configs if c.runtime['timestamp'] < timestamp]
                loss += [c.loss for c in s.configs if c.runtime['timestamp'] < timestamp]
        return configs, np.array(loss)

    def _construct_fanova(self, sid: Optional[str], step: str):
        if sid is not None:
            matches = filter(lambda s: s.cid == sid, self.run_history.structures)
            structure = next(matches)
        else:
            structure = None

        actual_cs = None
        configs, loss = self._get_equivalent_configs(structure)
        if structure is not None and structure.configspace is not None:
            cs = structure.configspace
        else:
            cs = self.run_history.default_configspace
            try:
                # noinspection PyUnresolvedReferences
                actual_cs = structure.pipeline.configuration_space
            except AttributeError:
                pass

        f, X = HPImportance.construct_fanova(cs, configs, loss)
        if X.shape[0] < 2:
            raise ValueError('Not enough evaluated configurations to calculate hyperparameter importance.')

        return f, X, actual_cs

    # Endpoints for internal communication

    @as_json
    def output_description(self, cid: CandidateId):
        with pd.option_context('display.max_columns', 30, 'display.max_rows', 10):
            return self._calculate_output(cid, DESCRIPTION)

    @as_json
    def output_complete(self, cid: CandidateId):
        with pd.option_context('display.max_columns', 1024, 'display.max_rows', 30, 'display.min_rows', 20):
            return self._calculate_output(cid, COMPLETE)

    @as_json
    def performance_data(self, cid: CandidateId):
        X, y, pipeline = self._load_model(cid)
        details = ModelDetails()

        duration, validation_score, report, accuracy, cm = details.calculate_performance_data(X, y, pipeline,
                                                                                              self.run_history.meta.metric)
        return {
            'duration': duration,
            'val_score': float(validation_score),
            'report': {np.asscalar(key): value for key, value in report.items()},
            'accuracy': accuracy,
            'cm': {"classes": cm.columns.to_list(), "values": cm.values.tolist()}
        }

    @as_json
    def decision_tree_surrogate(self, cid: CandidateId, step: str, max_leaf_nodes: Optional[int]):
        X, y, pipeline = self._load_model(cid)

        last_step = pipeline.steps[-1][0]
        if step == last_step or step.startswith('{}:'.format(last_step)) or step == SINK:
            res = GlobalSurrogateResult([DecisionTreeResult(pipeline_utils.Node('empty', 0, [], []), 0, 0, 2)] * 10, 0)
            additional_features = []
        else:
            pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
            details = ModelDetails()
            res = details.calculate_decision_tree(X, pipeline, max_leaf_nodes=max_leaf_nodes)

        return res.as_dict(additional_features)

    @as_json
    def feature_importance(self, cid: CandidateId, step: str):
        X, y, pipeline = self._load_model(cid)

        last_step = pipeline.steps[-1][0]
        if step == last_step or step.startswith('{}:'.format(last_step)) or step == SINK:
            res = pd.DataFrame()
            additional_features = []
        else:
            pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
            res = ModelDetails.calculate_feature_importance(X, y, pipeline, self.run_history.meta.metric)

        res['idx'] = range(len(res))
        return {
            'data': {
                'column_names': res.index.to_list(),
                'keys': [(c, c) for c in res.index],
                'importance': res.to_dict('records')
            },
            'additional_features': additional_features
        }

    @as_json
    def pdp(self, cid: CandidateId, step: str, features: list[str] = None):
        return self.get_pdp(cid, step, features)

    @as_json
    def fanova_overview(self, sid: Optional[CandidateId], step: str):
        try:
            f, X, actual_cs = self._construct_fanova(sid, step)
            overview = HPImportance.calculate_fanova_overview(f, X, step=step, filter_=actual_cs)
            overview = {
                'column_names': np.unique(np.array(overview.index.to_list()).flatten()).tolist(),
                'keys': overview.index.tolist(),
                'importance': overview[['mean', 'std', 'idx']].to_dict('records'),
            }
            return {'overview': overview}
        except ValueError as ex:
            return {'error': str(ex)}

    @as_json
    def fanova_details(self, sid: Optional[CandidateId], step: str, hp1: str, hp2: str):
        try:
            f, X, actual_cs = self._construct_fanova(sid, step)
            return {'details': HPImportance.calculate_fanova_details(f, X, hps=[(hp1, hp2)])}
        except ValueError as ex:
            return {'error': str(ex)}

    @as_json
    def simulate_surrogate(self, sid: CandidateId, timestamp: float):
        try:
            matches = filter(lambda s: s.cid == sid, self.run_history.structures)
            structure = next(matches)

            cs = structure.configspace if structure.configspace is not None else self.run_history.default_configspace
            configs, loss = self._get_equivalent_configs(structure, timestamp)

            f, X = HPImportance.construct_fanova(cs, configs, loss)
            explanations = HPImportance.simulate_surrogate(f, X)
            return explanations
        except IndexError:
            raise ValueError('Unable to simulate surrogate model without trainings data')

    @as_json
    def config_similarity(self):
        configspaces = {}
        configs = {}
        loss = {}
        for structure in self.run_history.structures:
            if structure.hash not in configspaces:
                configspaces[structure.hash] = structure.configspace
                configs[structure.hash] = [c.config for c in structure.configs]
                loss[structure.hash] = [c.loss for c in structure.configs]
            else:
                configs[structure.hash] += [c.config for c in structure.configs]
                loss[structure.hash] += [c.loss for c in structure.configs]

        cs = []
        conf = []
        l = []
        for key in configspaces.keys():
            cs.append(configspaces[key] if configspaces[key] is not None else self.run_history.default_configspace)
            conf.append(configs[key])
            l += loss[key]

        res = ConfigSimilarity.compute(cs, conf, np.array(l), self.run_history.meta.is_minimization)
        return res

    @as_json
    def lime(self, cid: CandidateId, idx: int, step: str):
        X, y, pipeline = self._load_model(cid)

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

        return res.to_dict(additional_features)

    @as_json
    def roc_curve(self, cids: list[CandidateId], micro: bool = False, macro: bool = True, max_samples: int = 50,
                  max_curves: int = 20):
        pruned_cids = cids[:max_curves]

        X, y, models = self._load_models(pruned_cids)

        result = {}
        for cid, pipeline in zip(pruned_cids, models):
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
                print('Failed to calculate ROC for {}'.format(cid))
        return result

    @as_json
    def ensemble_decision_surface(self):
        ensemble = self.run_history.ensemble
        if len(ensemble.members) == 0:
            return {}

        members = [self.run_history.cid_to_candidate[cid] for cid in ensemble.members]
        X, y = self.get_data_set()

        return EnsembleInspection.plot_decision_surface(ensemble, members, X, y)

    @as_json
    def ensemble_overview(self):
        ensemble = self.run_history.ensemble
        if len(ensemble.members) == 0:
            return {}

        members = [self.run_history.cid_to_candidate[cid] for cid in ensemble.members]
        X, y = self.get_data_set()

        y_pred = ensemble.model.predict(X)
        confidence = ensemble.model.predict_proba(X)

        metrics, idx = EnsembleInspection.ensemble_overview(ensemble, members, X, y_pred)

        with pd.option_context('display.max_columns', 1024, 'display.max_rows', 30, 'display.min_rows', 20):
            df = OutputCalculator._load_data(X.loc[idx, :], y[idx], y_pred[idx], np.max(confidence[idx], axis=1),
                                             COMPLETE)
            return {'df': df, 'metrics': metrics}

    @as_json
    def ensemble_predictions(self, idx: int):
        ensemble = self.run_history.ensemble
        if len(ensemble.members) == 0:
            return {}

        X, _ = self.get_data_set()
        X = X.loc[[idx], :]

        members = [self.run_history.cid_to_candidate[cid] for cid in ensemble.members]

        predictions = EnsembleInspection.member_predictions(members, X)
        res = {cid: pred.tolist()[0] for cid, pred in zip(ensemble.members, predictions)}
        res['Ensemble'] = ensemble.model.predict(X).tolist()[0]

        return res

    @as_json
    def get_pipeline_history(self) -> dict:
        candidates = []
        for struct in self.run_history.structures:
            candidates += [(c.runtime['timestamp'], struct.pipeline, c.id) for c in struct.configs]

        graphs = [pipeline_to_networkx(pipeline, cid) for _, pipeline, cid in candidates]
        merged, history = GraphMatching.create_structure_history(graphs)
        return {'merged': history, 'individual': [export_json(g) for g in graphs]}

    # Endpoints for external communication

    def get_data_set(self) -> tuple[pd.DataFrame, pd.Series]:
        return self.X.copy(), self.y.copy()

    def get_pipeline(self, cid: CandidateId) -> tuple[pd.DataFrame, pd.Series, Pipeline]:
        return self._load_model(cid)

    @no_warnings
    def get_sub_pipeline(self, cid: CandidateId, step: str) -> tuple[pd.DataFrame, pd.Series, Pipeline]:
        X, y, pipeline = self._load_model(cid)
        pipeline, X, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y)
        return X, y, pipeline

    @no_warnings
    def get_feature_importance(self, cid: CandidateId, step: str):
        X, y, pipeline = self.get_sub_pipeline(cid, step)
        pipeline, X, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y)
        return ModelDetails.calculate_feature_importance(X, y, pipeline, self.run_history.meta.metric, n_head=10000)

    @no_warnings
    def get_pdp(self, cid: CandidateId, step: str, features: list[str]):
        X, y, pipeline = self._load_model(cid)

        pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
        return ModelDetails.calculate_pdp(X, y, pipeline, features=features)

    @no_warnings
    def get_global_surrogate(self, cid: CandidateId, step: str, max_leaf_nodes: int):
        X, y, pipeline = self.get_sub_pipeline(cid, step)
        return pipeline_utils.fit_decision_tree(X, pipeline.predict(X), max_leaf_nodes=max_leaf_nodes)

    @no_warnings
    def get_hp_importance(self, sid: Optional[str], step: str):
        f, X, actual_cs = self._construct_fanova(sid, step)
        return HPImportance.calculate_fanova_overview(f, X, step=step, filter_=actual_cs, n_head=10000)

    @no_warnings
    def get_hp_interactions(self, sid: Optional[str], step: str, hp1: str, hp2: str):
        f, X, actual_cs = self._construct_fanova(sid, step)
        return pd.DataFrame(HPImportance.calculate_fanova_details(f, X, hps=[(hp1, hp2)])[hp1][hp2]['data'])

    @no_warnings
    def get_class_report(self, cid: str):
        X, y, pipeline = self._load_model(cid)
        details = ModelDetails()
        _, _, report, _, _ = details.calculate_performance_data(X, y, pipeline, self.run_history.meta.metric)
        return pd.DataFrame(report)

    @no_warnings
    def get_cm(self, cid: str):
        X, y, pipeline = self._load_model(cid)
        details = ModelDetails()
        _, _, _, _, cm = details.calculate_performance_data(X, y, pipeline, self.run_history.meta.metric)
        return cm

    def get_config(self, cid: str):
        return self.run_history.cid_to_candidate.get(cid).config.get_dictionary()

    def _repr_mimebundle_(self, include, exclude):
        return {
            'application/xautoml+json': self.run_history.as_dict()
        }

    def explain(self):
        try:
            # noinspection PyPackageRequirements
            from IPython.core.display import display
            # noinspection PyTypeChecker
            return display(self)
        except ImportError:
            return str(self)
