import warnings
from typing import Union

import pandas as pd
from mlinsights.helpers.pipeline import alter_pipeline_for_debugging, enumerate_pipeline_models
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline, FeatureUnion

from xautoml.util.constants import SOURCE, SINK

COMPLETE = 0
DESCRIPTION = 1
RAW = 2


class OutputCalculator:

    @staticmethod
    def load_data(d: dict, method: int, feature_labels: list[str]) -> Union[str, pd.DataFrame]:
        if len(d) == 0:
            if method != RAW:
                return ''
            else:
                return pd.DataFrame()

        assert len(d) == 1
        data = next(iter(d.values()))

        if len(data.shape) == 2 and data.shape[1] == len(feature_labels):
            columns = feature_labels
        else:
            columns = None

        df = pd.DataFrame(data, columns=columns)
        if method == COMPLETE:
            return df._repr_html_()
        elif method == DESCRIPTION:
            return df.describe()._repr_html_()
        elif method == RAW:
            return df
        else:
            raise ValueError('Unknown method {}'.format(method))

    @staticmethod
    def calculate_outputs(pipeline, X, feature_labels, method: int = RAW) -> dict[str, Union[str, pd.DataFrame]]:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            alter_pipeline_for_debugging(pipeline)
            pipeline.predict(X)

            result = {}
            for coordinate, model, subset in enumerate_pipeline_models(pipeline):
                output = OutputCalculator.load_data(model._debug.outputs, method, feature_labels=feature_labels)

                if len(coordinate) == 1:
                    # Populate SINK and SOURCE instead of single step
                    input = OutputCalculator.load_data(model._debug.inputs, method, feature_labels=feature_labels)

                    result[SOURCE] = input
                    result[SINK] = output
                else:
                    step = pipeline
                    for idx in coordinate[1:]:
                        if isinstance(step, Pipeline):
                            step_name, step = step.steps[idx]
                        elif isinstance(step, ColumnTransformer):
                            step_name, step, _ = step.transformers[idx]
                        elif isinstance(step, FeatureUnion):
                            step_name, step = step.transformer_list[idx]
                        else:
                            raise ValueError(f'Unknown component {step}')

                    result[step_name] = output

            return result
