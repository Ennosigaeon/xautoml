import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.metrics import confusion_matrix


class LimeResult:

    def __init__(self, idx: int = None,
                 explanations: dict[float, list[tuple[str, float]]] = None,
                 probabilities: dict[float, float] = None,
                 correct_label: float = None):
        self.idx = idx
        self.explanations = explanations
        self.probabilities = probabilities
        self.label = correct_label

    def as_dict(self):
        return {
            'idx': self.idx,
            'expl': self.explanations,
            'prob': self.probabilities,
            'label': self.label
        }


class ModelDetails:

    def calculate_confusion_matrix(self, X: np.ndarray, y: np.ndarray, model):
        y_pred = model.predict(X)
        cm = confusion_matrix(y, y_pred)
        return cm

    def calculate_lime(self, X: np.ndarray, y: np.ndarray, model, feature_labels: list[str],
                       idx: int = None) -> LimeResult:
        try:
            import lime.lime_tabular
        except ImportError:
            raise ValueError('Local explanations not possible. Please install LIME first.')

        if idx is None:
            # TODO only works for y \in [0, ..., n]
            y_probs = model.predict_proba(X)
            worst_idx, _ = self._lime_interesting_indices(y, y_probs)
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
    def calculate_feature_importance(X: np.ndarray, y: np.ndarray, model, feature_labels: list[str]):
        result = permutation_importance(model, X, y, scoring='roc_auc', random_state=0)

        return pd.DataFrame(np.stack((result.importances_mean, result.importances_std)),
                            columns=feature_labels)

    @staticmethod
    def _lime_interesting_indices(y: np.ndarray, y_probs: np.ndarray, n=1) -> tuple[np.ndarray, np.ndarray]:
        idx = np.arange(0, y_probs.shape[0] * y_probs.shape[1], step=y_probs.shape[1]) + y
        flat_probs = y_probs.flatten()

        actual_probs = flat_probs[idx]
        sorted_actual_probs = np.argsort(actual_probs)

        best_idx = sorted_actual_probs[-n:]
        worst_idx = sorted_actual_probs[:n]

        return worst_idx, best_idx
