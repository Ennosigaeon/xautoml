import time
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn import metrics
from sklearn.compose import ColumnTransformer, make_column_selector
from sklearn.inspection import permutation_importance
from sklearn.metrics import confusion_matrix, get_scorer
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
    categorical_input: bool = False

    def to_dict(self, additional_features: list[str]):
        return {
            'idx': self.idx,
            'expl': self.explanations,
            'prob': self.probabilities,
            'label': self.label,
            'categorical_input': self.categorical_input,
            'additional_features': additional_features
        }


@dataclass()
class DecisionTreeResult:
    root: Node
    fidelity: float
    n_pred: int
    n_leaves: int
    max_leaf_nodes: int

    def as_dict(self):
        return {
            'root': self.root.as_dict(),
            'fidelity': float(self.fidelity),
            'n_pred': int(self.n_pred),
            'n_leaves': int(self.n_leaves),
            'max_leaf_nodes': int(self.max_leaf_nodes),
        }


@dataclass()
class GlobalSurrogateResult:
    candidates: list[DecisionTreeResult]
    best: int

    def as_dict(self, additional_features: list[str]):
        return {'candidates': [c.as_dict() for c in self.candidates], 'best': self.best,
                'additional_features': additional_features}


class ModelDetails:

    @staticmethod
    def calculate_performance_data(X: pd.DataFrame, y: pd.Series, model, scoreing: str):
        start = time.time()
        y_pred = model.predict(X)
        duration = time.time() - start

        validation_score = get_scorer(scoreing)(model, X, y)

        cm = confusion_matrix(y, y_pred)
        labels = unique_labels(y, y_pred)
        df = pd.DataFrame(cm, columns=labels, index=labels)

        return {'duration': duration, 'val_score': validation_score,
                'cm': {"classes": df.columns.to_list(), "values": df.values.tolist()}}

    @staticmethod
    def calculate_lime(df: pd.DataFrame, y: pd.Series, model, idx: int) -> LimeResult:
        try:
            import lime.lime_tabular
        except ImportError:
            raise ValueError('Local explanations not possible. Please install LIME first.')

        # TODO check if this preprocessing pipeline is really useful. Maybe just abort for categorical input
        num_columns = make_column_selector(dtype_include=np.number)(df)
        cat_columns = make_column_selector(dtype_exclude=np.number)(df)
        pipeline = Pipeline(steps=[
            ('imputation', DataFrameImputer()),
            ('encoding',
             ColumnTransformer(transformers=[('cat', OrdinalEncoder(), cat_columns)], remainder='passthrough'))])
        X = pipeline.fit_transform(df)

        encoder = pipeline.steps[1][1].transformers_[0][1]
        categorical_features = range(0, len(cat_columns))
        categorical_names = {idx: encoder.categories_[idx] for idx in categorical_features}

        class_names = np.unique(y)

        explainer = lime.lime_tabular.LimeTabularExplainer(X,
                                                           feature_names=cat_columns + num_columns,
                                                           discretize_continuous=True,
                                                           categorical_features=categorical_features,
                                                           categorical_names=categorical_names,
                                                           class_names=class_names)
        explanation = explainer.explain_instance(X[idx], model.predict_proba, num_features=10,
                                                 top_labels=np.unique(y).shape[0])

        all_explanations = {}
        for label in explanation.available_labels():
            all_explanations[class_names[label.tolist()]] = explanation.as_list(label)
        probabilities = dict(zip(explanation.class_names, explanation.predict_proba.tolist()))

        return LimeResult(idx, all_explanations, probabilities, getattr(y[idx], "tolist", lambda: y[idx])())

    @staticmethod
    def calculate_decision_tree(df: pd.DataFrame, model, max_leaf_nodes: int = None) -> GlobalSurrogateResult:
        y_pred = model.predict(df)

        if max_leaf_nodes is not None:
            return GlobalSurrogateResult([ModelDetails._fit_single_dt(df, y_pred, max_leaf_nodes)], 0)
        else:
            # Heuristic to select good value for max_leaf_numbers based on
            # https://www.datasciencecentral.com/profiles/blogs/how-to-automatically-determine-the-number-of-clusters-in-your-dat
            max_leaf_node_candidates = [2, 3, 5, 7, 10, 15, 25, 50, 100]
            strength = -1 * np.ones((len(max_leaf_node_candidates), 3))
            candidates = []
            for idx, candidate in enumerate(max_leaf_node_candidates):
                res = ModelDetails._fit_single_dt(df, y_pred, candidate)
                candidates.append(res)
                strength[idx, 0] = res.fidelity

            strength[1:, 1] = np.diff(strength[:, 0])
            strength[1:, 2] = np.diff(strength[:, 1])

            return GlobalSurrogateResult(candidates, int(np.argmax(strength[:, 2])))

    @staticmethod
    def _fit_single_dt(df: pd.DataFrame, y_pred: np.ndarray, max_leaf_nodes: int):
        num_columns = make_column_selector(dtype_include=np.number)
        cat_columns = make_column_selector(dtype_exclude=np.number)

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
            dt.get_n_leaves(),
            max_leaf_nodes
        )

    @staticmethod
    def calculate_feature_importance(X: pd.DataFrame, y: pd.Series, model):
        result = permutation_importance(model, X, y, scoring='f1_weighted', random_state=0)
        return pd.DataFrame(np.stack((result.importances_mean, result.importances_std)), columns=X.columns)
