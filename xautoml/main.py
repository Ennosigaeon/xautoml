import warnings
from copy import deepcopy
from dataclasses import dataclass, asdict
from typing import Optional, Any

import numpy as np
import pandas as pd
from ConfigSpace import ConfigurationSpace, Configuration
from ConfigSpace.read_and_write import json as config_json
from IPython.display import JSON
from sklearn.pipeline import Pipeline
import dswizard.components.util as component_util

from xautoml.config_similarity import ConfigSimilarity
from xautoml.hp_importance import HPImportance
from xautoml.model_details import ModelDetails, DecisionTreeResult, LimeResult
from xautoml.output import DESCRIPTION, OutputCalculator, COMPLETE
from xautoml.roc_auc import RocCurve
from xautoml.util import pipeline_utils
from xautoml.util.constants import SINK

CandidateId = str


@dataclass()
class MetaInformation:
    framework: str
    start_time: float
    end_time: float
    metric: str
    is_minimization: bool
    n_structures: int
    n_configs: int
    incumbent: float
    openml_task: Optional[int]
    openml_fold: Optional[int]
    config: dict[str, any]


@dataclass()
class Candidate:
    id: str
    budget: float
    status: str
    loss: float
    runtime: dict[str, float]
    config: Configuration
    origin: str
    model: Pipeline

    def as_dict(self):
        return {
            'id': self.id,
            'budget': self.budget,
            'status': self.status,
            'loss': self.loss,
            'runtime': self.runtime,
            'config': self.config.get_dictionary(),
            'origin': self.origin
        }


@dataclass()
class CandidateStructure:
    cid: CandidateId
    configspace: Optional[ConfigurationSpace]
    pipeline: Pipeline
    configs: list[Candidate]

    def __init__(self, cid: CandidateId, configspace: Optional[ConfigurationSpace],
                 pipeline: Pipeline, configs: list[Candidate]):
        self.cid = cid
        self.configspace = configspace
        self.pipeline = pipeline
        self.configs = configs
        self.hash = hash(str(configspace))

    def as_dict(self):
        return {
            'cid': self.cid,
            'configspace': config_json.write(self.configspace) if self.configspace is not None else None,
            'pipeline': component_util.serialize(self.pipeline),
            'configs': [c.as_dict() for c in self.configs]
        }


@dataclass()
class ConfigExplanation:
    candidates: dict
    loss: list[float]
    marginalization: dict[str, dict[str, list[tuple[float, float]]]]


StructureExplanation = Any


@dataclass()
class Explanations:
    structures: dict[CandidateId, StructureExplanation]
    configs: dict[CandidateId, ConfigExplanation]

    def as_dict(self):
        return {
            'structures': self.structures,
            'configs': {key: asdict(value) for key, value in self.configs.items()}
        }


@dataclass()
class RunHistory:
    meta: MetaInformation
    default_configspace: Optional[ConfigurationSpace]
    structures: list[CandidateStructure]
    explanations: Explanations

    def __init__(self, meta: MetaInformation, default_configspace: Optional[ConfigurationSpace],
                 structures: list[CandidateStructure], explanations: Explanations):
        self.meta = meta
        self.default_configspace = default_configspace
        self.structures = structures
        self.explanations = explanations

        self.cid_to_candidate = {}
        for s in structures:
            for c in s.configs:
                self.cid_to_candidate[c.id] = c

    def as_dict(self):
        return {
            'meta': asdict(self.meta),
            'default_configspace': config_json.write(self.default_configspace)
            if self.default_configspace is not None else None,
            'structures': [s.as_dict() for s in self.structures],
            'explanations': self.explanations.as_dict()
        }


def as_json(func):
    def wrapper(*args, **kwargs):
        return JSON(func(*args, **kwargs))

    return wrapper


# TODO downsampling

