import requests
from traitlets import Unicode
from traitlets.config import Configurable


class UsuPlatformApiService(Configurable):
    katana_base_url = Unicode(default_value='https://dev.katana.cloud/', config=True)

    def _request(self, method: str, path: str, req, **kwargs) -> requests.Response:
        url = self.katana_base_url + path
        token = None if req is None else req.headers.get('x-auth-usu-token', None)
        auth_header = {} if token is None else {'Authorization': 'Bearer ' + token}

        if kwargs.get('headers'):
            kwargs.get('headers').update(auth_header)
        else:
            kwargs['headers'] = auth_header
        return requests.request(method=method, url=url, **kwargs)

    def get(self, path: str, params=None, req=None, **kwargs) -> requests.Response:
        kwargs.setdefault('allow_redirects', True)
        return self._request('get', path, req=req, params=params, **kwargs)

    def options(self, path, req=None, **kwargs) -> requests.Response:
        kwargs.setdefault('allow_redirects', True)
        return self._request('options', path, req=req, **kwargs)

    def head(self, path, req=None, **kwargs) -> requests.Response:
        kwargs.setdefault('allow_redirects', False)
        return self._request('head', path, req=req, **kwargs)

    def post(self, path, data=None, json=None, req=None, **kwargs) -> requests.Response:
        return self._request('post', path, data=data, json=json, req=req, **kwargs)

    def put(self, path, data=None, req=None, **kwargs) -> requests.Response:
        return self._request('put', path, data=data, req=req, **kwargs)

    def patch(self, path, data=None, req=None, **kwargs) -> requests.Response:
        return self._request('patch', path, data=data, req=req, **kwargs)

    def delete(self, path, req=None, **kwargs) -> requests.Response:
        return self._request('delete', path, req=req, **kwargs)
