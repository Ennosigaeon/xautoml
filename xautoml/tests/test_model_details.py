from sklearn.utils.validation import check_is_fitted

from xautoml.handlers import BaseHandler
from xautoml.model_details import ModelDetails
from xautoml.util import pipeline_utils
from xautoml.util.mlinsights import enumerate_pipeline_models


def test_subpipeline():
    for step in ['SOURCE', '1', '1.1', '1.2', '1.2.1', '1.2.2', '2', '2.1', '2.2', '3', 'SINK']:
        print(step)

        X, y, feature_labels, pipeline = BaseHandler.load_model({
            "data_file": "/home/marc/phd/code/dswizard/scripts/run/168746/dataset.pkl",
            "model_files": "/home/marc/phd/code/dswizard/scripts/run/168746/models/models_0-0-0.pkl"
        })

        sub_pipeline, sub_X, sub_feature_labels, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X,
                                                                                                      y, feature_labels)

        for selected_coordinate, model, subset in enumerate_pipeline_models(sub_pipeline):
            check_is_fitted(model)
        sub_pipeline.predict(sub_X)


def test_decision_tree():
    X, y, feature_labels, pipeline = BaseHandler.load_model({
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/168746/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/168746/models/models_0-0-6.pkl"
    })

    step = '1.2.2'
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

    step = '1.2'
    idx = 3

    pipeline, X, feature_labels, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y,
                                                                                      feature_labels)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, feature_labels, idx)

    print(res)


if __name__ == '__main__':
    test_decision_tree()
