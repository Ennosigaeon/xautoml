import itertools as it
import json
import tempfile
from typing import Optional

import numpy as np
import pandas as pd
from ConfigSpace import CategoricalHyperparameter, ConfigurationSpace
from ConfigSpace.hyperparameters import OrdinalHyperparameter, NumericalHyperparameter
from ConfigSpace.read_and_write import json as config_json
from fanova import fANOVA, visualizer

from xautoml.util.constants import NUMBER_PRECISION


class HPImportance:

    @staticmethod
    def calculate_fanova_overview(f: fANOVA, X: pd.DataFrame, step: str = None):
        res = {}
        for i, j in it.combinations(range(len(X.columns)), 2):
            d = f.quantify_importance((i, j))
            res[(i, i)] = {
                'importance': d[(i,)]['individual importance'],
                'std': d[(i,)]['individual std']
            }
            res[(j, j)] = {
                'importance': d[(j,)]['individual importance'],
                'std': d[(j,)]['individual std']
            }
            res[(i, j)] = {
                'importance': d[(i, j)]['total importance'],
                'std': d[(i, j)]['total std']
            }
        df = pd.DataFrame(res).T

        df['lower'] = (df['importance'] - df['std']).clip(lower=0)
        df['upper'] = (df['importance'] + df['std']).clip(upper=1)

        df = df.round(NUMBER_PRECISION)

        df['std'] = list(zip((df['importance'] - df['lower']).round(NUMBER_PRECISION),
                             (df['upper'] - df['importance']).round(NUMBER_PRECISION)))

        df = df.sort_values('importance', ascending=False)
        df['idx'] = range(0, df.shape[0])

        return {
            'hyperparameters': X.columns.tolist(),
            'keys': df.index.tolist(),
            'importance': df[['importance', 'std', 'idx']].to_dict('records'),
        }

    @staticmethod
    def calculate_fanova_details(f: fANOVA, X: pd.DataFrame, resolution: int = 10):
        with tempfile.TemporaryDirectory() as tmp:
            vis = visualizer.Visualizer(f, f.cs, tmp)

            res: list[list[Optional[dict]]] = []

            for i in range(len(X.columns)):
                res.append([None] * len(X.columns))
                res[i][i] = HPImportance._get_plot_data(vis, i, resolution=resolution)
            for i, j in it.combinations(range(len(X.columns)), 2):
                res[i][j] = HPImportance._get_pairwise_plot_data(vis, (i, j), resolution=resolution)
                res[j][i] = res[i][j]

            return res

    @staticmethod
    def _get_plot_data(vis: visualizer.Visualizer,
                       idx: int,
                       resolution: int = 10) -> dict:
        name = vis.cs.get_hyperparameter_names()[idx]
        hp = vis.cs.get_hyperparameter(name)

        if isinstance(hp, NumericalHyperparameter):
            mean, std, grid = vis.generate_marginal(idx, resolution)

            df = pd.DataFrame(np.stack((grid, mean, mean + std, mean - std)).T, columns=['x', 'y', 'lower', 'upper']) \
                .round(NUMBER_PRECISION)
            df['area'] = list(zip(df['lower'], df['upper']))
            return {
                'name': [name],
                'data': df[['x', 'y', 'area']].to_dict('records'),
                'mode': 'continuous'
            }
        else:
            if isinstance(hp, CategoricalHyperparameter):
                labels = hp.choices
            elif isinstance(hp, OrdinalHyperparameter):
                labels = hp.sequence
            else:
                raise ValueError("Parameter {} of type {} not supported.".format(hp.name, type(hp)))

            mean, std = vis.generate_marginal(idx)
            d = {}
            for m, s, l in zip(mean, std, labels):
                d[l] = [round(m - s, NUMBER_PRECISION), round(m + s, NUMBER_PRECISION)]
            return {'name': [name], 'data': d, 'mode': 'discrete'}

    @staticmethod
    def _get_pairwise_plot_data(vis: visualizer.Visualizer, idx: (int, int), resolution: int = 10) -> dict:
        name1 = vis.cs.get_hyperparameter_names()[idx[0]]
        hp1 = vis.cs.get_hyperparameter(name1)

        name2 = vis.cs.get_hyperparameter_names()[idx[1]]
        hp2 = vis.cs.get_hyperparameter(name2)

        if isinstance(hp1, NumericalHyperparameter) and isinstance(hp2, NumericalHyperparameter):
            [x, y], z = vis.generate_pairwise_marginal(idx, resolution)
            df = pd.DataFrame(z, columns=np.round(y, decimals=NUMBER_PRECISION),
                              index=np.round(x, decimals=NUMBER_PRECISION))
            return {'name': [name1, name2], 'data': df.round(NUMBER_PRECISION).to_dict(), 'mode': 'heatmap'}
        elif isinstance(hp1, NumericalHyperparameter) or isinstance(hp2, NumericalHyperparameter):
            # Ensure that categorical parameter is always the first index
            if isinstance(hp1, NumericalHyperparameter):
                idx = list(reversed(idx))
                name1, name2 = name2, name1

            [categories, x], y = vis.generate_pairwise_marginal(idx, resolution)
            df = pd.DataFrame(np.vstack((x, y)).T, columns=['x'] + list(categories))
            return {'name': [name1, name2], 'data': df.round(NUMBER_PRECISION).to_dict('records'), 'mode': 'continuous'}
        else:
            [cat1, cat2], z = vis.generate_pairwise_marginal(idx)
            df = pd.DataFrame(z, columns=cat2, index=cat1)
            return {'name': [name1, name2], 'data': df.round(NUMBER_PRECISION).to_dict(), 'mode': 'heatmap'}

    @staticmethod
    def load_model(model):
        cs = model['configspace']

        if 'name' in cs:
            config_space = ConfigurationSpace(name=cs['name'])
        else:
            config_space = ConfigurationSpace()
        for hyperparameter in cs['hyperparameters']:
            config_space.add_hyperparameter(config_json._construct_hyperparameter(
                hyperparameter,
            ))
        for condition in cs['conditions']:
            config_space.add_condition(config_json._construct_condition(
                condition, config_space,
            ))
        for forbidden in cs['forbiddens']:
            config_space.add_forbidden_clause(config_json._construct_forbidden(
                forbidden, config_space,
            ))

        return HPImportance._construct_fanova(config_space, model['configs'], model['loss'])

    @staticmethod
    def load_file(runhistory_file: str):
        model = json.load(open(runhistory_file))['structures'][0]
        cs = config_json.read(model['configspace'])

        configs = [c['config'] for c in model['configs']]
        performances = [c['loss'] for c in model['configs']]

        return HPImportance._construct_fanova(cs, configs, performances)

    @staticmethod
    def _construct_fanova(cs: ConfigurationSpace, configs: list[dict], performances: list[float]):
        X = pd.DataFrame(configs, columns=cs.get_hyperparameter_names())
        y = np.array(performances)

        cat_hp = [hp for hp in cs.get_hyperparameters() if isinstance(hp, CategoricalHyperparameter)]
        for hp in cat_hp:
            X[hp.name] = X[hp.name].map(hp._inverse_transform)

        f = fANOVA(X, y, config_space=cs)
        return f, X
