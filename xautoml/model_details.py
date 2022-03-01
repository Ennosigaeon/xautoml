import time
from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from joblib import Parallel
from pandas.core.dtypes.common import is_numeric_dtype
from sklearn import metrics
from sklearn.compose import make_column_selector
from sklearn.inspection import permutation_importance, partial_dependence
from sklearn.metrics import confusion_matrix, get_scorer, roc_auc_score, classification_report
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.tree import DecisionTreeClassifier
from sklearn.utils import check_random_state
from sklearn.utils.fixes import delayed
from sklearn.utils.multiclass import unique_labels, type_of_target

from xautoml.util.constants import NUMBER_PRECISION
from xautoml.util.pipeline_utils import export_tree, DataFrameImputer, Node, InplaceOrdinalEncoder


@dataclass
class LimeResult:
    idx: int
    explanations: Dict[float, List[Tuple[str, float]]]
    probabilities: Dict[float, float]
    label: float
    categorical_input: bool = False

    def to_dict(self, additional_features: List[str]):
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
    n_leaves: int
    max_leaf_nodes: int

    def as_dict(self):
        return {
            'root': self.root.as_dict(),
            'fidelity': float(self.fidelity),
            'n_leaves': int(self.n_leaves),
            'max_leaf_nodes': int(self.max_leaf_nodes),
        }


@dataclass()
class GlobalSurrogateResult:
    candidates: List[DecisionTreeResult]
    best: int

    def as_dict(self, additional_features: List[str]):
        return {'candidates': [c.as_dict() for c in self.candidates], 'best': self.best,
                'additional_features': additional_features}


