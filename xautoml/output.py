import warnings
from typing import Union

import mlinsights
import pandas as pd
from mlinsights.helpers.pipeline import alter_pipeline_for_debugging
from sklearn.base import TransformerMixin, ClassifierMixin, RegressorMixin, BaseEstimator
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
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


def enumerate_pipeline_models(pipe, coor=None, vs=None):
    """
    Enumerates all the models within a pipeline.

    @param      pipe        *scikit-learn* pipeline
    @param      coor        current coordinate
    @param      vs          subset of variables for the model, None for all
    @return                 iterator on models ``tuple(coordinate, model)``

    See notebook :ref:`visualizepipelinerst`.
    """
    if coor is None:
        coor = (0,)
    if pipe == "passthrough":
        class PassThrough:
            "dummy class to help display"
            pass

        yield coor, PassThrough(), vs
    else:
        yield coor, pipe, vs
        if hasattr(pipe, 'transformer_and_mapper_list') and len(pipe.transformer_and_mapper_list):
            # azureml DataTransformer
            raise NotImplementedError(  # pragma: no cover
                "Unable to handle this specific case.")
        elif hasattr(pipe, 'mapper') and pipe.mapper:
            # azureml DataTransformer
            for couple in enumerate_pipeline_models(pipe.mapper, coor + (0,)):
                yield couple
        elif hasattr(pipe, 'built_features'):  # pragma: no cover
            # sklearn_pandas.dataframe_mapper.DataFrameMapper
            for i, (columns, transformers, _) in enumerate(pipe.built_features):
                if isinstance(columns, str):
                    columns = (columns,)
                if transformers is None:
                    yield (coor + (i,)), None, columns
                else:
                    for couple in enumerate_pipeline_models(transformers, coor + (i,), columns):
                        yield couple
        elif isinstance(pipe, Pipeline):
            for i, (_, model) in enumerate(pipe.steps):
                for couple in enumerate_pipeline_models(model, coor + (i,)):
                    yield couple
        elif isinstance(pipe, ColumnTransformer):
            for i, (_, fitted_transformer, column) in enumerate(pipe.transformers_):
                for couple in enumerate_pipeline_models(
                    fitted_transformer, coor + (i,), column):
                    yield couple
        elif isinstance(pipe, FeatureUnion):
            for i, (_, model) in enumerate(pipe.transformer_list):
                for couple in enumerate_pipeline_models(model, coor + (i,)):
                    yield couple
        elif isinstance(pipe, TransformedTargetRegressor):
            raise NotImplementedError(  # pragma: no cover
                "Not yet implemented for TransformedTargetRegressor.")
        elif isinstance(pipe, (TransformerMixin, ClassifierMixin, RegressorMixin)):
            pass
        elif isinstance(pipe, BaseEstimator):  # pragma: no cover
            pass
        else:
            raise TypeError(  # pragma: no cover
                "pipe is not a scikit-learn object: {}\n{}".format(type(pipe), pipe))


# monkey-patch enumerate_pipeline_models
mlinsights.helpers.pipeline.enumerate_pipeline_models = enumerate_pipeline_models
