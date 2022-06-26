from typing import Optional, Awaitable

from jupyter_server.base.handlers import APIHandler

from xautoml.usu_iap.constants import UserRole


class BaseHandler(APIHandler):

    # Only necessary for streaming requests
    def data_received(self, chunk: bytes) -> Optional[Awaitable[None]]:
        pass

    @classmethod
    def get_route(cls) -> str:
        raise NotImplementedError()

    @staticmethod
    def get_required_usu_role() -> Optional[UserRole]:
        return None

    def write_error(self, status_code: int, message: str = 'unknown error', **kwargs):
        self.write({'message': message})
        self.finish()
