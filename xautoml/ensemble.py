import io
from typing import List

import joblib
import matplotlib
import numpy as np
import pandas as pd
from matplotlib import pyplot as plt
from sklearn.compose import make_column_selector
from sklearn.decomposition import PCA
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder

from xautoml.models import Candidate, Ensemble
from xautoml.util.datasets import down_sample
from xautoml.util.pipeline_utils import DataFrameImputer, InplaceOrdinalEncoder


class EnsembleInspection:

    @staticmethod
    def member_predictions(candidates: List[Candidate], X: pd.DataFrame, n_jobs=1):
        def _model_predict(candidate: Candidate, X: pd.DataFrame) -> np.ndarray:
            return candidate.y_transformer(candidate.model.predict(X.copy()))

        all_predictions = joblib.Parallel(n_jobs=n_jobs)(
            joblib.delayed(_model_predict)(candidate=candidate, X=X) for candidate in candidates
        )
        all_predictions = np.array(all_predictions)
        return all_predictions

    @staticmethod
    def ensemble_overview(ensemble: Ensemble, candidates: List[Candidate], X: pd.DataFrame, y_pred: pd.Series,
                          n_jobs=1):
        all_predictions = EnsembleInspection.member_predictions(candidates, X, n_jobs)

        mask = np.min(all_predictions, axis=0) == np.max(all_predictions, axis=0)
        indices = np.where(~mask)[0]

        ensemble_consensus = (np.tile(y_pred, (all_predictions.shape[0], 1)) == all_predictions).sum() / (
            all_predictions.shape[0] * all_predictions.shape[1])

        metrics = {'Ensemble': {'consensus': float(ensemble_consensus), 'weight': float(np.sum(ensemble.weights))}}
        for i in range(all_predictions.shape[0]):
            metrics[candidates[i].id] = {
                'consensus': float(np.sum(all_predictions[i, :] == y_pred) / len(mask)),
                'weight': float(ensemble.weight_map[candidates[i].id])
            }

        return metrics, indices

    @staticmethod
    def plot_decision_surface(ensemble: Ensemble, candidates: List[Candidate], X: pd.DataFrame, y: pd.Series):
        # Dimension reduction for plotting
        cat_columns = make_column_selector(dtype_exclude=np.number)(X)
        pipeline = Pipeline(steps=[
            ('imputation', DataFrameImputer()),
            ('encoding', InplaceOrdinalEncoder(cat_columns, X.columns)),
            ('pca', PCA(n_components=2))
        ])
        X_2d = pipeline.fit_transform(X)

        label_encoder = LabelEncoder()
        label_encoder.fit(y)

        x_min, x_max = X_2d[:, 0].min(), X_2d[:, 0].max()
        y_min, y_max = X_2d[:, 1].min(), X_2d[:, 1].max()
        xx, yy = np.meshgrid(np.linspace(x_min, x_max, 50), np.linspace(y_min, y_max, 50))
        grid_2d = np.c_[xx.ravel(), yy.ravel()]

        grid = pipeline.inverse_transform(grid_2d)

        models = [(ensemble.model, lambda y: y)] + [(c.model, c.y_transformer) for c in candidates]
        names = ['Ensemble'] + [c.id for c in candidates]

        contours = {}
        for (clf, y_trans), cid in zip(models, names):
            fig, ax = plt.subplots(1, 1, figsize=(10, 10), dpi=10)
            Z = y_trans(clf.predict(grid))
            Z = label_encoder.transform(Z)
            Z = Z.reshape(xx.shape)

            norm = matplotlib.colors.Normalize(vmin=0.0, vmax=label_encoder.classes_.shape[0])
            ax.contourf(Z, levels=2, alpha=0.75, norm=norm, cmap='viridis')
            ax.axis('off')
            ax.set_position([0, 0, 1, 1])

            buf = io.BytesIO()
            plt.savefig(buf, format='svg')
            buf.seek(0)
            wrapper = io.TextIOWrapper(buf, encoding='utf-8')
            svg = ''.join(wrapper.readlines()[18:-1]).replace('\n', ' ')
            contours[cid] = svg
            plt.close(fig)

        X_2d, y = down_sample(pd.DataFrame(X_2d, columns=['x', 'y']), y, 100)

        cmap = matplotlib.cm.get_cmap('viridis')
        colors = cmap(np.linspace(0, 1, len(np.unique(y))))
        colors = [matplotlib.colors.rgb2hex(c) for c in colors]

        return {'colors': colors, 'contours': contours, 'X': X_2d.to_dict('records'), 'y': y.to_list()}
