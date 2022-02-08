from xautoml.tests import get_168746, get_autosklearn, get_31


def test_fixed_structure():
    main = get_168746()
    print(main._config_similarity())
    print(main._config_similarity())


def test_auto_sklearn():
    main = get_autosklearn()
    print(main._config_similarity())
    print(main._config_similarity())


def test_mcts():
    main = get_31()
    print(main._config_similarity())
    print(main._config_similarity())
