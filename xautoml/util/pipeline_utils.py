import numpy as np
from sklearn.pipeline import Pipeline

from xautoml.output import OutputCalculator, RAW
from xautoml.util.constants import SOURCE


def get_subpipeline(pipeline: Pipeline, start: str, X: np.ndarray, feature_labels: list[str]):
    # TODO what if start is in ColumnTransformer?

    if start != SOURCE:
        df_handler = OutputCalculator()
        df = df_handler.calculate_outputs(pipeline, X, feature_labels, method=RAW)[start]
        X = df.values
        feature_labels = df.columns.tolist()

        start_idx = [step[0] for step in pipeline.steps].index(start) + 1
        pipeline = Pipeline(pipeline.steps[start_idx:])

    return pipeline, X, feature_labels
