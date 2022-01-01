from typing import Union

import numpy as np
import openml
import pandas as pd
from ConfigSpace import ConfigurationSpace, Configuration, CategoricalHyperparameter
from ConfigSpace.util import impute_inactive_values
from openml import OpenMLClassificationTask


def openml_task(task: int, fold: int):
    # noinspection PyTypeChecker
    task: OpenMLClassificationTask = openml.tasks.get_task(task)
    train_indices, test_indices = task.get_train_test_split_indices(fold=fold)

    X, y = task.get_X_and_y(dataset_format='dataframe')
    X_test = X.iloc[test_indices, :].reset_index(drop=True)
    y_test = y.iloc[test_indices].reset_index(drop=True)

    return X_test, y_test


def configs_as_dataframe(cs: ConfigurationSpace,
                         configs: list[Configuration]) -> Union[pd.DataFrame, tuple[ConfigurationSpace, pd.DataFrame]]:
    def prep_config(c: Configuration):
        conf = impute_inactive_values(c)
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


def down_sample(X: pd.DataFrame, y: pd.Series, n_samples: int) -> tuple[pd.DataFrame, pd.Series]:
    if X.shape[0] > n_samples:
        idx = np.random.choice(X.shape[0], size=n_samples, replace=False)
        X = X.loc[idx, :].reset_index(drop=True)
        y = y.loc[idx].reset_index(drop=True)

    return X, y
