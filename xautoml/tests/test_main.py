import json

from xautoml.tests import get_31, get_autosklearn, get_168746


def test_serialization_fixed_structure():
    main = get_168746()
    print(json.dumps(main._repr_mimebundle_(None, None)))


def test_serialization_mcts():
    main = get_31()
    print(json.dumps(main._repr_mimebundle_(None, None)))


def test_serialization_autosklearn():
    main = get_autosklearn()
    print(json.dumps(main._repr_mimebundle_(None, None)))
