from xautoml.handlers import BaseHandler
from xautoml.model_details import ModelDetails
from xautoml.util import pipeline_utils


def test_decision_tree():
    X, y, feature_labels, pipeline = BaseHandler.load_model({
        "cids": "00:00:02",
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/59/dataset.pkl",
        "model_dir": "/home/marc/phd/code/dswizard/scripts/run/59/models"
    })

    step = '1.1.2'
    max_leaf_nodes = 10

    pipeline, X, feature_labels = pipeline_utils.get_subpipeline(pipeline, step, X, feature_labels)
    details = ModelDetails()
    res = details.calculate_decision_tree(X, pipeline, feature_labels, max_leaf_nodes=max_leaf_nodes)

    print(res)


def test_lime():
    X, y, feature_labels, pipeline = BaseHandler.load_model({
        "cids": "00:00:00",
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/59/dataset.pkl",
        "model_dir": "/home/marc/phd/code/dswizard/scripts/run/59/models"
    })

    step = '1.1.1'
    idx = 3

    pipeline, X, feature_labels, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X,
                                                                                      feature_labels)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, feature_labels, idx)

    print(res)


if __name__ == '__main__':
    test_decision_tree()
