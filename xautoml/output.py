import warnings
from typing import Union, Optional, Tuple, Dict

import numpy as np
import pandas as pd

from xautoml.util.constants import SOURCE, SINK
from xautoml.util.mlinsights import alter_pipeline_for_debugging, enumerate_pipeline_models, get_component

COMPLETE = 0
DESCRIPTION = 1
RAW = 2


class OutputCalculator:

    @staticmethod
    def _load_data(d: Union[Dict, pd.DataFrame],
                   y: pd.Series,
                   y_pred: pd.Series,
                   confidence: np.ndarray,
                   method: int) -> Union[str, pd.DataFrame]:

        if isinstance(d, dict):
            if len(d) == 0:
                if method != RAW:
                    return ''
                else:
                    return pd.DataFrame()

            data = d['predict'] if 'predict' in d else d['transform']
            df = pd.DataFrame(data, columns=d.get('get_feature_names_out', None))
        else:
            df = d

        if method == COMPLETE:
            # Add target column for displaying in raw_dataset.tsx
            df['TARGET'] = y
            df['PREDICTION'] = y_pred
            df['CONFIDENCE'] = confidence
            return df._repr_html_()
        elif method == DESCRIPTION:
            return df.describe()._repr_html_()
        elif method == RAW:
            return df
        else:
            raise ValueError('Unknown method {}'.format(method))

    @staticmethod
    def calculate_outputs(pipeline, X: pd.DataFrame, y: Optional[pd.Series], method: int = RAW) -> \
        Tuple[Dict[str, Union[str, pd.DataFrame]], Dict[str, Union[str, pd.DataFrame]]]:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            alter_pipeline_for_debugging(pipeline)
            y_pred = pipeline.predict(X)
            y_proba = pipeline.predict_proba(X)
            confidence = np.max(y_proba, axis=1)

            try:
                pipeline.get_feature_names_out(X.columns)
            except AttributeError:
                pass

            inputs = {}
            outputs = {}
            for coordinate, model, subset in enumerate_pipeline_models(pipeline):
                if not hasattr(model, '_debug'):
                    continue

                input_ = OutputCalculator._load_data(model._debug.inputs, y, y_pred, confidence, method)
                output = OutputCalculator._load_data(model._debug.outputs, y, y_pred, confidence, method)

                if len(coordinate) == 1:
                    # Populate SINK and SOURCE instead of single step
                    inputs[SOURCE] = input_
                    outputs[SOURCE] = input_

                    inputs[SINK] = output
                    outputs[SINK] = output
                else:
                    step_name, _ = get_component(coordinate, pipeline)
                    inputs[step_name] = input_
                    outputs[step_name] = output

            return inputs, outputs
