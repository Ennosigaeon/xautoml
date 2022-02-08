import json

from xautoml.ensemble import EnsembleInspection
from xautoml.tests import get_autosklearn


def test_member_predictions():
    main = get_autosklearn()

    ensemble = main.run_history.ensemble

    members = [main.run_history.cid_to_candidate[cid] for cid in ensemble.members]
    X, y = main.data_set()

    res = EnsembleInspection.member_predictions(members, X)
    print(json.dumps(res.tolist()))


def test_ensemble_overview():
    main = get_autosklearn()

    ensemble = main.run_history.ensemble

    members = [main.run_history.cid_to_candidate[cid] for cid in ensemble.members]
    X, y = main.data_set()

    y_pred = ensemble.model.predict(X)
    res, idx = EnsembleInspection.ensemble_overview(ensemble, members, X, y_pred)

    print(json.dumps(res))


def test_plot_decision_surface_auto_sklearn():
    main = get_autosklearn()

    ensemble = main.run_history.ensemble

    members = [main.run_history.cid_to_candidate[cid] for cid in ensemble.members]
    X, y = main.data_set()

    res = EnsembleInspection.plot_decision_surface(ensemble, members, X, y)
    print(json.dumps(res))
