# XAutoML: A Visual Analytics Tool for Establishing Trust in Automated Machine Learning

XAutoML is an interactive visual analytics tool for explaining AutoML optimisation procedures and ML pipelines
constructed by AutoML. It combines interactive visualizations with established techniques from explainable AI (XAI) to
make the complete AutoML procedure transparent and explainable. We integrate XAutoML with Jupyter to enable experienced
users to extend the visual analytics with advanced ad-hoc visualizations based on information extracted from XAutoML

Currently, XAutoML supports only
* [auto-sklearn](https://github.com/automl/auto-sklearn)
* [dswizard](https://github.com/Ennosigaeon/dswizard)
* [FLAML](https://github.com/microsoft/FLAML)
* [Optuna](https://github.com/optuna/optuna)
* [scikit-learn](https://github.com/scikit-learn/scikit-learn)

but we plan to add support for further AutoML systems. You can find a video introducing XAutoML on [YouTube](https://www.youtube.com/watch?v=AyqMrdlds7o).

[![XAutoML: A Visual Analytics Tool for Establishing Trust in Automated Machine Learning](https://yt-embed.herokuapp.com/embed?v=AyqMrdlds7o)](https://www.youtube.com/watch?v=AyqMrdlds7o "XAutoML: A Visual Analytics Tool for Establishing Trust in Automated Machine Learning")


## Install

To install the extension, execute:

```bash
pip install xautoml
```

## Usage

XAutoML currently only works with JupyterLab. You can find ready to use Notebook examples in the [examples](examples)
folder.

```shell
cd examples
jupyter lab
```

To use XAutoML, three steps are necessary:
1) Perform an optimization in one of the supported AutoML frameworks
2) Import the [RunHistory](xautoml/models.py) of the optimizer via the corresponding [adapter](xautoml/adapter.py)
3) Create the [XAutoML](xautoml/main.py) visualization

```python
from xautoml.main import XAutoML
from xautoml.adapter import import_sklearn
from xautoml.util.datasets import openml_task
from sklearn.model_selection import RandomizedSearchCV

# 1) Perform AutoML optimization
random_search = RandomizedSearchCV(...).fit(...)

# 2) Use Adapter to create RunHistory
rh = import_sklearn(random_search)

# 3) Create Visualization
X_test, y_test = openml_task(31, 0, test=True)
main = XAutoML(rh, X_test, y_test)
main.explain()
```


## Uninstall

To remove the extension, execute:

```bash
pip uninstall xautoml
```


## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```


## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the xautoml directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Server extension must be manually installed in develop mode
jupyter server extension enable xautoml
# Rebuild extension Typescript source after making changes
jlpm install
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
# Server extension must be manually disabled in develop mode
jupyter server extension disable xautoml
pip uninstall xautoml
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `xautoml` within that folder.


### Release new version
Increase version number in `package.json` and upload the latest build to pypi.
```bash
python setup.py sdist
python -m twine upload dist/*
```
