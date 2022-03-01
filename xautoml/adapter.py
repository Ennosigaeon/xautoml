import time
from collections import OrderedDict
from copy import deepcopy
from typing import Union, Dict, List, Tuple

import joblib
import pandas as pd
from ConfigSpace import ConfigurationSpace, Configuration, UniformFloatHyperparameter, CategoricalHyperparameter, \
    UniformIntegerHyperparameter, Constant
from ConfigSpace.read_and_write import json as config_json
from sklearn.ensemble import VotingClassifier
from sklearn.pipeline import Pipeline

from xautoml.models import RunHistory, MetaInformation, Explanations, CandidateStructure, Candidate, CandidateId, \
    ConfigExplanation, Ensemble


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


def import_dswizard(dswizard: 'dswizard.core.runhistory.RunHistory', ensemble: VotingClassifier) -> RunHistory:
    """
    Import the RunHistory from a dswizard optimization run. In addition, the final ensemble has to be provided.

    :param dswizard: RunHistory produced by a dswizard optimization run
    :param ensemble: Ensemble constructed by dswizard
    """

    tmp = dswizard.complete_data['meta']
    meta = MetaInformation('dswizard', tmp['start_time'], tmp['end_time'], tmp['metric'], tmp['is_minimization'],
                           tmp['n_structures'], tmp['n_configs'], tmp['incumbent'], tmp['openml_task'],
                           tmp['openml_fold'], tmp['config'])
    default_cs = config_json.read(dswizard.complete_data['default_configspace']) \
        if 'default_configspace' in dswizard.complete_data and dswizard.complete_data['default_configspace'] is not None \
        else None

    structures = []
    for struct in dswizard.data.values():
        configs = []
        for res in struct.results:
            try:
                with open(res.model_file, 'rb') as f:
                    pipeline = joblib.load(f)

                configs.append(Candidate(res.cid.external_name, struct.budget, res.status.name,
                                         res.loss * (1 if meta.is_minimization else -1),
                                         res.runtime.as_dict(), res.config,
                                         res.config.origin if res.config is not None else None,
                                         pipeline, lambda y: y))
            except FileNotFoundError:
                pass
        structures.append(CandidateStructure(struct.cid.without_config().external_name,
                                             struct.configspace, struct.pipeline, configs))

    config_explanations = {}
    for cid, exp in dswizard.complete_data['explanations']['configs'].items():
        config_explanations[cid] = ConfigExplanation(exp['candidates'], exp['loss'], exp['marginalization'])
    explanations = Explanations(dswizard.complete_data['explanations']['structures'], config_explanations)

    # noinspection PyTypeChecker
    ens = Ensemble(ensemble, {cid: ensemble.weights[i] for i, (cid, _) in enumerate(ensemble.estimators)})

    return RunHistory(meta, default_cs, structures, ens, explanations)


