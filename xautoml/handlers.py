from typing import List, Type

from jupyter_server.utils import url_path_join

from xautoml.usu_iap import BaseHandler
from xautoml.usu_iap.config_handler import IAPLimitsHandler
from xautoml.usu_iap.deployment_handler import IAPDeploymentRouteHandler

handlers: List[Type[BaseHandler]] = [
    IAPLimitsHandler,
    IAPDeploymentRouteHandler,
]


def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    _handlers = []
    for handler in handlers:
        _handlers.append((url_path_join(base_url, "usuai_jupyter", handler.get_route()), handler))
    web_app.add_handlers(host_pattern, _handlers)
