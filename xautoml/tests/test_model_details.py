import joblib
from sklearn.pipeline import Pipeline

from xautoml.model_details import ModelDetails


def test_decision_tree():
    with open('/scripts/run/3913.bak/dataset.pkl', 'rb') as f:
        X, y, feature_labels = joblib.load(f)

    with open('/scripts/run/3913.bak/models/models_0-13-1.pkl', 'rb') as f:
        model: Pipeline = joblib.load(f)

    details = ModelDetails()

    res = details.calculate_decision_tree(X, model, feature_labels)


if __name__ == '__main__':
    test_decision_tree()
