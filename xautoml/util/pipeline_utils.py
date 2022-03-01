import math
from copy import deepcopy
from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
import pandas as pd
from sklearn.base import TransformerMixin
from sklearn.compose import make_column_selector, ColumnTransformer
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.preprocessing import OrdinalEncoder, FunctionTransformer
from sklearn.tree import _tree, DecisionTreeClassifier
from sklearn.tree._export import _compute_depth
from sklearn.utils.validation import check_is_fitted

from xautoml.output import OutputCalculator, RAW
from xautoml.util.auto_sklearn import AutoSklearnUtils
from xautoml.util.constants import SOURCE, SINK
from xautoml.util.mlinsights import get_component, enumerate_pipeline_models


def get_subpipeline(pipeline: Pipeline,
                    start_after: str,
                    X: pd.DataFrame,
                    y: pd.Series) -> Tuple[Pipeline, pd.DataFrame, List[str]]:
    if start_after == SOURCE or start_after == SINK or start_after == pipeline.steps[-1][0]:
        additional_features = []
    else:
        df_handler = OutputCalculator()
        inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, method=RAW)

        for selected_coordinate, model, subset in enumerate_pipeline_models(pipeline):
            initial_step_name, initial_step = get_component(selected_coordinate, pipeline)
            if initial_step_name == start_after:
                break
        else:
            raise ValueError(f'Unknown step name {start_after}')

        current_step = initial_step
        current_step_name = initial_step_name
        new_input = outputs[initial_step_name]

        # If a pipeline is selected, replace complete pipeline with identity transformation
        if isinstance(current_step, Pipeline):
            current_step = FunctionTransformer()

        for i in range(1, len(selected_coordinate)):
            step_name, step = get_component(selected_coordinate[:-i], pipeline)

            if isinstance(step, Pipeline):
                modified_step = [(current_step_name, current_step)] if current_step != initial_step else []
                steps = modified_step + step.steps[selected_coordinate[-i] + 1:]
                if len(steps) == 0:
                    steps = [(current_step_name, FunctionTransformer())]

                steps = AutoSklearnUtils.patchCategoricalPreprocessing(steps)

                current_step = Pipeline(steps)
                new_input = new_input
            elif isinstance(step, ColumnTransformer) or AutoSklearnUtils.isFeatTypeSplit(step):
                if AutoSklearnUtils.isFeatTypeSplit(step):
                    # noinspection PyUnresolvedReferences
                    step = step.column_transformer

                modified_input = {}
                modified_transformers = []
                for name, transformer, columns in step.transformers_:
                    if isinstance(columns[0], bool) or isinstance(columns[0], int):
                        named_columns = inputs[step_name].columns[columns]
                    elif isinstance(columns[0], str):
                        named_columns = columns
                    else:
                        raise ValueError('Unknown column selector {}'.format(columns))

                    if current_step_name.endswith(name):
                        for col in new_input:
                            modified_input['_{}'.format(col)] = new_input[col]
                        named_columns = new_input.columns.map(lambda col: '_{}'.format(col))

                        modified_step = current_step if isinstance(current_step, Pipeline) else FunctionTransformer()
                        modified_transformers.append((name, modified_step, named_columns))
                    else:
                        for col in named_columns:
                            modified_input[col] = inputs[step_name][col]
                        modified_transformers.append((name, transformer, named_columns))

                new_input = pd.DataFrame(modified_input)
                numerical_transformers = []
                for name, transformer, columns in modified_transformers:
                    numerical_transformers.append((name, transformer, [new_input.columns.get_loc(c) for c in columns]))

                current_step = deepcopy(step)
                current_step.transformers = numerical_transformers
                current_step.transformers_ = numerical_transformers
                current_step.n_features_in_ = new_input.shape[1]
                current_step._n_features = new_input.shape[1]
                current_step._validate_column_callables(new_input)
            elif isinstance(step, FeatureUnion):
                modified_transformers = []
                modified_input = pd.concat([inputs[step_name].copy(), new_input.copy().add_prefix('_')], axis=1)

                for name, transformer in step.transformer_list:
                    if name == current_step_name:
                        modified_step = current_step if isinstance(current_step, Pipeline) else FunctionTransformer()
                        modified_transformers.append(
                            (name, modified_step, inputs[step_name].shape[1] + np.arange(0, new_input.shape[1]))
                        )
                    else:
                        modified_transformers.append((name, transformer, np.arange(inputs[step_name].shape[1])))

                new_input = modified_input

                current_step = ColumnTransformer(modified_transformers)
                current_step.transformers_ = modified_transformers
                current_step.n_features_in_ = new_input.shape[1]
                current_step._n_features = new_input.shape[1]
                current_step.sparse_output_ = False

            current_step_name = step_name

        initial_feature_names = outputs[initial_step_name].columns.tolist() + \
                                outputs[initial_step_name].add_prefix('_').columns.tolist()

        pipeline = current_step
        X = new_input.convert_dtypes()
        additional_features = list(set(new_input.columns) - set(initial_feature_names))

    # Column Indexing has to be done using index and not column names. Replace with numerical column selector
    for coordinate, model, subset in enumerate_pipeline_models(pipeline):
        col_transfomer = None
        if isinstance(model, ColumnTransformer) and hasattr(model, 'feature_names_in_'):
            col_transfomer = model
        elif AutoSklearnUtils.isFeatTypeSplit(model) and hasattr(model.column_transformer, 'feature_names_in_'):
            col_transfomer = model.column_transformer

        if col_transfomer:
            del col_transfomer.feature_names_in_
            col_transfomer.transformers_ = [(name, t, col_transfomer._transformer_to_input_indices[name])
                                            for name, t, _ in col_transfomer.transformers_]
            col_transfomer.transformers = [(name, t, col_transfomer._transformer_to_input_indices[name])
                                           for name, t, _ in col_transfomer.transformers]

    return pipeline, X, additional_features


