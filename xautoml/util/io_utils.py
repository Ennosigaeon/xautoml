import warnings
from typing import Union

import joblib
import pandas as pd
from ConfigSpace import ConfigurationSpace, Configuration, CategoricalHyperparameter, Constant
from ConfigSpace.util import impute_inactive_values
from ConfigSpace.read_and_write import json as config_json
from sklearn.pipeline import Pipeline

from xautoml.output import OutputCalculator, RAW
from xautoml.util.constants import DSWIZARD


def load_output_dataframe(pipeline: Pipeline, step: str, X: pd.DataFrame):
    with warnings.catch_warnings(record=True) as w:
        inputs, outputs = OutputCalculator.calculate_outputs(pipeline, X, None, RAW)
        if step in outputs:
            return outputs[step]
        else:
            raise ValueError(f'Unknown step name {step}')


def deserialize_configuration_space(cs: dict) -> tuple[ConfigurationSpace, set[str]]:
    constants = set()

    if 'name' in cs:
        config_space = ConfigurationSpace(name=cs['name'])
    else:
        config_space = ConfigurationSpace()
    for hyperparameter in cs['hyperparameters']:
        hp = config_json._construct_hyperparameter(hyperparameter)
        if isinstance(hp, Constant):
            constants.add(hp.name)
        else:
            config_space.add_hyperparameter(hp)
    for condition in cs['conditions']:
        if condition['child'] in constants or condition['parent'] in constants:
            continue
        config_space.add_condition(config_json._construct_condition(condition, config_space))

    return config_space, constants


def configs_as_dataframe(cs: ConfigurationSpace,
                         configs: list[dict],
                         remove: set[str] = None) -> Union[pd.DataFrame, tuple[ConfigurationSpace, pd.DataFrame]]:
    if remove is None:
        remove = {}

    def prep_config(c: dict):
        c = {key: value for key, value in c.items() if key not in remove}
        conf = impute_inactive_values(Configuration(cs, c))
        return conf.get_dictionary()

    configs_ = [prep_config(c) for c in configs]

    X = pd.DataFrame(configs_, columns=cs.get_hyperparameter_names())
    pruned_cs = ConfigurationSpace()
    for hp in cs.get_hyperparameters():
        if isinstance(hp, CategoricalHyperparameter):
            X[hp.name] = X[hp.name].map(hp._inverse_transform)

        if X[hp.name].nunique() == 1 and X.shape[0] > 1:
            X.drop(hp.name, axis=1, inplace=True)
        else:
            pruned_cs.add_hyperparameter(hp)

    for condition in cs.get_conditions():
        try:
            pruned_cs.add_condition(condition)
        except ValueError:
            # Either parent or child hp was pruned from cs
            pass

    return pruned_cs, X


def load_input_data(data_file: str, framework: str = DSWIZARD) -> tuple[pd.DataFrame, pd.Series]:
    if framework == DSWIZARD:
        with open(data_file, 'rb') as f:
            X, y, feature_labels = joblib.load(f)
        return pd.DataFrame(X, columns=feature_labels).convert_dtypes(), pd.Series(y)
    else:
        raise ValueError('Unsupported framework {}'.format(framework))


def load_pipeline(model_file: str, framework: str = DSWIZARD) -> Pipeline:
    if framework == DSWIZARD:
        with open(model_file, 'rb') as f:
            model = joblib.load(f)
            return model
    else:
        raise ValueError('Unsupported framework {}'.format(framework))
