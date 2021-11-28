import math
from copy import deepcopy

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
from xautoml.util.constants import SOURCE, SINK
from xautoml.util.mlinsights import get_component, enumerate_pipeline_models


def get_subpipeline(pipeline: Pipeline,
                    start: str,
                    X: np.ndarray,
                    y: np.ndarray,
                    feature_labels: list[str]) -> tuple[Pipeline, np.ndarray, list[str], list[str]]:
    if start == SOURCE or start == SINK or start == pipeline.steps[-1][0]:
        return pipeline, X, feature_labels, []
    else:
        df_handler = OutputCalculator()
        inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, feature_labels, method=RAW)

        for selected_coordinate, model, subset in enumerate_pipeline_models(pipeline):
            initial_step_name, initial_step = get_component(selected_coordinate, pipeline)
            if initial_step_name == start:
                break
        else:
            raise ValueError(f'Unknown step name {start}')

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

                current_step = Pipeline(steps)
                new_input = new_input
            elif isinstance(step, ColumnTransformer):
                modified_input = {}
                modified_transformers = []
                for name, transformer, columns in step.transformers_:
                    named_columns = inputs[step_name].columns[columns]
                    if name == current_step_name:
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
        return (
            current_step,
            new_input.to_numpy(),
            new_input.columns.tolist(),
            list(set(new_input.columns) - set(initial_feature_names))
        )


class DataFrameImputer(TransformerMixin):

    def __init__(self):
        """Impute missing values.

        Columns of dtype object are imputed with the most frequent value
        in column.

        Columns of other types are imputed with mean of column.

        """

    def fit(self, X, y=None):
        fill = []
        for c in X:
            if X[c].dtype.name in ['category', 'object', 'string']:
                fill.append(X[c].value_counts().index[0])
            else:
                fill.append(X[c].mean().astype(X[c].dtype.numpy_dtype))

        self.fill = pd.Series(fill, index=X.columns)
        return self

    def transform(self, X, y=None):
        return X.fillna(self.fill)


class Node:

    def __init__(self, label: str, children: list['Node']):
        self.label = label
        self.children = children

    def as_dict(self):
        return {
            'label': self.label,
            'children': [c.as_dict() for c in self.children]
        }


def export_tree(ordinal_encoder, decision_tree, cat_features, num_names, max_depth=10, decimals=2) -> Node:
    check_is_fitted(decision_tree)
    tree_ = decision_tree.tree_
    class_names = decision_tree.classes_
    num_fmt = "{} <= {}\n"
    cat_fmt = "{} in [{}]\n"
    truncation_fmt = "{}\n"
    value_fmt = " class: {}\n"

    if max_depth < 0:
        raise ValueError("max_depth bust be >= 0, given %d" % max_depth)

    feature_names = cat_features + num_names
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
                    label = cat_fmt.format(name, ', '.join(cat_values[:threshold].tolist()))
                else:
                    threshold = "{1:.{0}f}".format(decimals, threshold)
                    label = num_fmt.format(name, threshold)

                return Node(label, [
                    export_tree_recurse(tree_.children_left[node], depth + 1),
                    export_tree_recurse(tree_.children_right[node], depth + 1)
                ])
            else:  # leaf
                return Node(value_fmt.format(str(class_name)), [])
        else:
            subtree_depth = _compute_depth(tree_, node)
            if subtree_depth == 1:
                return Node(value_fmt.format(str(class_name)), [])
            else:
                return Node(truncation_fmt.format('truncated branch of depth %d' % subtree_depth), [])

    root = export_tree_recurse(0, 1)
    return root


def fit_decision_tree(df: pd.DataFrame, y: np.ndarray, **dt_kwargs):
    cat_columns = make_column_selector(dtype_exclude=np.number)

    # Use simple pipeline being able to handle categorical and missing input
    encoder = ColumnTransformer(transformers=[('cat', OrdinalEncoder(), cat_columns)], remainder='passthrough')
    dt = DecisionTreeClassifier(**dt_kwargs)
    clf = Pipeline(steps=[
        ('imputation', DataFrameImputer()),
        ('encoding', encoder),
        ('classifier', dt)])

    clf.fit(df, y)
    return clf