def import_auto_sklearn(automl: 'autosklearn.automl.AutoMLClassifier') -> RunHistory:
    """
    Import the RunHistory from an auto-sklearn classifier

    :param automl: fitted AutoMLClassifier
    """

    def build_meta_information() -> MetaInformation:
        try:
            start_time = backend.load_start_time(automl.seed)
        except FileNotFoundError:
            start_time = next(iter(runhistory.data.values())).starttime

        arguments = {
            'tmp_folder': backend.context._temporary_directory,
            'time_left_for_this_task': automl.automl_._time_for_task,
            'per_run_time_limit': automl.automl_._per_run_time_limit,
            'ensemble_size': automl.automl_._ensemble_size,
            'ensemble_nbest': automl.automl_._ensemble_nbest,
            'max_models_on_disc': automl.automl_._max_models_on_disc,
            'seed': automl.automl_._seed,
            'memory_limit': automl.automl_._memory_limit,
            'metadata_directory': automl.automl_._metadata_directory,
            'debug_mode': automl.automl_._debug_mode,
            'include': automl.automl_._include,
            'exclude': automl.automl_._exclude,
            'resampling_strategy': automl.automl_._resampling_strategy,
            'resampling_strategy_arguments': automl.automl_._resampling_strategy_arguments,
            'n_jobs': automl.automl_._n_jobs,
            'multiprocessing_context': automl.automl_._multiprocessing_context,
            'precision': automl.automl_.precision,
            'disable_evaluator_output': automl.automl_._disable_evaluator_output,
            'get_smac_objective_callback': automl.automl_._get_smac_object_callback,
            'smac_scenario_args': automl.automl_._smac_scenario_args,
            'logging_config': automl.automl_.logging_config,
        }

        meta = MetaInformation('auto-sklearn',
                               start_time, start_time + automl.time_left_for_this_task,
                               metric.name, metric._sign == -1,
                               1, len(automl.automl_.runhistory_.data),
                               trajectory[-1][0] if metric._sign == -1. else metric._optimum - trajectory[-1][0],
                               None, None, arguments
                               )

        return meta

    def build_structures() -> Tuple[Dict[CandidateId, CandidateStructure], Dict[CandidateId, float]]:
        from dswizard.components.pipeline import ConfigurablePipeline
        from dswizard.components.sklearn import ColumnTransformerComponent

        def as_configurable_pipeline(simple_pipeline: Pipeline) -> ConfigurablePipeline:
            def suffix_name(name, suffix) -> str:
                if suffix is None:
                    return name
                elif name in suffix:
                    return name
                else:
                    return '{}:{}'.format(name, suffix)

            def convert_component(component):
                suffix = component.__class__.__module__.split('.')[-1]

                if hasattr(component, 'choice'):
                    return convert_component(component.choice)

                if hasattr(component, 'column_transformer'):
                    c, suffix2 = convert_component(component.column_transformer)
                    return c, suffix

                if hasattr(component, 'transformers'):
                    transformers = []
                    for name, t, cols in component.transformers:
                        t_, suffix = convert_component(t)
                        transformers.append((suffix_name(name, suffix), t_, cols))

                    return ColumnTransformerComponent(transformers), suffix

                if hasattr(component, 'steps'):
                    steps = []
                    for name, s in component.steps:
                        s_, suffix = convert_component(s)
                        steps.append((suffix_name(name, suffix), s_))
                    return ConfigurablePipeline(steps), None

                return component, suffix

            a = convert_component(simple_pipeline)[0]
            return a

        ensemble_members: List[Tuple] = automl.automl_.ensemble_.get_selected_model_identifiers()
        ensemble_weights = [w for w in automl.automl_.ensemble_.weights_ if w > 0]
        mapped_ensemble_member = {}

        structures = OrderedDict()
        for key, value in runhistory.data.items():
            t = (automl.seed, key.config_id, key.budget)
            try:
                pipeline = automl.automl_.models_[t]
                config_pipeline = as_configurable_pipeline(pipeline)
            except KeyError:
                try:
                    pipeline = automl.automl_._backend.load_model_by_seed_and_id_and_budget(automl.seed,
                                                                                            key.config_id,
                                                                                            key.budget)
                    config_pipeline = as_configurable_pipeline(pipeline)
                except FileNotFoundError:
                    continue
            try:
                # ClassifierChoice does not provide sklearn classifier information
                pipeline.steps[-1][1]._estimator_type = 'classifier'
                pipeline.steps[-1][1].classes_ = pipeline.steps[-1][1].choice.estimator.classes_
            except AttributeError:
                pass

            try:
                struct_key = str(config_pipeline.get_hyperparameter_search_space())
                cs = None
            except AttributeError:
                # Fallback for DummyClassifier
                cs = ConfigurationSpace()
                struct_key = str(cs)

            if struct_key not in structures:
                structure = CandidateStructure('00:{:02d}'.format(len(structures)), cs, config_pipeline, [])
                structures[struct_key] = structure
            else:
                structure = structures[struct_key]

            if key.config_id > 1:
                config = automl.automl_.runhistory_.ids_config.get(key.config_id - 1)
            else:
                config = cs.get_default_configuration()
                config.origin = 'Default'

            cid = '{}:{:02d}'.format(structure.cid, key.config_id)
            candidate = Candidate(
                cid,
                key.budget,
                'SUCCESS' if value.status.name == 'SUCCESS' else 'CRASHED',
                value.cost if metric._sign != 1.0 else metric._optimum - value.cost,
                {
                    'timestamp': value.starttime - meta_information.start_time,
                    'training_time': value.endtime - value.starttime
                },
                config, config.origin,
                pipeline,
                automl.automl_.InputValidator.target_validator.inverse_transform
            )
            structure.configs.append(candidate)

            try:
                idx = ensemble_members.index(t)
                mapped_ensemble_member[cid] = ensemble_weights[idx]
            except ValueError:
                pass

        return {s.cid: s for s in structures.values()}, mapped_ensemble_member

    metric = automl.automl_._metric
    backend = automl.automl_._backend
    runhistory = automl.automl_.runhistory_
    trajectory = automl.trajectory_

    meta_information = build_meta_information()
    structures, ensemble = build_structures()

    return RunHistory(meta_information, automl.automl_.configuration_space, list(structures.values()),
                      Ensemble(automl, ensemble), Explanations({}, {}))


