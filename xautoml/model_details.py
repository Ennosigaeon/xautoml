from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn import metrics
from sklearn.compose import ColumnTransformer
from sklearn.inspection import permutation_importance
from sklearn.metrics import confusion_matrix
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder
from sklearn.tree import DecisionTreeClassifier
from sklearn.utils.multiclass import unique_labels

from xautoml.util.pipeline_utils import export_tree, DataFrameImputer, Node


@dataclass
class LimeResult:
    idx: int
    explanations: dict[float, list[tuple[str, float]]]
    probabilities: dict[float, float]
    label: float

    def to_dict(self):
        return {
            'idx': self.idx,
            'expl': self.explanations,
            'prob': self.probabilities,
            'label': self.label
        }


@dataclass()
class DecisionTreeResult:
    root: Node
    fidelity: float
    n_pred: int
    n_leaves: int

    def as_dict(self):
        return {
            'root': self.root.as_dict(),
            'fidelity': float(self.fidelity),
            'n_pred': int(self.n_pred),
            'n_leaves': int(self.n_leaves)
        }


class ModelDetails:

    @staticmethod
    def calculate_confusion_matrix(X: np.ndarray, y: np.ndarray, model):
        y_pred = model.predict(X)
        cm = confusion_matrix(y, y_pred)
        labels = unique_labels(y, y_pred)
        return pd.DataFrame(cm, columns=labels, index=labels)

    @staticmethod
    def calculate_lime(X: np.ndarray, y: np.ndarray, model, feature_labels: list[str], idx: int = None) -> LimeResult:
        try:
            import lime.lime_tabular
        except ImportError:
            raise ValueError('Local explanations not possible. Please install LIME first.')

        if idx is None:
            # TODO only works for y \in [0, ..., n]
            y_probs = model.predict_proba(X)
            worst_idx, _ = ModelDetails._lime_interesting_indices(y, y_probs)
            idx = worst_idx[0]

        explainer = lime.lime_tabular.LimeTabularExplainer(X, feature_names=feature_labels, discretize_continuous=True)
        explanation = explainer.explain_instance(X[idx], model.predict_proba, num_features=10,
                                                 top_labels=np.unique(y).shape[0])

        all_explanations = {}
        for label in explanation.available_labels():
            all_explanations[label.tolist()] = explanation.as_list(label)
        probabilities = dict(zip(explanation.class_names, explanation.predict_proba.tolist()))

        return LimeResult(idx, all_explanations, probabilities, y[idx].tolist())

    @staticmethod
    def _lime_interesting_indices(y: np.ndarray, y_probs: np.ndarray, n=1) -> tuple[np.ndarray, np.ndarray]:
        idx = np.arange(0, y_probs.shape[0] * y_probs.shape[1], step=y_probs.shape[1]) + y
        flat_probs = y_probs.flatten()

        actual_probs = flat_probs[idx]
        sorted_actual_probs = np.argsort(actual_probs)

        best_idx = sorted_actual_probs[-n:]
        worst_idx = sorted_actual_probs[:n]

        return worst_idx, best_idx

    @staticmethod
    def calculate_decision_tree(X: np.ndarray, model,
                                feature_labels: list[str],
                                max_leaf_nodes: int = 10) -> DecisionTreeResult:
        df = pd.DataFrame(X, columns=feature_labels)
        y_pred = model.predict(X)

        from sklearn.compose import make_column_selector

        num_columns = make_column_selector(dtype_include=np.number)
        cat_columns = make_column_selector(dtype_include="category")

        # Use simple pipeline being able to handle categorical and missing input
        encoder = ColumnTransformer(transformers=[('cat', OrdinalEncoder(), cat_columns)], remainder='passthrough')
        dt = DecisionTreeClassifier(max_leaf_nodes=max_leaf_nodes)
        clf = Pipeline(steps=[
            ('imputation', DataFrameImputer()),
            ('encoding', encoder),
            ('classifier', dt)])

        clf.fit(df, y_pred)

        y_pred_pred = clf.predict(df)
        score = metrics.accuracy_score(y_pred, y_pred_pred)

        return DecisionTreeResult(
            export_tree(encoder.named_transformers_['cat'], dt, cat_columns(df), num_columns(df)),
            score,
            dt.tree_.node_count - dt.tree_.n_leaves,
            dt.get_n_leaves()
        )

    @staticmethod
    def calculate_feature_importance(X: np.ndarray, y: np.ndarray, model, feature_labels: list[str]):
        result = permutation_importance(model, X, y, scoring='f1_weighted', random_state=0)
        return pd.DataFrame(np.stack((result.importances_mean, result.importances_std)),
                            columns=feature_labels)
