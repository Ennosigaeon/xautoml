from xautoml.handlers import OutputDescriptionHandler
from xautoml.output import OutputCalculator, RAW


def test_outputs():
    X, y, pipeline, _ = OutputDescriptionHandler.load_model({
        "data_file": "res/168746/dataset.pkl",
        "model_files": "res/168746/models_0-0-0.pkl"
    })

    df_handler = OutputCalculator()
    inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, method=RAW)

    print(outputs)


def test_outputs_auto_sklearn():
    X, y, pipeline, _ = OutputDescriptionHandler.load_model({
        "data_file": "res/autosklearn/dataset.pkl",
        "model_files": "res/autosklearn/1.2.0.0.model"
    })

    df_handler = OutputCalculator()
    inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, method=RAW)

    print(outputs)


if __name__ == '__main__':
    test_outputs()
