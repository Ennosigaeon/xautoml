import pandas as pd
from mlinsights.helpers.pipeline import alter_pipeline_for_debugging, enumerate_pipeline_models

SINK = 'SINK'
SOURCE = 'SOURCE'

COMPLETE = 0
DESCRIPTION = 1


class OutputCalculator:

    @staticmethod
    def load_data(d: dict, method: int) -> pd.DataFrame:
        assert len(d) == 1
        data = next(iter(d.values()))
        df = pd.DataFrame(data)
        if method == COMPLETE:
            return df
        elif method == DESCRIPTION:
            return df.describe()
        else:
            raise ValueError('Unknown method {}'.format(method))

    @staticmethod
    def calculate_outputs(pipeline, X, method: int = DESCRIPTION) -> dict[str, str]:
        alter_pipeline_for_debugging(pipeline)
        _ = pipeline.predict(X)

        step_names = ['Pipeline'] + list(pipeline.steps_.keys())
        result = {}
        for step, data in zip(step_names, enumerate_pipeline_models(pipeline)):
            _, model, _ = data
            output = OutputCalculator.load_data(model._debug.outputs, method)

            if step == 'Pipeline':
                # Populate SINK and SOURCE instead of single step
                input = OutputCalculator.load_data(model._debug.inputs, method)

                result[SOURCE] = input._repr_html_()
                result[SINK] = output._repr_html_()
            else:
                result[step] = output._repr_html_()

        return result