class ModelDetails:

    @staticmethod
    def calculate_performance_data(X: pd.DataFrame, y: pd.Series, model: Pipeline, scoreing: str):
        start = time.time()
        y_pred = model.predict(X)
        duration = time.time() - start

        if scoreing == 'roc_auc':
            y_prob = model.predict_proba(X)
            y_type = type_of_target(y)
            if y_type == "binary" and y_prob.ndim > 1:
                y_prob = y_prob[:, 1]
            validation_score = roc_auc_score(y, y_prob, average='weighted', multi_class='ovr')
        else:
            score_func = get_scorer(scoreing)._score_func
            try:
                validation_score = score_func(y, y_pred)
            except TypeError:
                y = LabelEncoder().fit_transform(y)
                validation_score = score_func(y, y_pred)

        cm = confusion_matrix(y, y_pred)
        labels = unique_labels(y, y_pred)
        df = pd.DataFrame(cm, columns=labels, index=labels)

        report = classification_report(y, y_pred, target_names=labels, output_dict=True)
        accuracy = report['accuracy']
        del report['accuracy']
        del report['macro avg']
        del report['weighted avg']

        return duration, validation_score, report, accuracy, df

    @staticmethod
    def calculate_lime(df: pd.DataFrame, y: pd.Series, model, idx: int) -> LimeResult:
        try:
            import lime.lime_tabular
        except ImportError:
            raise ValueError('Local explanations not possible. Please install LIME first.')

        def invert_categorial_encoding(X: np.ndarray):
            inverted_input = pipeline.inverse_transform(X)
            return model.predict_proba(inverted_input)

        cat_columns = make_column_selector(dtype_exclude=np.number)(df)
        pipeline = Pipeline(steps=[
            ('imputation', DataFrameImputer()),
            ('encoding', InplaceOrdinalEncoder(cat_columns, df.columns))
        ])
        X = pipeline.fit_transform(df).values

        categorical_features = df.columns.get_indexer(cat_columns)
        encoder = pipeline.steps[1][1].encoder
        cat_name_mappings = encoder.categories_ if hasattr(encoder, 'categories_') else []
        categorical_names = {col: cat_name_mappings[i] for i, col in enumerate(categorical_features)}

        class_names = np.unique(y).tolist()
        feature_names = list(map(lambda c: c[:20], df.columns))  # Truncate names

        explainer = lime.lime_tabular.LimeTabularExplainer(X,
                                                           feature_names=feature_names,
                                                           discretize_continuous=True,
                                                           categorical_features=categorical_features,
                                                           categorical_names=categorical_names,
                                                           class_names=class_names,
                                                           random_state=1)
        explanation = explainer.explain_instance(X[idx], invert_categorial_encoding, num_features=15, num_samples=1000,
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
        cat_columns = make_column_selector(dtype_exclude=np.number)

        # Use simple pipeline being able to handle categorical and missing input
        encoder = InplaceOrdinalEncoder(cat_columns, df.columns)
        dt = DecisionTreeClassifier(max_leaf_nodes=max_leaf_nodes)
        clf = Pipeline(steps=[
            ('imputation', DataFrameImputer()),
            ('encoding', encoder),
            ('classifier', dt)])

        clf.fit(df, y_pred)

        y_pred_pred = clf.predict(df)
        score = metrics.accuracy_score(y_pred, y_pred_pred)

        return DecisionTreeResult(
            export_tree(encoder.encoder, dt, df.columns.tolist(), cat_columns(df)),
            score,
            dt.get_n_leaves(),
            max_leaf_nodes
        )

    @staticmethod
    def calculate_feature_importance(X: pd.DataFrame, y: pd.Series, model: Pipeline, metric: str, n_head: int = 14):
        try:
            result = permutation_importance(model, X, y, scoring=metric, random_state=0)
        except ValueError:
            if metric != 'f1_micro':
                return ModelDetails.calculate_feature_importance(X, y, model, 'f1_micro')
            else:
                raise
        except TypeError:
            y_enc = LabelEncoder().fit_transform(y)
            if not np.all(y == y_enc):
                return ModelDetails.calculate_feature_importance(X, y_enc, model, metric)
            else:
                raise

        df = pd.DataFrame(np.stack((result.importances_mean, result.importances_std)),
                          columns=X.columns.map(lambda c: str(c)[:20]), index=['mean', 'std'])

        df = df.round(NUMBER_PRECISION).T.sort_values('mean', ascending=False)
        return df.head(n_head)

    @staticmethod
    def calculate_pdp(X: pd.DataFrame, y: pd.Series, model: Pipeline, features: List[str] = None, subsample: int = 50,
                      n_jobs: int = 1):
        targets: List = np.unique(y).tolist()
        if len(targets) == 2:
            targets = [targets[0]]

        # convert features into a seq of int tuples
        if features is None:
            features = X.columns

        if is_numeric_dtype(X.columns.dtype):
            features = [int(f) for f in features]
        features = [(X.columns.get_indexer([c])[0].item(),) for c in features]

        pd_results = Parallel(n_jobs=n_jobs, verbose=0)(
            delayed(partial_dependence)(model, X, fxs, grid_resolution=20, kind='both')
            for fxs in features
        )

        # get global min and max average predictions of PD grouped by plot type
        pdp_lim = {}
        for target_idx, target in enumerate(targets):
            for pdp in pd_results:
                preds = pdp.individual
                min_pd = float(preds[target_idx].min())
                max_pd = float(preds[target_idx].max())
                old_min_pd, old_max_pd = pdp_lim.get(target, (min_pd, max_pd))
                min_pd = min(min_pd, old_min_pd)
                max_pd = max(max_pd, old_max_pd)
                pdp_lim[target] = (min_pd, max_pd)

        result = {}
        for target_idx, target in enumerate(targets):
            result[target] = {'y_range': pdp_lim[target], 'features': {}}
            for feature_idx, pd_result in zip(features, pd_results):
                feature = {}
                rng = check_random_state(1)
                feature_values = pd_result["values"][0].tolist()

                preds = pd_result.individual[target_idx]
                ice_lines_idx = rng.choice(preds.shape[0], subsample, replace=False)
                ice_lines = []
                for ice in preds[ice_lines_idx, :]:
                    ice_lines.append([{'x': x, 'y': float(y)} for x, y in zip(feature_values, ice.ravel())])

                feature['ice'] = ice_lines
                feature['avg'] = [{'x': x, 'y': y} for x, y in
                                  zip(feature_values, pd_result.average[target_idx].tolist())]

                result[target]['features'][
                    X.columns[feature_idx].item() if hasattr(X.columns[feature_idx], 'item') else X.columns[
                        feature_idx]] = feature

        return result
