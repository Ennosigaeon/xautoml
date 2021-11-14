import glob
import os
import re
import warnings
from typing import Union

import joblib
import numpy as np
from sklearn.pipeline import Pipeline

from xautoml.output import OutputCalculator, RAW
from xautoml.util.constants import DSWIZARD


def load_output_dataframe(pipeline: Pipeline, step: str, X: np.ndarray, feature_labels: list[str]):
    with warnings.catch_warnings(record=True) as w:
        outputs = OutputCalculator.calculate_outputs(pipeline, X, None, feature_labels, RAW)
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


def load_pipeline(model_dir: str,
                  pipeline: str = None,
                  framework: str = DSWIZARD) -> Union[Pipeline, dict[str, Pipeline]]:
    if framework == DSWIZARD:
        if pipeline is None:
            model_files = glob.glob('{}/*.pkl'.format(model_dir))
        else:
            model_files = [
                os.path.join(model_dir, 'models_{}.pkl'.format(re.sub(r'0(\d)', r'\1', pipeline).replace(':', '-')))
            ]

        models: dict[str, Pipeline] = {}
        for model_file in model_files:
            cid = model_file.split('/')[-1].split('.')[0].replace('-', ':')
            with open(model_file, 'rb') as f:
                model = joblib.load(f)
                if pipeline is not None:
                    return model
                else:
                    models[cid] = model
        return models
    else:
        raise ValueError('Unsupported framework {}'.format(framework))
