import pickle

import joblib
import pandas as pd
from sklearn.datasets import load_iris

from xautoml.adapter import import_dswizard, import_auto_sklearn
from xautoml.main import XAutoML
from xautoml.util.datasets import hearts


def get_31() -> XAutoML:
    with open('res/31/runhistory_31.pkl', 'rb') as f:
        raw = pickle.load(f)

    with open('res/31/ensemble_31.pkl', 'rb') as f:
        ensemble = pickle.load(f)

    structure = raw.data[(0, 2, None)]
    structure.results[2].model_file = 'res/31/models_0-2-2.pkl'

    rh = import_dswizard(raw, ensemble)
    X, y = _load_data('res/31/dataset.pkl')
    return XAutoML(rh, X, y)


def get_1823() -> XAutoML:
    with open('res/1823/runhistory_1823.pkl', 'rb') as f:
        raw = pickle.load(f)

    with open('res/1823/ensemble_1823.pkl', 'rb') as f:
        ensemble = pickle.load(f)

    structure = raw.data[(0, 0, None)]
    structure.results[0].model_file = 'res/1823/models_0-0-0.pkl'

    rh = import_dswizard(raw, ensemble)
    X, y = _load_data('res/7306/dataset.pkl')
    return XAutoML(rh, X, y)


def get_7306() -> XAutoML:
    with open('res/7306/runhistory_7306.pkl', 'rb') as f:
        raw = pickle.load(f)

    with open('res/7306/ensemble_7306.pkl', 'rb') as f:
        ensemble = pickle.load(f)

    structure = raw.data[(0, 0, None)]
    structure.results[0].model_file = 'res/7306/models_0-0-0.pkl'

    rh = import_dswizard(raw, ensemble)
    X, y = _load_data('res/7306/dataset.pkl')
    return XAutoML(rh, X, y)


def get_168746() -> XAutoML:
    with open('res/168746/runhistory_168746.pkl', 'rb') as f:
        raw = pickle.load(f)

    with open('res/168746/ensemble_168746.pkl', 'rb') as f:
        ensemble = pickle.load(f)

    structure = raw.data[(0, 0, None)]
    structure.results[0].model_file = 'res/168746/models_0-0-0.pkl'
    structure.results[6].model_file = 'res/168746/models_0-0-6.pkl'
    structure.results[103].model_file = 'res/168746/models_0-0-103.pkl'

    rh = import_dswizard(raw, ensemble)
    X, y = _load_data('res/168746/dataset.pkl')
    return XAutoML(rh, X, y)


def get_fixed_hearts() -> XAutoML:
    with open('/home/marc/phd/code/xautoml/user_study/dswizard/output/fixed/dswizard.pkl', 'rb') as f:
        (raw, ensemble) = joblib.load(f)

    rh = import_dswizard(raw, ensemble)
    X_test, y_test = hearts('/home/marc/phd/code/xautoml/xautoml/tests/res/autosklearn_hearts/heart.csv', test=True)
    return XAutoML(rh, X_test, y_test)


def get_autosklearn() -> XAutoML:
    with open('res/autosklearn/auto-sklearn_breast_cancer.pkl', 'rb') as f:
        raw = pickle.load(f)

    rh = import_auto_sklearn(raw)
    X, y = _load_data('res/autosklearn/dataset.pkl')
    return XAutoML(rh, X, y)


def get_autosklearn_categorical() -> XAutoML:
    with open('res/autosklearn_categorical/auto-sklearn_1461.pkl', 'rb') as f:
        raw = pickle.load(f)

    rh = import_auto_sklearn(raw)
    X, y = _load_data('res/autosklearn_categorical/dataset.pkl')
    return XAutoML(rh, X, y)


def get_autosklearn_iris() -> XAutoML:
    with open('res/autosklearn/auto-sklearn_iris.pkl', 'rb') as f:
        raw = joblib.load(f)

    rh = import_auto_sklearn(raw)
    X, y = load_iris(return_X_y=True, as_frame=True)
    return XAutoML(rh, X, y)


def get_autosklearn_hearts() -> XAutoML:
    with open('/home/marc/phd/code/xautoml/user_study/auto-sklearn/output/autosklearn.pkl', 'rb') as f:
        raw = joblib.load(f)

    rh = import_auto_sklearn(raw)
    X_test, y_test = hearts('/home/marc/phd/code/xautoml/xautoml/tests/res/autosklearn_hearts/heart.csv', test=True)
    return XAutoML(rh, X_test, y_test)


def _load_data(data_file) -> tuple[pd.DataFrame, pd.Series]:
    with open(data_file, 'rb') as f:
        X, y, feature_labels = joblib.load(f)
    X = pd.DataFrame(X, columns=feature_labels).convert_dtypes()
    y = pd.Series(y)

    return X, y
