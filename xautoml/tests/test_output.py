from xautoml.handlers import OutputDescriptionHandler
from xautoml.output import OutputCalculator, RAW


def test_outputs():
    X, y, feature_labels, pipeline = OutputDescriptionHandler.load_model({
        "cids": "00:00:00",
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/168746/dataset.pkl",
        "model_dir": "/home/marc/phd/code/dswizard/scripts/run/168746/models"
    })

    df_handler = OutputCalculator()
    inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, feature_labels, method=RAW)

    print(outputs)


if __name__ == '__main__':
    test_outputs()
