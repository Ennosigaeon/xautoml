from xautoml.output import OutputCalculator, RAW
from xautoml.tests import get_168746, get_autosklearn, get_fixed_31


def test_outputs():
    main = get_168746()
    X, y, pipeline = main.pipeline('00:00:00')

    df_handler = OutputCalculator()
    inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, method=RAW)

    print(outputs)


def test_outputs_fixed():
    main = get_fixed_31()
    X, y, pipeline = main.pipeline('00:10:04')

    df_handler = OutputCalculator()
    inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, method=RAW)

    print(outputs)


def test_outputs_auto_sklearn():
    main = get_autosklearn()
    X, y, pipeline = main.pipeline('00:00:02')

    df_handler = OutputCalculator()
    inputs, outputs = df_handler.calculate_outputs(pipeline, X, y, method=RAW)

    print(outputs)
