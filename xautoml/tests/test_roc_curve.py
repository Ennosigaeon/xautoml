import json

from xautoml.roc_auc import RocCurve
from xautoml.tests import get_autosklearn


def test_roc_curve():
    main = get_autosklearn()
    X, y, pipeline = main.pipeline('00:00:02')

    micro = False
    macro = True

    result = {}
    roc = RocCurve(micro=micro, macro=macro)
    roc.score(pipeline, X, y)

    # Transform into format suited for recharts
    for fpr, tpr, label in roc.get_data('00:00:02'):
        ls = []
        sample_rate = max(1, len(fpr) // 50)

        for f, t in zip(fpr[::sample_rate], tpr[::sample_rate]):
            ls.append({'x': f, 'y': t})
        result[label] = ls

    print(json.dumps(result))
