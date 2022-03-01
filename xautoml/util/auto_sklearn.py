from typing import List

import pandas as pd

from sklearn.base import TransformerMixin, BaseEstimator


class AutoSklearnUtils:

    @staticmethod
    def isFeatTypeSplit(pipe):
        try:
            from autosklearn.pipeline.components.data_preprocessing.feature_type import FeatTypeSplit
            return isinstance(pipe, FeatTypeSplit)
        except ImportError:
            return False

    @staticmethod
    def isChoice(pipe):
        try:
            from autosklearn.pipeline.components.base import AutoSklearnChoice
            return isinstance(pipe, AutoSklearnChoice)
        except ImportError:
            return False

    @staticmethod
    def isDataPreprocessorChoice(pipe):
        try:
            from autosklearn.pipeline.components.data_preprocessing import DataPreprocessorChoice
            return isinstance(pipe, DataPreprocessorChoice)
        except ImportError:
            return False

    @staticmethod
    def patchCategoricalPreprocessing(steps: List):
        try:
            from autosklearn.pipeline.components.data_preprocessing.category_shift.category_shift import CategoryShift
            from autosklearn.pipeline.components.data_preprocessing.minority_coalescense import CoalescenseChoice

            for i in range(len(steps)):
                name, step = steps[i]

                # Components in auto-sklearn categorical data-preprocessing pipeline can not handle DataFrames as input
                if isinstance(step, CategoryShift) or isinstance(step, CoalescenseChoice):
                    steps[i] = (name, PandasWrapper(step))

            return steps
        except ImportError:
            return steps


class PandasWrapper(TransformerMixin):

    def __init__(self, wrapped):
        self.wrapped = wrapped

    def transform(self, X):
        if isinstance(X, pd.DataFrame):
            X = X.to_numpy(dtype='int')
        return self.wrapped.transform(X)