class XAutoML:
    MAX_SAMPLES = 5000

    def __init__(self, run_history: RunHistory, X: pd.DataFrame, y: pd.Series, n_samples: int = 5000):
        self.run_history = run_history

        down_sample = X.shape[0] > n_samples
        if down_sample:
            idx = np.random.choice(X.shape[0], size=n_samples, replace=False)
            X = X.loc[idx, :].reset_index(drop=True)
            y = y.loc[idx].reset_index(drop=True)
        self.X: pd.DataFrame = X
        self.y: pd.Series = y

    # Helper Methods

    def _load_models(self, cids: list[CandidateId]) -> tuple[pd.DataFrame, pd.Series, list[Pipeline]]:
        models = []
        for cid in cids:
            try:
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
        return {'data': steps, 'downsampled': False}

    def _get_equivalent_configs(self,
                                structure: CandidateStructure,
                                timestamp: float = np.inf) -> tuple[list[Configuration], np.ndarray]:
        configs = []
        loss = []
        # join equivalent structures
        for s in self.run_history.structures:
            if s.hash == structure.hash:
                configs += [c.config for c in s.configs if c.runtime['timestamp'] < timestamp]
                loss += [c.loss for c in s.configs if c.runtime['timestamp'] < timestamp]
        return configs, np.array(loss)

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
        data = details.calculate_performance_data(X, y, pipeline, self.run_history.meta.metric)
        return data

    @as_json
    def decision_tree_surrogate(self, cid: CandidateId, step: str, max_leaf_nodes: Optional[int]):
        X, y, pipeline = self._load_model(cid)

        if step == pipeline.steps[-1][0] or step == SINK:
            res = DecisionTreeResult(pipeline_utils.Node('empty', []), 0, 0, 0, 2)
            additional_features = False
        else:
            pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
            details = ModelDetails()
            res = details.calculate_decision_tree(X, pipeline, max_leaf_nodes=max_leaf_nodes)

        return res.as_dict(additional_features, False)

    @as_json
    def feature_importance(self, cid: CandidateId, step: str):
        X, y, pipeline = self._load_model(cid)

        if step == pipeline.steps[-1][0] or step == SINK:
            res = pd.DataFrame(data={'0': {'0': 1, '1': 0}})
            additional_features = []
        else:
            pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
            details = ModelDetails()
            res = details.calculate_feature_importance(X, y, pipeline)
        return {'data': res.to_dict(), 'additional_features': additional_features, 'downsampled': False}

    @as_json
    def fanova(self, sid: CandidateId, step: str):
        matches = filter(lambda s: s.cid == sid, self.run_history.structures)
        structure = next(matches)

        cs = structure.configspace
        loss = np.array([c.loss for c in structure.configs])
        configs = [c.config for c in structure.configs]

        f, X = HPImportance.construct_fanova(cs, configs, loss)
        if X.shape[0] < 2:
            return {
                'error': 'Not enough evaluated configurations to calculate hyperparameter importance.'
            }

        overview = HPImportance.calculate_fanova_overview(f, X, step=step)
        details = HPImportance.calculate_fanova_details(f, X)

        return {'overview': overview, 'details': details}

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
    def roc_curve(self, cids: list[CandidateId], micro: bool = False, macro: bool = True, max_samples: int = 50):
        X, y, models = self._load_models(cids)

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
                print('Failed to calculate ROC for {}'.format(cid))
        return result

    # Endpoints for external communication

    def get_data_set(self) -> tuple[pd.DataFrame, pd.Series]:
        return self.X.copy(), self.y.copy()

    def get_pipeline(self, cid: CandidateId) -> tuple[pd.DataFrame, pd.Series, Pipeline]:
        return self._load_model(cid)

    def get_sub_pipeline(self, cid: CandidateId, step: str) -> tuple[pd.DataFrame, pd.Series, Pipeline]:
        X, y, pipeline = self._load_model(cid)
        pipeline, X, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y)
        return X, y, pipeline

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
