from xautoml.util import io_utils


def test_load_dataframe():
    xautoml_X, _, xautoml_feature_labels = io_utils.load_input_data(
        '/home/marc/phd/code/dswizard/scripts/run/168746/dataset.pkl',
        framework='dswizard')
    xautoml_pipeline = io_utils.load_pipeline(
        '/home/marc/phd/code/dswizard/scripts/run/168746/models',
        '00:00:00',
        framework='dswizard')

    xautoml_df = io_utils.load_output_dataframe(xautoml_pipeline, '2', xautoml_X, xautoml_feature_labels)
    print(xautoml_df)


if __name__ == '__main__':
    test_load_dataframe()
