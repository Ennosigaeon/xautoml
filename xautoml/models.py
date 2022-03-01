from dataclasses import dataclass, asdict
from typing import Optional, Any, Callable, Dict, List, Tuple

from ConfigSpace import ConfigurationSpace, Configuration
from ConfigSpace.read_and_write import json as config_json
from sklearn.pipeline import Pipeline

from xautoml.graph_similarity import pipeline_to_networkx, export_json

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
    config: Dict[str, Any]


@dataclass()
class Candidate:
    id: CandidateId
    budget: float
    status: str
    loss: float
    runtime: Dict[str, float]
    config: Configuration
    origin: str
    model: Optional[Pipeline]
    y_transformer: Callable

    def as_dict(self):
        return {
            'id': self.id,
            'budget': self.budget,
            'status': self.status,
            'loss': self.loss,
            'runtime': self.runtime,
            'config': self.config.get_dictionary(),
            'origin': self.origin,
            'filled': self.model is not None
        }


@dataclass()
class CandidateStructure:
    cid: CandidateId
    configspace: Optional[ConfigurationSpace]
    pipeline: Pipeline
    configs: List[Candidate]

    def __init__(self, cid: CandidateId, configspace: Optional[ConfigurationSpace],
                 pipeline: Pipeline, configs: List[Candidate]):
        self.cid = cid
        self.configspace = configspace
        self.pipeline = pipeline
        self.configs = configs
        self.hash = hash(str(configspace))

    def as_dict(self):
        return {
            'cid': self.cid,
            'configspace': config_json.write(self.configspace) if self.configspace is not None else None,
            'pipeline': export_json(pipeline_to_networkx(self.pipeline, self.cid)),
            'configs': [c.as_dict() for c in self.configs]
        }


@dataclass()
class ConfigExplanation:
    candidates: Dict
    loss: List[float]
    marginalization: Dict[str, Dict[str, List[Tuple[float, float]]]]


StructureExplanation = Any


@dataclass()
class Explanations:
    structures: Dict[CandidateId, StructureExplanation]
    configs: Dict[CandidateId, ConfigExplanation]

    def as_dict(self):
        return {
            'structures': self.structures,
            'configs': {key: asdict(value) for key, value in self.configs.items()}
        }


@dataclass()
class Ensemble:
    weights: List[float]
    members: List[CandidateId]
    model: Pipeline

    def __init__(self, model: Pipeline, members: Dict[CandidateId, float]):
        self.members = list(members.keys())
        self.weights = list(members.values())
        self.weight_map = members
        self.model = model
        self.candidate = Candidate('ENSEMBLE', 0, 'SUCCESS', 0, {}, ConfigurationSpace().get_default_configuration(),
                                   'ensemble', Pipeline(steps=[('classifier', model)]), lambda x: x)

    def as_dict(self):
        return {
            'weights': self.weights,
            'members': self.members
        }


@dataclass()
class RunHistory:
    meta: MetaInformation
    default_configspace: Optional[ConfigurationSpace]
    structures: List[CandidateStructure]
    ensemble: Ensemble
    explanations: Explanations

    def __init__(self, meta: MetaInformation, default_configspace: Optional[ConfigurationSpace],
                 structures: List[CandidateStructure], ensemble: Ensemble, explanations: Explanations):
        self.meta = meta
        self.default_configspace = default_configspace
        self.structures = structures
        self.ensemble = ensemble
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
