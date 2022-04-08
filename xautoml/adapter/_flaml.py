import time
from copy import deepcopy
from typing import Union, Dict

from ConfigSpace import ConfigurationSpace, Configuration, UniformFloatHyperparameter, CategoricalHyperparameter, \
    UniformIntegerHyperparameter, Constant
from sklearn.pipeline import Pipeline

from xautoml.models import RunHistory, MetaInformation, Explanations, CandidateStructure, Candidate, Ensemble


def import_flaml(pipeline: Union[Pipeline, 'flaml.AutoML']) -> RunHistory:
    """
    Import the RunHistory from a FLAML optimization run

    :param pipeline: sklearn pipeline with flaml.AutoML classifier
    """

    from flaml import AutoML
    import flaml.tune.sample

    def parse_config_space():
        sub_cs = {}
        for hps in automl.search_space['ml'].categories:
            cs = ConfigurationSpace()
            for name, hp in hps.items():
                if name == 'learner':
                    continue

                if isinstance(hp, flaml.tune.sample.Integer):
                    cs.add_hyperparameter(UniformIntegerHyperparameter(name, lower=hp.lower, upper=hp.upper))
                elif isinstance(hp, flaml.tune.sample.Float):
                    cs.add_hyperparameter(UniformFloatHyperparameter(name, lower=hp.lower, upper=hp.upper))
                elif isinstance(hp, flaml.tune.sample.Categorical):
                    cs.add_hyperparameter(CategoricalHyperparameter(name, choices=hp.categories))
                elif isinstance(hp, int) or isinstance(hp, float) or isinstance(hp, bool) or isinstance(hp, str):
                    cs.add_hyperparameter(Constant(name, hp))
                else:
                    raise ValueError(f'Unknown hyperparameter {name}')

            sub_cs[hps['learner']] = cs

        configspace = ConfigurationSpace()
        estimator = CategoricalHyperparameter('__choice__', list(sub_cs.keys()))
        configspace.add_hyperparameter(estimator)
        for estimator_name, cs in sub_cs.items():
            parent_hyperparameter = {'parent': estimator, 'value': estimator_name}
            configspace.add_configuration_space(estimator_name, cs, parent_hyperparameter=parent_hyperparameter)

        return configspace

    def parse_structures():
        candidates = {}

        best_idx: Dict[str, int] = {}
        for idx, (classifier, _, _) in automl.config_history.items():
            if classifier not in best_idx:
                best_idx[classifier] = idx
            else:
                best_idx[classifier] = max(idx, best_idx[classifier])

        for idx, (classifier, hps, start_time) in automl.config_history.items():
            if classifier not in candidates:
                candidates[classifier] = []

            padded_hps = {'{}:{}'.format(classifier, key): value
                          for key, value in hps.items() if not key.startswith('FLAML')}
            padded_hps['__choice__'] = classifier
            config = Configuration(cs, padded_hps)

            if best_idx[classifier] == idx:
                # Replace flaml with actual classifier
                pip = deepcopy(pipeline)
                pip.steps[-1] = (pip.steps[-1][0], automl.best_model_for_estimator(classifier))
            else:
                pip = None

            candidate = Candidate('{}:{}'.format(automl.estimator_list.index(classifier), idx), 1,
                                  'Success', automl.best_loss_per_estimator[classifier],
                                  {'timestamp': start_time, 'training_time': 1, 'prediction_time': 1},
                                  config, 'FLAML',
                                  pip, lambda y: y)
            candidates[classifier].append(candidate)

        structures = []
        for classifier, configs in candidates.items():
            # Replace flaml with actual classifier
            pip = deepcopy(pipeline)
            learner = automl._state.learner_classes[classifier]
            pip.steps[-1] = (pip.steps[-1][0], learner())

            structures.append(CandidateStructure(str(automl.estimator_list.index(classifier)), cs, pip, configs))

        return structures

    if isinstance(pipeline, Pipeline):
        automl: AutoML = pipeline.steps[-1][1]
    else:
        automl: AutoML = pipeline

    cs = parse_config_space()
    structures = parse_structures()
    start = time.time()
    meta = MetaInformation('scikit-learn',
                           start, start + automl.modelcount,
                           automl._state.metric,
                           False,
                           len(structures), automl.modelcount,
                           float(automl.best_loss),
                           None, None, automl._settings)

    return RunHistory(meta, None, structures, Ensemble(pipeline, {str(automl.best_iteration): 1.}),
                      Explanations({}, {}))
