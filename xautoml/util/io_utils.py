from typing import Union

import pandas as pd
from ConfigSpace import ConfigurationSpace, Configuration, CategoricalHyperparameter
from ConfigSpace.util import impute_inactive_values


def configs_as_dataframe(cs: ConfigurationSpace,
                         configs: list[Configuration]) -> Union[pd.DataFrame, tuple[ConfigurationSpace, pd.DataFrame]]:
    def prep_config(c: Configuration):
        conf = impute_inactive_values(c)
        return conf.get_dictionary()

    configs_ = [prep_config(c) for c in configs]

    X = pd.DataFrame(configs_, columns=cs.get_hyperparameter_names())
    pruned_cs = ConfigurationSpace()
    for hp in cs.get_hyperparameters():
        if isinstance(hp, CategoricalHyperparameter):
            X[hp.name] = X[hp.name].map(hp._inverse_transform)

        if X[hp.name].nunique() == 1 and X.shape[0] > 1:
            X.drop(hp.name, axis=1, inplace=True)
        else:
            pruned_cs.add_hyperparameter(hp)

    for condition in cs.get_conditions():
        try:
            pruned_cs.add_condition(condition)
        except ValueError:
            # Either parent or child hp was pruned from cs
            pass

    return pruned_cs, X
