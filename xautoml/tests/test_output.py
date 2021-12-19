from xautoml.handlers import OutputDescriptionHandler
from xautoml.output import OutputCalculator, RAW


def test_outputs():
    X, y, pipeline, _ = OutputDescriptionHandler.load_model({
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/168746/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/168746/models/models_0-0-0.pkl"
    })

    df_handler = OutputCalculator()
    inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, method=RAW)

    print(outputs)


def test_outputs_auto_sklearn():
    X, y, pipeline, _ = OutputDescriptionHandler.load_model({
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/autosklearn/input/autosklearn_classification_example_tmp/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/autosklearn/input/autosklearn_classification_example_tmp/.auto-sklearn/runs/1_6_0.0/1.6.0.0.model"
    })

    df_handler = OutputCalculator()
    inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, method=RAW)

    print(outputs)


if __name__ == '__main__':
    test_outputs()
