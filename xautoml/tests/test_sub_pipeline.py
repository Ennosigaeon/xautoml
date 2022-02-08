from sklearn.utils.validation import check_is_fitted

from xautoml.tests import get_168746, get_autosklearn
from xautoml.util.mlinsights import enumerate_pipeline_models


def test_subpipeline():
    main = get_168746()

    for step in ['SOURCE', 'data_preprocessing', 'data_preprocessing:imputation', 'data_preprocessing:categorical',
                 'data_preprocessing:categorical:ordinal_encoder', 'data_preprocessing:categorical:imputation',
                 'parallel', 'parallel:pca', 'parallel:minmax_scaler', 'decision_tree', 'SINK']:
        print(step)

        sub_X, y, sub_pipeline = main.sub_pipeline('00:00:00', step)

        for selected_coordinate, model, subset in enumerate_pipeline_models(sub_pipeline):
            check_is_fitted(model)
        sub_pipeline.predict(sub_X)


def test_subpipeline_autosklearn():
    main = get_autosklearn()
    for step in ['SOURCE', 'data_preprocessor', 'data_preprocessor:feature_type',
                 'data_preprocessor:feature_type:numerical_transformer',
                 'data_preprocessor:feature_type:numerical_transformer:imputation',
                 'data_preprocessor:feature_type:numerical_transformer:variance_threshold',
                 'data_preprocessor:feature_type:numerical_transformer:rescaling',
                 'data_preprocessor:feature_type:categorical_transformer',
                 'data_preprocessor:feature_type:categorical_transformer:imputation',
                 'data_preprocessor:feature_type:categorical_transformer:encoding',
                 'data_preprocessor:feature_type:categorical_transformer:category_shift',
                 'data_preprocessor:feature_type:categorical_transformer:category_coalescence',
                 'data_preprocessor:feature_type:categorical_transformer:categorical_encoding',
                 'balancing', 'feature_preprocessor', 'classifier', 'SINK']:
        print(step)

        sub_X, y, sub_pipeline = main.sub_pipeline('00:03:05', step)
        sub_pipeline.predict(sub_X)


def test_enumerate_autosklearn():
    main = get_autosklearn()
    sub_X, y, sub_pipeline = main.pipeline('00:03:05')

    for selected_coordinate, model, subset in enumerate_pipeline_models(sub_pipeline):
        print(model)
