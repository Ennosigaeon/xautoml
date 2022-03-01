from copy import deepcopy
from typing import List

import numpy as np
import pandas as pd
from ConfigSpace import CategoricalHyperparameter
from ConfigSpace.configuration_space import ConfigurationSpace, Configuration
from sklearn.ensemble import RandomForestRegressor
from sklearn.manifold import MDS

from xautoml.util.config import configs_as_dataframe
from xautoml.util.constants import NUMBER_PRECISION


class ConfigSimilarity:

    @staticmethod
    def compute(configspaces: List[ConfigurationSpace], configs: List[List[Configuration]], loss: np.ndarray,
                is_minimization: bool):
        pruned_cs, configs = ConfigSimilarity._merge_config_spaces(configspaces, configs)

        y = loss.astype(float)
        accumulated_best = np.minmum.accumulate(y) if is_minimization else np.maximum.accumulate(y)
        incumbent_idx = np.nonzero(np.diff(accumulated_best))
        incumbent_idx = np.concatenate([[0], incumbent_idx[0] + 1])

        dist = ConfigSimilarity.get_distance(pruned_cs, configs)
        location = ConfigSimilarity.get_2d_location(dist)
        contour = ConfigSimilarity.get_contour_plot(location, y)

        location = np.vstack((location.T, np.arange(0, location.shape[0]))).T
        mask = np.ones(dist.shape[1], np.bool)
        mask[incumbent_idx] = 0
        incumbent_location = location[incumbent_idx]
        location = location[mask]

        return {
            'config': pd.DataFrame(location, columns=['x', 'y', 'idx']).to_dict('records'),
            'incumbents': pd.DataFrame(incumbent_location, columns=['x', 'y', 'idx']).to_dict('records'),
            'surface': contour.round(NUMBER_PRECISION).to_dict('records')
        }

    @staticmethod
    def _merge_config_spaces(configspaces: List[ConfigurationSpace], configs: List[List[Configuration]]):
        combined_cs = ConfigurationSpace()

        choice = CategoricalHyperparameter('__structure__', list(range(len(configspaces))))
        combined_cs.add_hyperparameter(choice)

        combined_configs = []

        for idx, (cs, configs) in enumerate(zip(configspaces, configs)):
            name = 'structure_{}'.format(idx)

            for config in configs:
                padded_config = {'{}:{}'.format(name, k): v for k, v in config.get_dictionary().items()}
                padded_config['__structure__'] = idx
                combined_configs.append(padded_config)

            combined_cs.add_configuration_space(name, deepcopy(cs),
                                                parent_hyperparameter={'parent': choice, 'value': idx})

        pruned_cs, configs = configs_as_dataframe(combined_cs,
                                                  [Configuration(combined_cs, d) for d in combined_configs])
        return pruned_cs, configs

    @staticmethod
    def get_distance(cs: ConfigurationSpace, X: pd.DataFrame):
        n_confs = X.shape[0]
        n_hp = X.shape[1]

        raw_distance = np.zeros((n_hp, n_confs, n_confs))
        for n, param in enumerate(X.columns):
            values = X[param].to_numpy()

            depth = ConfigSimilarity.get_depth(cs, param)
            difference = np.abs(np.atleast_2d(values) - np.atleast_2d(values).T)

            if type(cs.get_hyperparameter(param) == CategoricalHyperparameter):
                distance = np.clip(difference, 0, 1) / depth
            else:
                distance = difference / depth

            raw_distance[n] = distance

        return raw_distance.sum(axis=0)

    @staticmethod
    def get_depth(cs: ConfigurationSpace, param: str):
        new_parents = cs.get_parents_of(param)
        d = 1
        while new_parents:
            d += 1
            old_parents = new_parents
            new_parents = []
            for p in old_parents:
                pp = cs.get_parents_of(p)
                if pp:
                    new_parents.extend(pp)
                else:
                    return d
        return d

    @staticmethod
    def get_2d_location(dist: np.ndarray):
        mds = MDS(n_components=2, dissimilarity="precomputed", random_state=0)
        location = mds.fit_transform(dist)
        return location

    @staticmethod
    def get_contour_plot(X: np.ndarray, y: np.ndarray, n_steps: int = 20) -> pd.DataFrame:
        # noinspection PyTypeChecker
        rf: RandomForestRegressor = RandomForestRegressor().fit(X, y)

        min_ = np.min(X, axis=0)
        max_ = np.max(X, axis=0)
        step_size = (max_ - min_) / (n_steps - 1)

        xx, yy = np.meshgrid(
            np.linspace(min_[0], max_[0], n_steps),
            np.linspace(min_[1], max_[1], n_steps)
        )

        x = xx.ravel()
        y = yy.ravel()
        z = rf.predict(np.array([x, y]).T)

        return pd.DataFrame({
            'x1': x - step_size[0] / 2, 'x2': x + step_size[0] / 2,
            'y1': y - step_size[1] / 2, 'y2': y + step_size[1] / 2,
            'z': z
        })
