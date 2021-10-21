import joblib
from sklearn.pipeline import Pipeline

from xautoml.output import OutputCalculator, RAW


def test_outputs():
    with open('/scripts/run/3913.bak/dataset.pkl', 'rb') as f:
        X, y, feature_labels = joblib.load(f)
    #
    with open('/scripts/run/3913.bak/models/models_0-13-1.pkl', 'rb') as f:
        model: Pipeline = joblib.load(f)

    idx = [step[0] for step in model.steps].index('323')
    sub_pipeline = Pipeline(model.steps[idx:])
    prev_step = model.steps[idx - 1][0]

    df_handler = OutputCalculator()
    X_int = df_handler.calculate_outputs(model, X, feature_labels, method=RAW)[prev_step]

    a = 0


if __name__ == '__main__':
    test_outputs()
