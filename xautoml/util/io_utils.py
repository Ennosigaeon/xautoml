import warnings

import joblib
import numpy as np
from sklearn.pipeline import Pipeline

from xautoml.output import OutputCalculator, RAW
from xautoml.util.constants import DSWIZARD


def load_output_dataframe(pipeline: Pipeline, step: str, X: np.ndarray, feature_labels: list[str]):
    with warnings.catch_warnings(record=True) as w:
        inputs, outputs = OutputCalculator.calculate_outputs(pipeline, X, None, feature_labels, RAW)
        if step in outputs:
            return outputs[step]
        else:
            raise ValueError(f'Unknown step name {step}')


def load_input_data(data_file: str, framework: str = DSWIZARD) -> tuple[np.ndarray, np.ndarray, list[str]]:
    if framework == DSWIZARD:
        with open(data_file, 'rb') as f:
            X, y, feature_labels = joblib.load(f)
        return X, y, feature_labels
    else:
        raise ValueError('Unsupported framework {}'.format(framework))


def load_pipeline(model_file: str, framework: str = DSWIZARD) -> Pipeline:
    if framework == DSWIZARD:
        with open(model_file, 'rb') as f:
            model = joblib.load(f)
            return model
    else:
        raise ValueError('Unsupported framework {}'.format(framework))
