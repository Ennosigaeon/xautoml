import time
from typing import Union

import pandas as pd
from ConfigSpace import ConfigurationSpace, Configuration, UniformFloatHyperparameter, CategoricalHyperparameter

from xautoml.models import RunHistory, MetaInformation, Explanations, CandidateStructure, Candidate, Ensemble


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


