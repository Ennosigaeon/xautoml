from typing import Dict

from sklearn.pipeline import Pipeline

from xautoml.models import RunHistory, MetaInformation, Explanations, CandidateStructure, Candidate, Ensemble


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
