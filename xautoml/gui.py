from typing import List

import pandas as pd

from xautoml.main import as_json


@as_json
def get_columns(path: str) -> List[str]:
    df = pd.read_csv(path)
    return df.columns.to_list()


@as_json
def validate_configuration(config_str: str) -> List[bool]:
    try:
        config = eval(config_str)
        if not isinstance(config, dict):
            return [False]

        if not all([isinstance(k, str) for k in config.keys()]):
            return [False]
        return [True]
    except SyntaxError:
        return [False]


@as_json
def dataset_preview(path: str):
    with pd.option_context('display.max_columns', 1024, 'display.max_rows', 30, 'display.min_rows', 20):
        return {'preview': pd.read_csv(path)._repr_html_()}
