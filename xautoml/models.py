from dataclasses import dataclass, asdict
from typing import Optional, Any

from ConfigSpace.read_and_write import json as config_json
from ConfigSpace import ConfigurationSpace, Configuration
from sklearn.pipeline import Pipeline
import dswizard.components.util as component_util

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
    id: CandidateId
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
class Ensemble:
    weights: list[float]
    members: list[CandidateId]
    model: Pipeline

    def __init__(self, model: Pipeline, members: dict[CandidateId, float]):
        self.members = list(members.keys())
        self.weights = list(members.values())
        self.weight_map = members
        self.model = model

    def as_dict(self):
        return {
            'weights': self.weights,
            'members': self.members
        }


@dataclass()
class RunHistory:
    meta: MetaInformation
    default_configspace: Optional[ConfigurationSpace]
    structures: list[CandidateStructure]
    ensemble: Ensemble
    explanations: Explanations

    def __init__(self, meta: MetaInformation, default_configspace: Optional[ConfigurationSpace],
                 structures: list[CandidateStructure], ensemble: Ensemble, explanations: Explanations):
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
