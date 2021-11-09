from xautoml.handlers import OutputDescriptionHandler
from xautoml.output import OutputCalculator, DESCRIPTION


def test_outputs():
    X, y, feature_labels, pipeline = OutputDescriptionHandler.load_model({
        "cids": "00:00:02",
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/59/dataset.pkl",
        "model_dir": "/home/marc/phd/code/dswizard/scripts/run/59/models"
    })

    df_handler = OutputCalculator()
    steps = df_handler.calculate_outputs(pipeline, X, feature_labels, method=DESCRIPTION)

    print(steps)


if __name__ == '__main__':
    test_outputs()
