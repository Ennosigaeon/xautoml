from sklearn.utils.validation import check_is_fitted

from xautoml.handlers import BaseHandler
from xautoml.util import io_utils, pipeline_utils
from xautoml.util.mlinsights import enumerate_pipeline_models


def test_load_dataframe():
    xautoml_X, xautoml_y = io_utils.load_input_data('res/168746/dataset.pkl',
                                                    framework='dswizard')
    xautoml_pipeline = io_utils.load_pipeline(
        'res/168746/models_0-0-0.pkl',
        framework='dswizard')

    xautoml_df = io_utils.load_output_dataframe(xautoml_pipeline, 'decision_tree', xautoml_X)
    print(xautoml_df)


def test_subpipeline():
    for step in ['SOURCE', 'data_preprocessing', 'data_preprocessing:imputation', 'data_preprocessing:categorical',
                 'data_preprocessing:categorical:ordinal_encoder', 'data_preprocessing:categorical:imputation',
                 'parallel', 'parallel:pca', 'parallel:minmax_scaler', 'decision_tree', 'SINK']:
        print(step)

        X, y, pipeline, _ = BaseHandler.load_model({
            "data_file": "res/168746/dataset.pkl",
            "model_files": "res/168746/models_0-0-0.pkl"
        })

        sub_pipeline, sub_X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)

        for selected_coordinate, model, subset in enumerate_pipeline_models(sub_pipeline):
            check_is_fitted(model)
        sub_pipeline.predict(sub_X)


def test_subpipeline_autosklearn():
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

        X, y, pipeline, _ = BaseHandler.load_model({
            "data_file": "res/autosklearn_categorical/dataset.pkl",
            "model_files": "res/autosklearn_categorical/1.2.0.0.model"
        })

        sub_pipeline, sub_X, additional_features = pipeline_utils.get_subpipeline(pipeline, step, X, y)
        sub_pipeline.predict(sub_X)


if __name__ == '__main__':
    test_load_dataframe()
