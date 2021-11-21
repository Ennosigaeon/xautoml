import itertools as it
import json

import numpy as np
import pandas as pd
from ConfigSpace import Configuration, CategoricalHyperparameter
from ConfigSpace.hyperparameters import OrdinalHyperparameter, NumericalHyperparameter
from ConfigSpace.read_and_write import json as config_json
from fanova import fANOVA, visualizer
from sklearn.preprocessing import MinMaxScaler


def get_plot_data(vis: visualizer.Visualizer,
                  idx: int,
                  resolution: int = 5) -> tuple[list[str], dict]:
    name = vis.cs.get_hyperparameter_names()[idx]
    hp = vis.cs.get_hyperparameter(name)

    if isinstance(hp, NumericalHyperparameter):
        mean, std, grid = vis.generate_marginal(idx, resolution)

        df = pd.DataFrame(np.stack((grid, mean, mean + std, mean - std)).T, columns=['x', 'y', 'lower', 'upper'])
        df['area'] = list(zip(df['lower'], df['upper']))
        return [name], df[['x', 'y', 'area']].to_dict('records')
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
            d[l] = [m - s, m + s]
        return [name], d


def get_pairwise_plot_data(vis: visualizer.Visualizer, idx: (int, int), resolution: int = 5):
    name1 = vis.cs.get_hyperparameter_names()[idx[0]]
    hp1 = vis.cs.get_hyperparameter(name1)

    name2 = vis.cs.get_hyperparameter_names()[idx[1]]
    hp2 = vis.cs.get_hyperparameter(name2)

    if isinstance(hp1, NumericalHyperparameter) and isinstance(hp2, NumericalHyperparameter):
        [x, y], z = vis.generate_pairwise_marginal(idx, resolution)
        df = pd.DataFrame(z, columns=y, index=x)
        return [name1, name2], df.to_dict(), True
    elif isinstance(hp1, NumericalHyperparameter) or isinstance(hp2, NumericalHyperparameter):
        # Ensure that categorical parameter is always the first index
        if isinstance(hp1, NumericalHyperparameter):
            idx = list(reversed(idx))
            name1, name2 = name2, name1

        [categories, x], y = vis.generate_pairwise_marginal(idx, resolution)
        df = pd.DataFrame(np.vstack((x, y)).T, columns=['x'] + list(categories))
        return [name1, name2], df.to_dict('records'), False
    else:
        [cat1, cat2], z = vis.generate_pairwise_marginal(idx)
        df = pd.DataFrame(z, columns=cat2, index=cat1)
        return [name1, name2], df.to_dict(), True


def get_overview(X: pd.DataFrame, f: fANOVA) -> pd.DataFrame:
    res = {}
    for i, j in it.combinations(range(len(X.columns)), 2):
        d = f.quantify_importance((i, j))
        res[X.columns[i]] = {
            'importance': d[(i,)]['individual importance'],
            'std': d[(i,)]['individual std'],
            'single': 0
        }
        res[X.columns[j]] = {
            'importance': d[(j,)]['individual importance'],
            'std': d[(j,)]['individual std'],
            'single': 0
        }
        res['{}___{}'.format(X.columns[i], X.columns[j])] = {
            'importance': d[(i, j)]['total importance'],
            'std': d[(i, j)]['total std'],
            'single': 1
        }
    df = pd.DataFrame(res).T

    scaler = MinMaxScaler()
    df['importance'] = scaler.fit_transform(df[['importance']])
    df['std'] = scaler.transform(df[['std']])
    df = df.sort_values('importance', ascending=False)

    d = df.to_dict()
    return {
        'hyperparameters': X.columns.tolist(),
        'importance': d['importance'],
        'std': d['std']
    }


def create_fanova():
    model = json.load(open('../../dswizard/scripts/run/168746/runhistory.json'))['structures'][0]
    cs = config_json.read(model['configspace'])

    configs = [Configuration(cs, c['config']).get_dictionary() for c in model['configs']]
    performances = [c['loss'] for c in model['configs']]

    X = pd.DataFrame(configs, columns=cs.get_hyperparameter_names())
    y = np.array(performances)

    cat_hp = [hp for hp in cs.get_hyperparameters() if isinstance(hp, CategoricalHyperparameter)]
    for hp in cat_hp:
        X[hp.name] = X[hp.name].map(hp._inverse_transform)

    f = fANOVA(X, y, config_space=cs)
    return f, X


f, X = create_fanova()

overview = get_overview(X, f)
overview_js = json.dumps(overview)


vis = visualizer.Visualizer(f, f.cs, 'tmp')
# vis.plot_marginal(0)
# vis.plot_marginal(6)

mean, std = vis.generate_marginal(0)
mean2, std2, grid2 = vis.generate_marginal(6)

disc_name, discrete = get_plot_data(vis, 0)
cont_name, continuous = get_plot_data(vis, 6)

disc_disc_name, disc_disc, disc_disc_heatmap = get_pairwise_plot_data(vis, [0, 1])
cont_cont_name, cont_cont, cont_cont_heatmap = get_pairwise_plot_data(vis, [5, 6])
disc_cont_name, disc_cont, disc_cont_heatmap = get_pairwise_plot_data(vis, [0, 6])

js = json.dumps({
    'name': disc_name,
    'mode': 'discrete',
    'data': discrete
})
js2 = json.dumps({
    'name': cont_name,
    'mode': 'continuous',
    'data': continuous
})
js3 = json.dumps({
    'name': disc_cont_name,
    'mode': 'heatmap' if disc_cont_heatmap else 'continuous',
    'data': disc_cont
})
js4 = json.dumps({
    'name': disc_disc_name,
    'mode': 'heatmap' if disc_disc_heatmap else 'continuous',
    'data': disc_disc
})

vis.plot_pairwise_marginal([0, 1], show=True)
vis.plot_pairwise_marginal([5, 6], show=True)
# vis.plot_pairwise_marginal([0, 6], show=True)


a = 0
