from xautoml.handlers import BaseHandler
from xautoml.roc_auc import RocCurve


def test_roc_curve():
    model = {
        "cids": "00:02:07",
        "data_file": "/home/marc/phd/code/dswizard/scripts/run/autosklearn_categorical/input/autosklearn_classification_example_tmp/dataset.pkl",
        "model_files": "/home/marc/phd/code/dswizard/scripts/run/autosklearn_categorical/input/autosklearn_classification_example_tmp/.auto-sklearn/runs/1_7_0.0/1.7.0.0.model"
    }

    micro = model.get('micro', False)
    macro = model.get('macro', True)
    cid = model.get('cids')
    X, y, pipeline, _ = BaseHandler.load_model(model)

    result = {}
    roc = RocCurve(micro=micro, macro=macro)
    roc.score(pipeline, X, y)

    # Transform into format suited for recharts
    for fpr, tpr, label in roc.get_data(cid):
        ls = []
        sample_rate = len(fpr) // 50

        for f, t in zip(fpr[::sample_rate], tpr[::sample_rate]):
            ls.append({'x': f, 'y': t})
        result[label] = ls

    print(result)


if __name__ == '__main__':
    test_roc_curve()