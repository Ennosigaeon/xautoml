import math

import numpy as np
import pandas as pd
from sklearn.base import TransformerMixin
from sklearn.pipeline import Pipeline
from sklearn.tree import _tree
from sklearn.tree._export import _compute_depth
from sklearn.utils.validation import check_is_fitted

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
            if X[c].dtype.name == 'category':
                fill.append(X[c].value_counts().index[0])
            else:
                fill.append(X[c].mean())

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
