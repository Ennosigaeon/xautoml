import json

from xautoml.tests import get_31, get_autosklearn, get_168746, get_1823, get_7306


def test_serialization_fixed_structure():
    main = get_168746()
    print(json.dumps(main._repr_mimebundle_(None, None)))


def test_serialization_mcts():
    main = get_31()
    print(json.dumps(main._repr_mimebundle_(None, None)))


def test_serialization_autosklearn():
    main = get_autosklearn()
    print(json.dumps(main._repr_mimebundle_(None, None)))


def test_output_description():
    main = get_autosklearn()
    print(main._output_description('00:03:05').data)


def test_output_complete():
    main = get_autosklearn()
    print(main._output_complete('00:03:05').data)


def test_performance_data():
    main = get_autosklearn()
    print(main._performance_data('00:03:05').data)


def test_decision_tree_surrogate():
    main = get_autosklearn()
    print(main._decision_tree_surrogate('00:03:05', 'SOURCE', None).data)


def test_decision_tree_surrogate_last_step():
    main = get_autosklearn()
    print(main._decision_tree_surrogate('00:03:05', 'classifier:gradient_boosting', None).data)


def test_feature_importance():
    main = get_autosklearn()
    print(main._feature_importance('00:06:11', 'SOURCE').data)


def test_pdp():
    main = get_autosklearn()
    print(main._pdp('00:06:11', 'SOURCE', ['checking_status']).data)


def test_pdp2():
    main = get_1823()
    print(main._pdp('00:00:00', 'SOURCE').data)


def test_pdp3():
    main = get_7306()
    print(main._pdp('00:02:02', 'SOURCE').data)


def test_pdp4():
    main = get_168746()
    print(main._pdp('00:00:103', 'parallel:pca').data)


def test_fanova():
    main = get_autosklearn()
    print(main._fanova_overview('00:01', 'SOURCE').data)


def test_simulate_surrogate():
    main = get_autosklearn()
    print(main._simulate_surrogate('00:01', 200).data)


def test_config_similarity():
    main = get_autosklearn()
    print(main._config_similarity().data)


def test_lime():
    main = get_autosklearn()
    print(main._lime('00:03:05', 1, 'SOURCE').data)


def test_roc_curve():
    main = get_autosklearn()
    print(main._roc_curve(['00:03:05']).data)


def test_ensemble_decision_surface():
    main = get_autosklearn()
    print(main._ensemble_decision_surface().data)


def test_ensemble_overview():
    main = get_autosklearn()
    print(main._ensemble_overview().data)


def test_ensemble_predictions():
    main = get_autosklearn()
    print(main._ensemble_predictions(15).data)
