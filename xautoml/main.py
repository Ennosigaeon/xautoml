import time
import warnings
from copy import deepcopy
from typing import Optional, List, Tuple, Dict

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

    def __init__(self, run_history: RunHistory, X: pd.DataFrame, y: pd.Series, n_samples: int = 5000):
        """
        Main class for visualizing AutoML optimization procedures in XAutoML. This class provides methods to render
        the visualization, provides endpoints for internal communication, and for exporting data to Jupyter.

        :param run_history: A RunHistory instance containing the raw data of an optimization. Can be created via the
        provided adapters
        :param X: DataFrame containing the test data set. Used for all calculations
        :param y: Series containing the test data set. Used for all calculations
        :param n_samples: Maximum number of samples in the test data set. Due to the interactive nature of XAutoML,
        calculations have to be quite fast. By default, the number of samples is limited to 5000
        """
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
            if 'prediction_time' in candidate.runtime:
                continue

            try:
                start = time.time()
                candidate.model.predict(self.X)
                end = time.time()
                candidate.runtime['prediction_time'] = end - start
            except Exception:
                candidate.runtime['prediction_time'] = 1000

    def _load_models(self, cids: List[CandidateId]) -> Tuple[pd.DataFrame, pd.Series, List[Pipeline]]:
        models = []
        for cid in cids:
            if cid == 'ENSEMBLE':
                models.append(deepcopy(self.run_history.ensemble.candidate.model))
            else:
                models.append(deepcopy(self.run_history.cid_to_candidate[cid].model))

        return self.X.copy(), self.y.copy(), [m for m in models if m is not None]

    def _load_model(self, cid: CandidateId) -> Tuple[pd.DataFrame, pd.Series, Pipeline]:
        X, y, models = self._load_models([cid])
        if len(models) == 0:
            raise ValueError('Candidate {} does not exist or has no fitted model'.format(cid))

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
                                timestamp: float = np.inf) -> Tuple[List[Configuration], np.ndarray]:
        configs = []
        loss = []
        hash_ = structure.hash if structure is not None else hash(str(None))

        # join equivalent structures
        for s in self.run_history.structures:
            if s.hash == hash_:
                configs += [c.config for c in s.configs if c.runtime['timestamp'] < timestamp]
                loss += [c.loss for c in s.configs if c.runtime['timestamp'] < timestamp]
        return configs, np.array(loss)

    def _construct_fanova(self, sid: Optional[str]):
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
    def _output_description(self, cid: CandidateId):
        with pd.option_context('display.max_columns', 30, 'display.max_rows', 10):
            return self._calculate_output(cid, DESCRIPTION)

    @as_json
    def _output_complete(self, cid: CandidateId):
        with pd.option_context('display.max_columns', 1024, 'display.max_rows', 30, 'display.min_rows', 20):
            return self._calculate_output(cid, COMPLETE)

    @as_json
    def _performance_data(self, cid: CandidateId):
        X, y, pipeline = self._load_model(cid)
        details = ModelDetails()

        duration, val_score, report, accuracy, cm = details.calculate_performance_data(X, y, pipeline,
                                                                                       self.run_history.meta.metric)
        return {
            'duration': duration,
            'val_score': float(val_score),
            'report': {np.asscalar(key): value for key, value in report.items()},
            'accuracy': accuracy,
            'cm': {"classes": cm.columns.to_list(), "values": cm.values.tolist()}
        }

    @as_json
    def _decision_tree_surrogate(self, cid: CandidateId, step: str, max_leaf_nodes: Optional[int]):
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
    def _feature_importance(self, cid: CandidateId, step: str):
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
    def _pdp(self, cid: CandidateId, step: str, features: List[str] = None):
        return self.pdp(cid, step, features)

    @as_json
    def _fanova_overview(self, sid: Optional[CandidateId], step: str):
        try:
            f, X, actual_cs = self._construct_fanova(sid)
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
    def _fanova_details(self, sid: Optional[CandidateId], step: str, hp1: str, hp2: str):
        try:
            f, X, actual_cs = self._construct_fanova(sid)
            return {'details': HPImportance.calculate_fanova_details(f, X, hps=[(hp1, hp2)])}
        except ValueError as ex:
            return {'error': str(ex)}

    @as_json
    def _simulate_surrogate(self, sid: CandidateId, timestamp: float):
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
    def _config_similarity(self):
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
        lo = []
        for key in configspaces.keys():
            cs.append(configspaces[key] if configspaces[key] is not None else self.run_history.default_configspace)
            conf.append(configs[key])
            lo += loss[key]

        res = ConfigSimilarity.compute(cs, conf, np.array(lo), self.run_history.meta.is_minimization)
        return res

    @as_json
    def _lime(self, cid: CandidateId, idx: int, step: str):
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
    def _roc_curve(self, cids: List[CandidateId], micro: bool = False, macro: bool = True, max_samples: int = 50,
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
    def _ensemble_decision_surface(self):
        ensemble = self.run_history.ensemble
        if len(ensemble.members) == 0:
            return {}

        members = [self.run_history.cid_to_candidate[cid] for cid in ensemble.members]
        X, y = self.data_set()

        return EnsembleInspection.plot_decision_surface(ensemble, members, X, y)

    @as_json
    def _ensemble_overview(self):
        ensemble = self.run_history.ensemble
        if len(ensemble.members) == 0:
            return {}

        members = [self.run_history.cid_to_candidate[cid] for cid in ensemble.members]
        X, y = self.data_set()

        y_pred = ensemble.model.predict(X)
        confidence = ensemble.model.predict_proba(X)

        metrics, idx = EnsembleInspection.ensemble_overview(ensemble, members, X, y_pred)

        with pd.option_context('display.max_columns', 1024, 'display.max_rows', 30, 'display.min_rows', 20):
            df = OutputCalculator._load_data(X.loc[idx, :], y[idx], y_pred[idx], np.max(confidence[idx], axis=1),
                                             COMPLETE)
            return {'df': df, 'metrics': metrics}

    @as_json
    def _ensemble_predictions(self, idx: int):
        ensemble = self.run_history.ensemble
        if len(ensemble.members) == 0:
            return {}

        X, _ = self.data_set()
        X = X.loc[[idx], :]

        members = [self.run_history.cid_to_candidate[cid] for cid in ensemble.members]

        predictions = EnsembleInspection.member_predictions(members, X)
        res = {cid: pred.tolist()[0] for cid, pred in zip(ensemble.members, predictions)}
        res['Ensemble'] = ensemble.model.predict(X).tolist()[0]

        return res

    @as_json
    def _get_pipeline_history(self) -> Dict:
        candidates = []
        for struct in self.run_history.structures:
            candidates += [(c.runtime['timestamp'], struct.pipeline, c.id) for c in struct.configs]

        graphs = [pipeline_to_networkx(pipeline, cid) for _, pipeline, cid in candidates]
        merged, history = GraphMatching.create_structure_history(graphs)
        return {'merged': history, 'individual': [export_json(g) for g in graphs]}

    # Endpoints for external communication

    def data_set(self) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Get the test data set
        :return: tuple with DataFrame and Series
        """
        return self.X.copy(), self.y.copy()

    def pipeline(self, cid: CandidateId) -> Tuple[pd.DataFrame, pd.Series, Pipeline]:
        """
        Get the pipeline of the given candidate id
        :param cid: candidate id
        :return: tuple containing 1) The input data, 2) target values, and 3) fitted pipeline
        """
        return self._load_model(cid)

    @no_warnings
    def sub_pipeline(self, cid: CandidateId, step: str) -> Tuple[pd.DataFrame, pd.Series, Pipeline]:
        """
        Get a sub-pipeline starting after the provided step
        :param cid: candidate id
        :param step: last pipeline step that will not be included in the pipeline
        :return: tuple containing 1) The adjusted input data that can be used with the sub-pipeline, 2) target values,
        and 3) new sub-pipeline starting after the provided step
        """
        X, y, pipeline = self._load_model(cid)
        pipeline, X, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y)
        return X, y, pipeline

    @no_warnings
    def feature_importance(self, cid: CandidateId, step: str):
        """
        Calculate feature importance of all features
        :param cid: candidate id
        :param step: pipeline step
        :return: DataFrame with feature importance
        """
        X, y, pipeline = self.sub_pipeline(cid, step)
        pipeline, X, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y)
        return ModelDetails.calculate_feature_importance(X, y, pipeline, self.run_history.meta.metric, n_head=10000)

    @no_warnings
    def pdp(self, cid: CandidateId, step: str, features: List[str]):
        """
        Calculate partial dependency plots
        :param cid: candidate id
        :param step: pipeline step
        :param features: list of feature to calculate PDPs for
        :return: dict with plot data for each requested feature
        """
        X, y, pipeline = self._load_model(cid)

        pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
        return ModelDetails.calculate_pdp(X, y, pipeline, features=features)

    @no_warnings
    def global_surrogate(self, cid: CandidateId, step: str, max_leaf_nodes: int):
        """
        Calculate a global surrogate in form of a decision tree for the given candidate
        :param cid: candidate id
        :param step: pipeline step
        :param max_leaf_nodes: maximum number of leaf nodes in the decision tree
        :return: scikit-learn decision tree
        """
        X, y, pipeline = self.sub_pipeline(cid, step)
        return pipeline_utils.fit_decision_tree(X, pipeline.predict(X), max_leaf_nodes=max_leaf_nodes)

    @no_warnings
    def hp_importance(self, sid: Optional[str], step: str):
        """
        Calculates the importance of all hyperparameters
        :param sid: optional structure id. If given, only configurations from the given structure id are considered
        :param step: pipeline step
        :return: DataFrame with hyperparameter importance
        """

        f, X, actual_cs = self._construct_fanova(sid)
        return HPImportance.calculate_fanova_overview(f, X, step=step, filter_=actual_cs, n_head=10000)

    @no_warnings
    def hp_interactions(self, sid: Optional[str], step: str, hp1: str, hp2: str = None):
        """
        Calculates the interactions between the two given hyperparameters using fANOVA. Both hyperparameters can be
        identical to compute the effects of a single hyperparameter.
        :param sid: optional structure id. If given, only configurations from the given structure id are considered
        :param step: pipeline step
        :param hp1: name of the first hyperparameter
        :param hp2: optional name of the second hyperparameter. If not given, the first hyperparameter is reused
        :return: DataFrame with hyperparameter interactions
        """

        f, X, actual_cs = self._construct_fanova(sid)
        if hp2 is None:
            hp2 = hp1

        return pd.DataFrame(HPImportance.calculate_fanova_details(f, X, hps=[(hp1, hp2)])[hp1][hp2]['data'])

    @no_warnings
    def class_report(self, cid: str):
        """
        Calculates a sklearn.metrics.classification_report
        :param cid: candidate id
        :return: DataFrame with class report
        """

        X, y, pipeline = self._load_model(cid)
        details = ModelDetails()
        _, _, report, _, _ = details.calculate_performance_data(X, y, pipeline, self.run_history.meta.metric)
        return pd.DataFrame(report)

    @no_warnings
    def confusion_matrix(self, cid: str):
        """
        Calculates the confusion matrix of the given candidate
        :param cid: candidate id
        :return: DataFrame with confusion matrix
        """

        X, y, pipeline = self._load_model(cid)
        details = ModelDetails()
        _, _, _, _, cm = details.calculate_performance_data(X, y, pipeline, self.run_history.meta.metric)
        return cm

    def config(self, cid: str):
        """
        Returns the hyperparameters of the given candidate as a dictionary
        :param cid: candidate id
        :return: dict with hyperparameters
        """

        return self.run_history.cid_to_candidate.get(cid).config.get_dictionary()

    def _repr_mimebundle_(self, include, exclude):
        return {
            'application/xautoml+json': self.run_history.as_dict()
        }

    def explain(self):
        """
        Create the visualization
        :return:
        """
        try:
            # noinspection PyPackageRequirements
            from IPython.core.display import display
            # noinspection PyTypeChecker
            return display(self)
        except ImportError:
            return str(self)
