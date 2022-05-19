import time
from typing import List, Dict

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
    valid_optimizers = ('dswizard', 'auto-sklearn', 'tpot')
    if optimizer not in valid_optimizers:
        raise ValueError(f'{optimizer} is no valid optimizer. Expected one of {valid_optimizers}')

    if not isinstance(duration, int):
        raise ValueError(f'duration has to be an int but was {type(duration)}')
    if not isinstance(timeout, int):
        raise ValueError(f'timeout has to be an int but was {type(timeout)}')

    additional_config = _parse_config(config_str)

    print('Starting optimization')
    time.sleep(duration / 2)
    print('Progress...')
    time.sleep(duration / 2)
    print('Done')

    return ['foo', 'bar', {'dict': 'value'}]
