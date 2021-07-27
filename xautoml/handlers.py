import json
import os
import re

import joblib
import tornado.web
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import gen

from xautoml.roc_auc import RocCurve


class DummyHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": "This is /xautoml/get_example endpoint!"
        }))


class RocCurveHandler(APIHandler):

    @tornado.web.authenticated
    @gen.coroutine
    def post(self):
        model = self.get_json_body()

        if model is not None:
            cids = model.get('cids').split(',')
            data_file = model.get('data_file')
            model_dir = model.get('model_dir')

            micro = model.get('micro', False)
            macro = model.get('macro', True)

            models = map(lambda cid:
                         os.path.join(model_dir,
                                      f'models_{RocCurveHandler._internal_name(cid).replace(":", "-")}.pkl'), cids)
            with open(data_file, 'rb') as f:
                X, y = joblib.load(f)

            result = {}
            for model_file, cid in zip(models, cids):
                with open(model_file, 'rb') as f:
                    pipeline = joblib.load(f)

                    roc = RocCurve(micro=micro, macro=macro)
                    roc.score(pipeline, X, y, json=True)

                    # Transform into format suited for recharts
                    for fpr, tpr, label in roc.get_data(cid):
                        ls = []
                        for f, t in zip(fpr, tpr):
                            ls.append({'x': f, 'y': t})
                        result[label] = ls

            self.finish(json.dumps(result))
        else:
            self.set_status(400)
            self.finish()

    @staticmethod
    def _internal_name(cid: str) -> str:
        return re.sub(r'0(\d)', r'\1', cid)


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    handlers = [
        (url_path_join(base_url, 'xautoml', 'get_example'), DummyHandler),
        (url_path_join(base_url, 'xautoml', 'roc_auc'), RocCurveHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)
