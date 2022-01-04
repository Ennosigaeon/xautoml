import numpy as np
import openml
import pandas as pd
from openml import OpenMLClassificationTask
from sklearn.model_selection import train_test_split


def openml_task(task: int, fold: int, train: bool = False, test: bool = False):
    if test == train:
        raise ValueError('Please set either train or test to True')

    # noinspection PyTypeChecker
    task: OpenMLClassificationTask = openml.tasks.get_task(task)
    train_indices, test_indices = task.get_train_test_split_indices(fold=fold)

    X, y = task.get_X_and_y(dataset_format='dataframe')

    if train:
        X = X.iloc[train_indices, :]
        y = y.iloc[train_indices]
    else:
        X = X.iloc[test_indices, :]
        y = y.iloc[test_indices]

    return X.reset_index(drop=True), y.reset_index(drop=True)


def hearts(file: str, train: bool = False, test: bool = False):
    if test == train:
        raise ValueError('Please set either train or test to True')

    data = pd.read_csv(file)
    X = data.loc[:, data.columns[:-1]]
    y = data.loc[:, data.columns[-1]]

    X.loc[:, 'Sex'] = X.Sex.astype('category')
    X.loc[:, 'ChestPainType'] = X.ChestPainType.astype('category')
    X.loc[:, 'RestingECG'] = X.RestingECG.astype('category')
    X.loc[:, 'ExerciseAngina'] = X.ExerciseAngina.astype('category')
    X.loc[:, 'ST_Slope'] = X.ST_Slope.astype('category')

    X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=1)

    if train:
        X = X_train
        y = y_train
    else:
        X = X_test
        y = y_test

    return X.reset_index(drop=True), y.reset_index(drop=True)


def down_sample(X: pd.DataFrame, y: pd.Series, n_samples: int) -> tuple[pd.DataFrame, pd.Series]:
    if X.shape[0] > n_samples:
        idx = np.random.choice(X.shape[0], size=n_samples, replace=False)
        X = X.loc[idx, :].reset_index(drop=True)
        y = y.loc[idx].reset_index(drop=True)

    return X, y
