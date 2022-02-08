import json

from xautoml.model_details import ModelDetails
from xautoml.tests import get_168746, get_7306
from xautoml.util import pipeline_utils


def test_source():
    main = get_7306()
    X, y, pipeline = main.pipeline('00:00:00')
    step = 'SOURCE'

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_feature_importance(X, y, pipeline, main.run_history.meta.metric)
    print(json.dumps(res.to_dict()))


def test_step():
    main = get_168746()
    X, y, pipeline = main.pipeline('00:00:103')
    step = "data_preprocessing:categorical:imputation"

    pipeline, X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
    details = ModelDetails()
    res = details.calculate_feature_importance(X, y, pipeline, main.run_history.meta.metric)
    print(json.dumps(res.to_dict()))
