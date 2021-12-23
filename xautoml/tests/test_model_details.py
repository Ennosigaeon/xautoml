from xautoml.handlers import BaseHandler
from xautoml.model_details import ModelDetails
from xautoml.util import pipeline_utils


def test_decision_tree():
    X, y, pipeline, _ = BaseHandler.load_model({
        "data_file": "res/168746/dataset.pkl",
        "model_files": "res/168746/models_0-0-6.pkl"
    })

    step = 'data_preprocessing:categorical:ordinal_encoder'
    pipeline, X, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_decision_tree(X, pipeline, max_leaf_nodes=None)

    print(res)


def test_decision_tree_without_max_leaf_nodes():
    X, y, pipeline, _ = BaseHandler.load_model({
        "data_file": "res/168746/dataset.pkl",
        "model_files": "res/168746/models_0-0-0.pkl"
    })

    step = 'SOURCE'

    pipeline, X, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_decision_tree(X, pipeline, max_leaf_nodes=None)

    print(res)


def test_lime_for_step():
    X, y, pipeline, _ = BaseHandler.load_model({
        "data_file": "res/168746/dataset.pkl",
        "model_files": "res/168746/models_0-0-0.pkl"
    })

    step = 'data_preprocessing:categorical'
    idx = 3

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, idx)

    print(res)


def test_lime_string_class():
    X, y, pipeline, _ = BaseHandler.load_model({
        "data_file": "res/7306/dataset.pkl",
        "model_files": "res/7306/models_0-0-0.pkl"
    })

    step = 'SOURCE'
    idx = 3

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, idx)

    print(res)


def test_lime_for_auto_sklearn():
    X, y, pipeline, _ = BaseHandler.load_model({
        "data_file": "res/autosklearn/dataset.pkl",
        "model_files": "res/autosklearn/1.2.0.0.model"
    })

    step = 'SOURCE'
    idx = 3

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, idx)

    print(res)


def test_performance_data():
    X, y, pipeline, _ = BaseHandler.load_model({
        "data_file": "res/31/dataset.pkl",
        "model_files": "res/31/models_0-2-2.pkl"
    })

    details = ModelDetails()
    cm = details.calculate_performance_data(X, y, pipeline, 'roc_auc')

    print(cm)


if __name__ == '__main__':
    test_decision_tree()
