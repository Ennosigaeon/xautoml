from xautoml.handlers import BaseHandler
from xautoml.model_details import ModelDetails
from xautoml.util import pipeline_utils


def test_decision_tree():
    X, y, feature_labels, pipeline = BaseHandler.load_model({
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/168746/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/168746/models/models_0-0-6.pkl"
    })

    step = 'data_preprocessing:categorical:encoding'
    pipeline, X, feature_labels, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y, feature_labels)
    details = ModelDetails()
    res = details.calculate_decision_tree(X, pipeline, feature_labels, max_leaf_nodes=None)

    print(res)


def test_decision_tree_without_max_leaf_nodes():
    X, y, feature_labels, pipeline = BaseHandler.load_model({
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/168746/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/168746/models/models_0-0-0.pkl"
    })

    step = 'SOURCE'

    pipeline, X, feature_labels, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y, feature_labels)
    details = ModelDetails()
    res = details.calculate_decision_tree(X, pipeline, feature_labels, max_leaf_nodes=None)

    print(res)


def test_lime():
    X, y, feature_labels, pipeline = BaseHandler.load_model({
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/168746/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/168746/models/models_0-0-0.pkl"
    })

    step = 'data_preprocessing:categorical'
    idx = 3

    pipeline, X, feature_labels, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y,
                                                                                      feature_labels)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, feature_labels, idx)

    print(res)


def test_lime_string_class():
    X, y, feature_labels, pipeline = BaseHandler.load_model({
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/7306/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/7306/models/models_0-0-0.pkl"
    })

    step = 'SOURCE'
    idx = 3

    pipeline, X, feature_labels, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y,
                                                                                      feature_labels)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, feature_labels, idx)

    print(res)


def test_confusion_matrix():
    X, y, feature_labels, pipeline = BaseHandler.load_model({
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/autosklearn_catgeorical/input/autosklearn_classification_example_tmp/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/autosklearn_catgeorical/input/autosklearn_classification_example_tmp/.auto-sklearn/runs/1_12_0.0/1.12.0.0.model"
    })

    details = ModelDetails()
    cm = details.calculate_confusion_matrix(X, y, pipeline)

    print(cm)


if __name__ == '__main__':
    test_decision_tree()