class DataFrameImputer(TransformerMixin):

    def __init__(self):
        """Impute missing values.

        Columns of dtype object are imputed with the most frequent value
        in column.

        Columns of other types are imputed with mean of column.

        """

    # noinspection PyAttributeOutsideInit
    def fit(self, X: pd.DataFrame, y=None):
        self.nan_fraction_ = pd.isna(X).sum(axis=0) / X.shape[0]

        fill = []
        for c in X:
            if X[c].dtype.name in ['category', 'object', 'string']:
                fill.append(X[c].value_counts().index[0])
            else:
                correct_type = X[c].dtype.numpy_dtype if hasattr(X[c].dtype, 'numpy_dtype') else X[c].dtype
                fill.append(X[c].mean().astype(correct_type))

        self.fill = pd.Series(fill, index=X.columns)
        return self

    def transform(self, X, y=None):
        return X.fillna(self.fill)

    def inverse_transform(self, X):
        for c, fraction in zip(X, self.nan_fraction_):
            if fraction > 0:
                idx = np.random.randint(0, X.shape[0], int(math.ceil(X.shape[0] * fraction)))
                X.loc[idx, c] = np.nan

        return X


class InplaceOrdinalEncoder(ColumnTransformer):

    def __init__(self, cat_columns, all_columns):
        self.cat_columns = cat_columns
        self.all_columns = all_columns

        super().__init__(transformers=[('cat', OrdinalEncoder(), cat_columns)], remainder='passthrough')

    def _sort_columns(self, X):
        n_cat = len(self._transformer_to_input_indices['cat'])
        cat_input = pd.DataFrame(X[:, :n_cat],
                                 columns=self.all_columns[self._transformer_to_input_indices['cat']])
        num_input = pd.DataFrame(X[:, n_cat:],
                                 columns=self.all_columns[self._transformer_to_input_indices['remainder']])
        return cat_input.join(num_input)[self.all_columns]

    def transform(self, X):
        X_trans = super().transform(X)
        return self._sort_columns(X_trans)

    def fit_transform(self, X, y=None):
        X_trans = super().fit_transform(X, y)
        return self._sort_columns(X_trans)

    def inverse_transform(self, X: np.ndarray):
        encoder = self.transformers_[0][1]

        cat_columns = self._transformer_to_input_indices['cat']
        num_columns = self._transformer_to_input_indices['remainder']

        if len(cat_columns) == 0:
            return pd.DataFrame(X, columns=self.all_columns)

        encoded_input = X[:, cat_columns]
        cat_input = pd.DataFrame(encoder.inverse_transform(encoded_input), columns=self.all_columns[cat_columns])
        num_input = pd.DataFrame(X[:, num_columns], columns=self.all_columns[num_columns])
        return cat_input.join(num_input)[self.all_columns]

    @property
    def encoder(self):
        return self.transformers_[0][1]


