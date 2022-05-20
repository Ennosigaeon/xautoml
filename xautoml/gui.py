import json
from typing import List, Dict, Any

import pandas as pd

from xautoml.main import as_json


@as_json
def get_columns(path: str) -> List[str]:
    df = pd.read_csv(path)
    return df.columns.to_list()


def _parse_config(config_str: str) -> Dict:
    try:
        return eval(config_str)
    except SyntaxError:
        raise ValueError(f'Unable to parse config_str `{config_str}`')


@as_json
def validate_configuration(config_str: str) -> List[bool]:
    try:
        config = _parse_config(config_str)
        if not isinstance(config, dict):
            return [False]

        if not all([isinstance(k, str) for k in config.keys()]):
            return [False]
        return [True]
    except ValueError:
        return [False]


@as_json
def dataset_preview(path: str):
    with pd.option_context('display.max_columns', 1024, 'display.max_rows', 30, 'display.min_rows', 20):
        return {'preview': pd.read_csv(path)._repr_html_()}


def optimize(optimizer: str, duration: int, timeout: int, metric: str, config_str: str, input_file: str, target: str):
    valid_optimizers = ('dswizard', 'auto-sklearn')
    if optimizer not in valid_optimizers:
        raise ValueError(f'{optimizer} is no valid optimizer. Expected one of {valid_optimizers}')

    if not isinstance(duration, int):
        raise ValueError(f'duration has to be an int but was {type(duration)}')
    if not isinstance(timeout, int):
        raise ValueError(f'timeout has to be an int but was {type(timeout)}')

    additional_config = _parse_config(config_str)

    df = pd.read_csv(input_file)
    y = df[target]
    X = df.drop(columns=[target])

    if optimizer == 'dswizard':
        return _optimize_dswizard(X, y, duration, timeout, metric, additional_config)
    elif optimizer == 'auto-sklearn':
        return _optimize_auto_sklearn(X, y, duration, timeout, metric, additional_config)


def _optimize_dswizard(X: pd.DataFrame, y: pd.Series, duration: int, timeout: int, metric: str, config: Dict[str, Any]):
    from dswizard.core.master import Master
    from dswizard.core.model import Dataset
    from dswizard.util import util
    from xautoml.adapter import import_dswizard

    util.setup_logging()

    ds = Dataset(X.values, y.values, task=0, metric=metric, feature_names=X.columns.to_list())
    master = Master(
        ds=ds,
        wallclock_limit=duration,
        cutoff=timeout,
        working_directory='_dswizard_',
        **config
    )

    pipeline, run_history, ensemble = master.optimize()

    rh = import_dswizard(run_history, ensemble)

    with open('dswizard.xautoml', 'w') as f:
        json.dump(rh.as_dict(), f)


def _optimize_auto_sklearn(X: pd.DataFrame, y: pd.Series, duration: int, timeout: int, metric: str,
                           config: Dict[str, Any]):
    from autosklearn import metrics
    import autosklearn.classification
    import os
    import shutil
    from xautoml.adapter import import_auto_sklearn

    metric = metrics.CLASSIFICATION_METRICS[metric]

    workdir = './_auto-sklearn_/'
    if os.path.exists(workdir):
        shutil.rmtree(workdir)

    automl = autosklearn.classification.AutoSklearnClassifier(
        time_left_for_this_task=duration,
        per_run_time_limit=timeout,
        metric=metric,
        # Optional: Set the following three parameters to analyse all models generate by auto-sklearn. Otherwise, you can only inspect the top 50 models.
        delete_tmp_folder_after_terminate=False,
        max_models_on_disc=None,
        tmp_folder=workdir,
        logging_config={
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': {'simple': {'format': '[%(levelname)s] [%(asctime)s:%(name)s] %(message)s'}},
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                    'level': 'INFO',
                    'formatter': 'simple',
                    'stream': 'ext://sys.stdout'
                },
                'file_handler': {
                    'class': 'logging.FileHandler',
                    'level': 'DEBUG',
                    'formatter': 'simple',
                    'filename': 'autosklearn.log'
                },
                'distributed_logfile': {
                    'class': 'logging.FileHandler',
                    'level': 'DEBUG',
                    'formatter': 'simple',
                    'filename': 'distributed.log'
                }
            },
            'root': {
                'level': 'DEBUG',
                'handlers': ['console', 'file_handler']
            },
            'loggers': {
                'autosklearn.metalearning': {
                    'level': 'DEBUG',
                    'handlers': ['file_handler'],
                },
                'autosklearn.automl_common.utils.backend': {
                    'level': 'DEBUG',
                    'handlers': ['file_handler'],
                    'propagate': 'no'
                },
                'smac.intensification.intensification.Intensifier': {
                    'level': 'INFO',
                    'handlers': ['file_handler', 'console'],
                },
                'smac.optimizer.local_search.LocalSearch': {
                    'level': 'INFO',
                    'handlers': ['file_handler', 'console'],
                },
                'smac.optimizer.smbo.SMBO': {
                    'level': 'INFO',
                    'handlers': ['file_handler', 'console'],
                },
                'EnsembleBuilder': {
                    'level': 'INFO',
                    'handlers': ['file_handler', 'console'],
                },
                'distributed': {
                    'level': 'INFO',
                    'handlers': ['file_handler', 'console'],
                },
            }
        },
        **config
    )
    automl.fit(X, y, dataset_name='data')

    rh = import_auto_sklearn(automl)

    with open('auto_sklearn.xautoml', 'w') as f:
        json.dump(rh.as_dict(), f)