def import_sklearn(search: Union['sklearn.model_selection.RandomizedSearchCV', 'sklearn.model_selection.GridSearchCV'],
                   metric: str = None, start_time: float = None) -> RunHistory:
    """
    Import the RunHistory from a scikit-learn RandomizedSearchCV or GridSearchCV

    :param search: fitted sklearn.model_selection.RandomizedSearchCV or sklearn.model_selection.GridSearchCV
    :param metric: metric string if metric was not specified during the hyperparameter optimization
    :param start_time: start_time as unix timestamp. Defaults to current system time
    """
    from sklearn.model_selection import RandomizedSearchCV

    def parse_config_space() -> ConfigurationSpace:
        search_definition = search.param_distributions if isinstance(search, RandomizedSearchCV) else search.param_grid

        step_configspace = {}
        for name, dist in search_definition.items():
            tokens = name.split('__')
            if len(tokens) > 1:
                step, param_name = ':'.join(tokens[:-1]), tokens[-1]
            else:
                step, param_name = None, tokens[0]

            if step not in step_configspace:
                step_configspace[step] = ConfigurationSpace()

            if hasattr(dist, 'interval'):
                min_, max_ = dist.interval(1)
                default_value = dist.mean() if hasattr(dist, 'mean') else min_ + (max_ - min_) / 2
                hp = UniformFloatHyperparameter(param_name, min_, max_, default_value=default_value)
            elif isinstance(dist, list) or isinstance(dist, tuple):
                hp = CategoricalHyperparameter(param_name, dist)
            else:
                raise ValueError(f'Unknown hyperparameter {name}')

            step_configspace[step].add_hyperparameter(hp)

        configspace = ConfigurationSpace()
        for step, cs in step_configspace.items():
            if step is None:
                configspace.add_hyperparameters(cs.get_hyperparameters())
            else:
                configspace.add_configuration_space(step, cs)

        return configspace

    def parse_structures(cs: ConfigurationSpace):
        df = pd.DataFrame(search.cv_results_)
        timestamps = df['mean_fit_time'].cumsum()

        candidates = []
        for idx, row in df.iterrows():
            config = Configuration(cs, {key.replace('__', ':'): value for key, value in row['params'].items()})

            candidate = Candidate(str(idx),
                                  1,
                                  'Success' if row['mean_test_score'] > 0 else 'Failure',
                                  row['mean_test_score'],
                                  {
                                      'timestamp': timestamps[idx],
                                      'training_time': row['mean_fit_time'],
                                      'prediction_time': row['mean_score_time']
                                  },
                                  config,
                                  'Random Search' if isinstance(search, RandomizedSearchCV) else 'Grid Search',
                                  search.best_estimator_ if idx == search.best_index_ else None,
                                  lambda y: y)
            candidates.append(candidate)

        return CandidateStructure('0', cs, search.best_estimator_, candidates)

    if not hasattr(search.best_estimator_, 'steps'):
        raise ValueError('XAutoML only supports pipelines')

    cs = parse_config_space()
    structure = parse_structures(cs)
    start = start_time if start_time is not None else time.time()
    metric = metric if metric is not None else (search.scoring if isinstance(search.scoring, str) else 'unknown')

    meta = MetaInformation('scikit-learn',
                           start,
                           start + structure.configs[-1].runtime['timestamp'],
                           metric,
                           False,
                           1, len(structure.configs),
                           float(search.best_score_),
                           None, None, {})

    return RunHistory(meta, None, [structure], Ensemble(search.best_estimator_, {str(search.best_index_): 1.}),
                      Explanations({}, {}))