@dataclass()
class Node:
    label: str
    impurity: float
    children: List['Node']
    child_labels: List[str]

    def as_dict(self):
        return {
            'label': self.label,
            'children': [c.as_dict() for c in self.children],
            'child_labels': self.child_labels,
            'impurity': float(self.impurity)
        }


def export_tree(ordinal_encoder, decision_tree, feature_names, cat_features, max_depth=10, decimals=2) -> Node:
    check_is_fitted(decision_tree)
    tree_ = decision_tree.tree_
    class_names = decision_tree.classes_
    truncation_fmt = "{}\n"
    value_fmt = " class: {}\n"

    if max_depth < 0:
        raise ValueError("max_depth bust be >= 0, given %d" % max_depth)

    if (feature_names is not None and
        len(feature_names) != tree_.n_features):
        raise ValueError("feature_names must contain "
                         "%d elements, got %d" % (tree_.n_features,
                                                  len(feature_names)))

    if decimals < 0:
        raise ValueError("decimals must be >= 0, given %d" % decimals)

    if feature_names:
        feature_names_ = [feature_names[i] if i != _tree.TREE_UNDEFINED
                          else None for i in tree_.feature]
    else:
        feature_names_ = ["feature_{}".format(i) for i in tree_.feature]

    def export_tree_recurse(node, depth) -> Node:
        if tree_.n_outputs == 1:
            value = tree_.value[node][0]
        else:
            value = tree_.value[node].T[0]
        impurity = tree_.impurity[node]
        class_name = np.argmax(value)

        if (tree_.n_classes[0] != 1 and
            tree_.n_outputs == 1):
            class_name = class_names[class_name]

        if depth <= max_depth + 1:
            if tree_.feature[node] != _tree.TREE_UNDEFINED:
                name = feature_names_[node]
                threshold = tree_.threshold[node]

                if name in cat_features:
                    cat_values = ordinal_encoder.categories_[cat_features.index(name)]
                    threshold = int(math.ceil(threshold))
                    child_labels = ['[{}]'.format(', '.join(cat_values[:threshold].tolist())),
                                    '[{}]'.format(', '.join(cat_values[threshold:].tolist()))]
                else:
                    threshold = "{1:.{0}f}".format(decimals, threshold)
                    child_labels = ['<= {}'.format(threshold), '> {}'.format(threshold)]

                return Node(name, impurity, [
                    export_tree_recurse(tree_.children_left[node], depth + 1),
                    export_tree_recurse(tree_.children_right[node], depth + 1)
                ], child_labels)
            else:  # leaf
                return Node(value_fmt.format(str(class_name)), impurity, [], [])
        else:
            subtree_depth = _compute_depth(tree_, node)
            if subtree_depth == 1:
                return Node(value_fmt.format(str(class_name)), impurity, [], [])
            else:
                return Node(truncation_fmt.format('truncated branch of depth %d' % subtree_depth), impurity, [], [])

    root = export_tree_recurse(0, 1)
    return root


def fit_decision_tree(df: pd.DataFrame, y: np.ndarray, **dt_kwargs):
    cat_columns = make_column_selector(dtype_exclude=np.number)

    # Use simple pipeline being able to handle categorical and missing input
    clf = Pipeline(steps=[
        ('imputation', DataFrameImputer()),
        ('encoding', InplaceOrdinalEncoder(cat_columns, df.columns)),
        ('classifier', DecisionTreeClassifier(**dt_kwargs))])

    clf.fit(df, y)
    return clf
