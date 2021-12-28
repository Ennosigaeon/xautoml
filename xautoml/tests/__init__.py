import pickle

import joblib
import pandas as pd

from xautoml.adapter import import_dswizard, import_auto_sklearn
from xautoml.main import XAutoML


def get_31() -> XAutoML:
    with open('res/31/runhistory_31.pkl', 'rb') as f:
        raw = pickle.load(f)

    structure = raw.data[(0, 2, None)]
    structure.results[2].model_file = 'res/31/models_0-2-2.pkl'

    rh = import_dswizard(raw)
    X, y = _load_data('res/31/dataset.pkl')
    return XAutoML(rh, X, y)


def get_7306() -> XAutoML:
    with open('res/7306/runhistory_7306.pkl', 'rb') as f:
        raw = pickle.load(f)

    structure = raw.data[(0, 0, None)]
    structure.results[0].model_file = 'res/7306/models_0-0-0.pkl'

    rh = import_dswizard(raw)
    X, y = _load_data('res/7306/dataset.pkl')
    return XAutoML(rh, X, y)


def get_168746() -> XAutoML:
    with open('res/168746/runhistory_168746.pkl', 'rb') as f:
        raw = pickle.load(f)

    structure = raw.data[(0, 0, None)]
    structure.results[0].model_file = 'res/168746/models_0-0-0.pkl'
    structure.results[6].model_file = 'res/168746/models_0-0-6.pkl'
    structure.results[103].model_file = 'res/168746/models_0-0-103.pkl'

    rh = import_dswizard(raw)
    X, y = _load_data('res/168746/dataset.pkl')
    return XAutoML(rh, X, y)


def get_autosklearn() -> XAutoML:
    with open('res/autosklearn/auto-sklearn.pkl', 'rb') as f:
        raw = pickle.load(f)

    rh = import_auto_sklearn(raw)
    X, y = _load_data('res/autosklearn/dataset.pkl')
    return XAutoML(rh, X, y)


def get_autosklearn_categorical() -> XAutoML:
    with open('res/autosklearn_categorical/auto-sklearn.pkl', 'rb') as f:
        raw = pickle.load(f)

    rh = import_auto_sklearn(raw)
    X, y = _load_data('res/autosklearn_categorical/dataset.pkl')
    return XAutoML(rh, X, y)


def _load_data(data_file) -> tuple[pd.DataFrame, pd.Series]:
    with open(data_file, 'rb') as f:
        X, y, feature_labels = joblib.load(f)
    X = pd.DataFrame(X, columns=feature_labels).convert_dtypes()
    y = pd.Series(y)

    return X, y