def import_optuna(study: 'optuna.study.Study', models: Dict[int, Pipeline], metric: str = 'unknown') -> RunHistory:
    """
    Import the RunHistory from an optuna study

    :param study: fitted optuna study
    :param models: dict of fitted pipelines with the corresponding trial number
    :param metric: optional metric used during the optimization
    """

    from optuna.distributions import DiscreteUniformDistribution, LogUniformDistribution, CategoricalDistribution, \
        IntUniformDistribution, IntLogUniformDistribution, UniformDistribution
    from ConfigSpace import ConfigurationSpace, UniformFloatHyperparameter, UniformIntegerHyperparameter, \
        CategoricalHyperparameter, Configuration

    def parse_config_space() -> ConfigurationSpace:
        search_definition = study._storage._studies[0].param_distribution

        step_configspace = {}
        for name, dist in search_definition.items():
            tokens = name.split('__')
            if len(tokens) > 1:
                step, param_name = ':'.join(tokens[:-1]), tokens[-1]
            else:
                step, param_name = None, tokens[0]

            if step not in step_configspace:
                step_configspace[step] = ConfigurationSpace()

            if isinstance(dist, IntUniformDistribution):
                hp = UniformIntegerHyperparameter(param_name, dist.low, dist.high)
            elif isinstance(dist, IntLogUniformDistribution):
                hp = UniformIntegerHyperparameter(param_name, dist.low, dist.high, log=True)
            elif isinstance(dist, UniformDistribution) or isinstance(dist, DiscreteUniformDistribution):
                hp = UniformFloatHyperparameter(param_name, dist.low, dist.high)
            elif isinstance(dist, LogUniformDistribution):
                hp = UniformFloatHyperparameter(param_name, dist.low, dist.high, log=True)
            elif isinstance(dist, CategoricalDistribution):
                hp = CategoricalHyperparameter(param_name, dist.choices)
            else:
                raise ValueError(f'Unknown hyperparameter {name}')

            step_configspace[step].add_hyperparameter(hp)

        configspace = ConfigurationSpace()
        for step, cs in step_configspace.items():
            if step is None:
                configspace.add_hyperparameters(cs.get_hyperparameters())
            else:
                configspace.add_configuration_space(step, cs)

        return configspace

    def parse_structures():
        candidates = []
        for trial in study.trials:
            candidates.append(
                Candidate(str(trial.number), 1,
                          'Success' if trial.state.COMPLETE == trial.state else 'Failure', trial.value,
                          {
                              'timestamp': (trial.datetime_start - start).total_seconds(),
                              'training_time': (trial.datetime_complete - trial.datetime_start).total_seconds()
                          },
                          Configuration(cs, {key.replace('__', ':'): value for key, value in trial.params.items()}),
                          'Optuna',
                          models.get(trial.number, None), lambda y: y
                          )
            )

        return CandidateStructure('0', cs, candidates[0].model, candidates)

    cs = parse_config_space()
    start = study.trials[0].datetime_start
    structure = parse_structures()

    meta = MetaInformation('optuna',
                           start.timestamp(),
                           start.timestamp() + structure.configs[-1].runtime['timestamp'],
                           metric,
                           study.direction == study.direction.MINIMIZE,
                           1, len(structure.configs),
                           float(study.best_value),
                           None, None, study.system_attrs)

    return RunHistory(meta, None, [structure],
                      Ensemble(models[study.best_trial.number], {str(study.best_trial.number): 1.}),
                      Explanations({}, {}))
