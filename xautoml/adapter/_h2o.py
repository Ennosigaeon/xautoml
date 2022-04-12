import inspect

import h2o
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.pipeline import Pipeline

from xautoml.models import RunHistory, MetaInformation, Explanations, CandidateStructure, Candidate, Ensemble


# TODO support for H2OAutoMLOutput missing

class H2OModelWrapper(BaseEstimator, ClassifierMixin):

    def __init__(self, h2o_model: 'h2o.estimators.H2OEstimator'):
        from h2o.estimators import H2OEstimator
        self.h2o_model: H2OEstimator = h2o_model

    def __deepcopy__(self, memodict=None):
        return H2OModelWrapper(self.h2o_model)

    @staticmethod
    def __sklearn_is_fitted__():
        return True

    @property
    def classes_(self):
        X = h2o.get_frame(self.h2o_model.actual_params['training_frame']).as_data_frame()
        return X[self.h2o_model.actual_params['response_column']].values

    def fit(self, X: pd.DataFrame, y: pd.Series = None):
        pass

    def predict(self, X: pd.DataFrame):
        import h2o
        h2o_frame = h2o.H2OFrame(X)
        pred = self.h2o_model.predict(h2o_frame)
        return pred.as_data_frame()['predict'].values

    def predict_proba(self, X: pd.DataFrame):
        import h2o
        h2o_frame = h2o.H2OFrame(X)
        pred = self.h2o_model.predict(h2o_frame)
        df: pd.DataFrame = pred.as_data_frame()
        return df.drop(columns=['predict']).values


def import_h2o(aml: 'h2o.automl.H2OAutoML', metric: str = 'auc') -> RunHistory:
    """
    Import the RunHistory from a H2O-3 optimization run
    """

    from ConfigSpace import ConfigurationSpace, Configuration

    def parse_config_space() -> ConfigurationSpace:
        cs = ConfigurationSpace()
        return cs

    def parse_structures():
        import h2o
        from h2o.estimators import H2OEstimator

        timings = dict()

        events = aml.event_log.as_data_frame().reset_index(drop=True)
        for model_id in aml.leaderboard.as_data_frame(use_pandas=True)['model_id']:
            indices = events.loc[(events['message'].str.contains(model_id)), :]
            # TODO not every model_id is recorded in event_log (HPO grid search models?)
            # TODO date is missing in timestamp

            timings[model_id] = {
                'start': 0,
                'end': 0,
            }

        candidates = []
        for model_id in aml.leaderboard.as_data_frame()['model_id']:
            model: H2OEstimator = h2o.get_model(model_id)

            params = model.get_params(deep=True)

            candidates.append(
                Candidate(
                    id=model_id,
                    budget=1,
                    status='Success',  # TODO what about failures?
                    loss=float(aml.leaderboard[aml.leaderboard['model_id'] == model_id, metric]),
                    runtime={
                        'timestamp': timings[model_id]['start'] - start,
                        'training_time': timings[model_id]['end'] - timings[model_id]['start']
                    },
                    config=Configuration(cs, {}),  # TODO configuration missing
                    origin='Grid/Random Search',
                    model=Pipeline(steps=[('estimator', H2OModelWrapper(model))]),  # TODO resemble real structure
                    y_transformer=lambda y: y
                )
            )

        return [CandidateStructure('0', cs, candidates[0].model, candidates)]

    def is_minimization(metric: str):
        if metric in ['logloss', 'mean_per_class_error', 'rmse', 'mse']:
            return True
        elif metric in ['auc', 'aucpr']:
            return False
        raise ValueError('Unknown metric {}'.format(metric))

    def get_parameters():
        signature = inspect.signature(aml.__init__)
        config = dict()
        for key in signature.parameters.keys():
            try:
                config[key] = getattr(aml, key)
            except AttributeError:
                continue

        return config

    cs = parse_config_space()

    start = int(aml.training_info.get('start_epoch', 0))
    end = int(aml.training_info.get('stop_epoch', 0))

    config = get_parameters()

    structures = parse_structures()

    incumbent_performance = float(aml.leaderboard.as_data_frame().loc[0, metric])

    meta = MetaInformation(
        framework='h2o',
        start_time=start,
        end_time=end,
        metric=metric,
        is_minimization=is_minimization(metric),
        n_structures=len(structures),
        n_configs=sum([len(s.configs) for s in structures]),
        incumbent=incumbent_performance,
        openml_task=None,
        openml_fold=None,
        config=config
    )

    incumbent = None
    for structure in structures:
        if incumbent is not None:
            break

        for candidate in structure.configs:
            if candidate.loss == incumbent_performance:
                incumbent = candidate
                break

    ensemble = Ensemble(
        model=incumbent.model,
        members={incumbent.id: 1.}
    )

    return RunHistory(
        meta=meta,
        default_configspace=None,
        structures=structures,
        ensemble=ensemble,
        explanations=Explanations({}, {})
    )
