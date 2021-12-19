from xautoml.handlers import FeatureImportanceHandler
from xautoml.model_details import ModelDetails
from xautoml.util import pipeline_utils


def test_source():
    model = {
        'data_file': '/home/marc/phd/code/dswizard/scripts/run/7306/dataset.pkl',
        'model_files': '/home/marc/phd/code/dswizard/scripts/run/7306/models/models_0-0-0.pkl'
    }
    step = 'SOURCE'

    X, y, pipeline, _ = FeatureImportanceHandler.load_model(model)

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_feature_importance(X, y, pipeline)
    print(res)


def test_step():
    model = {
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/168746/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/168746/models/models_0-0-103.pkl",
    }
    step = "data_preprocessing:categorical:imputation"

    X, y, pipeline, _ = FeatureImportanceHandler.load_model(model)

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_feature_importance(X, y, pipeline)
    print(res)
