import json

from xautoml.tests import get_31, get_autosklearn, get_168746, get_autosklearn_hearts, get_autosklearn_iris


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
    main = get_autosklearn_hearts()
    print(main.output_description('00:06:25').data)


def test_output_complete():
    main = get_autosklearn_hearts()
    print(main.output_complete('00:06:25').data)


def test_performance_data():
    main = get_autosklearn_hearts()
    print(main.performance_data('00:06:25').data)


def test_decision_tree_surrogate():
    main = get_autosklearn_hearts()
    print(main.decision_tree_surrogate('00:06:25', 'SOURCE', None).data)


def test_decision_tree_surrogate_last_step():
    main = get_autosklearn_hearts()
    print(main.decision_tree_surrogate('00:06:25', 'classifier:gradient_boosting', None).data)


def test_feature_importance():
    main = get_autosklearn_hearts()
    print(main.feature_importance('00:06:25', 'SOURCE').data)


def test_fanova():
    main = get_autosklearn_hearts()
    print(main.fanova('00:06', 'SOURCE').data)


def test_simulate_surrogate():
    main = get_autosklearn_hearts()
    print(main.simulate_surrogate('00:06', 200).data)


def test_config_similarity():
    main = get_autosklearn_hearts()
    print(main.config_similarity().data)


def test_lime():
    main = get_autosklearn_hearts()
    print(main.lime('00:06:25', 1, 'SOURCE').data)


def test_roc_curve():
    main = get_autosklearn_hearts()
    print(main.roc_curve(['00:06:25']).data)


def test_ensemble_decision_surface():
    main = get_autosklearn_iris()
    print(main.ensemble_decision_surface().data)


def test_ensemble_overview():
    main = get_autosklearn_iris()
    print(main.ensemble_overview().data)


def test_ensemble_predictions():
    main = get_autosklearn_iris()
    print(main.ensemble_predictions(15).data)
