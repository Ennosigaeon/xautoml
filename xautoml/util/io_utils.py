import glob
import os
import re
import warnings
from typing import Union

import joblib
import numpy as np
import pandas as pd
from mlinsights.helpers.pipeline import alter_pipeline_for_debugging, enumerate_pipeline_models
from sklearn.pipeline import Pipeline

from xautoml.util.constants import DSWIZARD, SOURCE, SINK


def load_output_dataframe(pipeline: Pipeline, step: str, X: np.ndarray, feature_labels: list[str]):
    with warnings.catch_warnings(record=True) as w:
        alter_pipeline_for_debugging(pipeline)
        y_pred = pipeline.predict(X)

        if step == SOURCE:
            return pd.DataFrame(X, columns=feature_labels)
        if step == SINK:
            return pd.DataFrame(y_pred)

        step_names = ['Pipeline'] + list([x[0] for x in pipeline.steps])
        for s, data in zip(step_names, enumerate_pipeline_models(pipeline)):
            if s != step:
                continue

            _, model, _ = data
            assert len(model._debug.outputs) == 1
            data = next(iter(model._debug.outputs.values()))

            if len(data.shape) == 2 and data.shape[1] == len(feature_labels):
                columns = feature_labels
            else:
                columns = None

            df = pd.DataFrame(data, columns=columns)
            return df


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
