import json

import tornado.web

from xautoml.usu_iap import BaseHandler
from xautoml.usu_iap.iap_service import IAPAuth


class IAPEnabledHandler(BaseHandler):

    @classmethod
    def get_route(cls) -> str:
        return 'iap'

    @tornado.web.authenticated
    def get(self):
        auth = IAPAuth(config=self.config)
        self.write(json.dumps(auth.enabled()))
