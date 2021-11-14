import warnings
from typing import Union

import numpy as np
import pandas as pd

from xautoml.util.constants import SOURCE, SINK
from xautoml.util.mlinsights import alter_pipeline_for_debugging, enumerate_pipeline_models, get_component_name

COMPLETE = 0
DESCRIPTION = 1
RAW = 2


class OutputCalculator:

    @staticmethod
    def load_data(d: dict, y: np.ndarray, method: int) -> Union[str, pd.DataFrame]:
        if len(d) == 0:
            if method != RAW:
                return ''
            else:
                return pd.DataFrame()

        data = d['predict'] if 'predict' in d else d['transform']
        feature_names = d['get_feature_names_out']

        df = pd.DataFrame(data, columns=feature_names)
        if method == COMPLETE:
            # Add target column for displaying in raw_dataset.tsx
            df['TARGET'] = y
            return df._repr_html_()
        elif method == DESCRIPTION:
            return df.describe()._repr_html_()
        elif method == RAW:
            return df
        else:
            raise ValueError('Unknown method {}'.format(method))

    @staticmethod
    def calculate_outputs(pipeline, X, y, feature_labels, method: int = RAW) -> dict[str, Union[str, pd.DataFrame]]:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            alter_pipeline_for_debugging(pipeline)
            pipeline.predict(X)
            pipeline.get_feature_names_out(feature_labels)

            result = {}
            for coordinate, model, subset in enumerate_pipeline_models(pipeline):
                output = OutputCalculator.load_data(model._debug.outputs, y, method)

                if len(coordinate) == 1:
                    # Populate SINK and SOURCE instead of single step
                    input = OutputCalculator.load_data(model._debug.inputs, y, method)

                    result[SOURCE] = input
                    result[SINK] = output
                else:
                    step_name = get_component_name(coordinate, pipeline)
                    result[step_name] = output

            return result
