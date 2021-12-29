import warnings
from collections import OrderedDict

import joblib
from ConfigSpace import ConfigurationSpace
from ConfigSpace.read_and_write import json as config_json
from sklearn.pipeline import Pipeline

from xautoml.main import RunHistory, MetaInformation, Explanations, CandidateStructure, Candidate, CandidateId, \
    ConfigExplanation


def import_dswizard(dswizard: any) -> RunHistory:
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
                                         pipeline))
            except FileNotFoundError:
                warnings.warn('Model {} does not exist. Skipping it'.format(res.model_file))
        structures.append(CandidateStructure(struct.cid.without_config().external_name,
                                             struct.configspace, struct.pipeline, configs))

    config_explanations = {}
    for cid, exp in dswizard.complete_data['explanations']['configs'].items():
        config_explanations[cid] = ConfigExplanation(exp['candidates'], exp['loss'], exp['marginalization'])
    explanations = Explanations(dswizard.complete_data['explanations']['structures'], config_explanations)

    return RunHistory(meta, default_cs, structures, explanations)


def import_auto_sklearn(automl: any):
    from autosklearn.pipeline.components.data_preprocessing import DataPreprocessorChoice
    from dswizard.components.sklearn import ColumnTransformerComponent
    from dswizard.pipeline.pipeline import FlexiblePipeline

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
            'dask_client': automl.automl_._dask_client,
            'precision': automl.automl_.precision,
            'disable_evaluator_output': automl.automl_._disable_evaluator_output,
            'get_smac_objective_callback': automl.automl_._get_smac_object_callback,
            'smac_scenario_args': automl.automl_._smac_scenario_args,
            'logging_config': automl.automl_.logging_config,
        }

        meta = MetaInformation('auto-sklearn',
                               start_time, start_time + automl.time_left_for_this_task,
                               metric.name, metric._sign == -1,
                               1, len(automl.automl_.models_),
                               trajectory[-1][0] if metric._sign == -1. else metric._optimum - trajectory[-1][0],
                               None, None, arguments
                               )

        return meta

    def build_structures() -> dict[CandidateId, CandidateStructure]:
        def as_flexible_pipeline(simple_pipeline: Pipeline) -> FlexiblePipeline:
            def suffix_name(name, suffix) -> str:
                if suffix is None:
                    return name
                elif name in suffix:
                    return name
                else:
                    return name
                    # return '{}:{}'.format(name, suffix)

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
                        if isinstance(s, DataPreprocessorChoice):
                            name = '{}:{}'.format(name, s.choice.__class__.__module__.split('.')[-1])

                        s_, suffix = convert_component(s)
                        steps.append((suffix_name(name, suffix), s_))
                    return FlexiblePipeline(steps), None

                return component, suffix

            a = convert_component(simple_pipeline)[0]
            return a

        structures = OrderedDict()
        for key, value in runhistory.data.items():
            try:
                pipeline = automl.automl_.models_[(automl.seed, key.config_id, key.budget)]
                flexible_pipeline = as_flexible_pipeline(pipeline)
            except KeyError:
                # Skip results without fitted model for now
                # TODO also load failed configurations
                continue

            try:
                struct_key = str(flexible_pipeline.get_hyperparameter_search_space())
                cs = None
            except AttributeError:
                # Fallback for DummyClassifier
                cs = ConfigurationSpace()
                struct_key = str(cs)

            if struct_key not in structures:
                structure = CandidateStructure('00:{:02d}'.format(len(structures)), cs, flexible_pipeline, [])
                structures[struct_key] = structure
            else:
                structure = structures[struct_key]

            if key.config_id > 1:
                config = automl.automl_.runhistory_.ids_config.get(key.config_id - 1)
            else:
                config = cs.get_default_configuration()
                config.origin = 'Default'

            candidate = Candidate(
                '{}:{:02d}'.format(structure.cid, key.config_id),
                key.budget,
                'SUCCESS' if value.status.name == 'SUCCESS' else 'CRASHED',
                value.cost if metric._sign != 1.0 else metric._optimum - value.cost,
                {
                    'timestamp': value.starttime - meta_information.start_time,
                    'training_time': value.endtime - value.starttime
                },
                config, config.origin,
                pipeline
            )
            structure.configs.append(candidate)

        return {s.cid: s for s in structures.values()}

    metric = automl.automl_._metric
    backend = automl.automl_._backend
    runhistory = automl.automl_.runhistory_
    trajectory = automl.trajectory_

    meta_information = build_meta_information()
    structures = build_structures()

    return RunHistory(meta_information, automl.automl_.configuration_space, list(structures.values()),
                      Explanations({}, {}))