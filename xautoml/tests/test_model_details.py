from xautoml.model_details import ModelDetails
from xautoml.tests import get_168746, get_31, get_7306, get_autosklearn, get_1823
from xautoml.util import pipeline_utils


def test_decision_tree():
    main = get_7306()
    X, y, pipeline = main.get_pipeline('00:00:00')

    step = 'SOURCE'
    pipeline, X, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_decision_tree(X, pipeline, max_leaf_nodes=None)

    print(res)


def test_decision_tree_without_max_leaf_nodes():
    main = get_7306()
    X, y, pipeline = main.get_pipeline('00:00:00')

    step = 'SOURCE'
    pipeline, X, _ = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_decision_tree(X, pipeline, max_leaf_nodes=None)

    print(res)


def test_lime_for_step():
    main = get_168746()
    X, y, pipeline = main.get_pipeline('00:00:00')

    step = 'data_preprocessing:categorical'
    idx = 3

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, idx)

    print(res)


def test_lime_string_class():
    main = get_7306()
    X, y, pipeline = main.get_pipeline('00:00:00')

    step = 'SOURCE'
    idx = 3

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, idx)

    print(res)


def test_lime_for_auto_sklearn():
    main = get_autosklearn()
    X, y, pipeline = main.get_pipeline('00:00:02')

    step = 'SOURCE'
    idx = 3

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_lime(X, y, pipeline, idx)

    print(res)


def test_performance_data():
    main = get_31()
    X, y, pipeline = main.get_pipeline('00:02:02')

    details = ModelDetails()
    cm = details.calculate_performance_data(X, y, pipeline, 'roc_auc')

    print(cm)


def test_performance_multiclass():
    main = get_1823()
    X, y, pipeline = main.get_pipeline('00:00:00')

    details = ModelDetails()
    cm = details.calculate_performance_data(X, y, pipeline, 'roc_auc')

    print(cm)
