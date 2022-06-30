import requests
from traitlets import Unicode
from traitlets.config import Configurable


class IAPAuth(Configurable):
    keycloak_base_url = Unicode(default_value='https://auth.dev.katana.cloud', config=True)
    realm = Unicode(default_value='usu', config=True)
    client_id = Unicode(default_value='ia', config=True)
    offline_token = Unicode(config=True)

    def get_token(self) -> str:
        assert self.offline_token != '', 'Provide valid offline token via IAPAuth.offline_token configuration'

        response = requests.post(
            f'{self.keycloak_base_url}/auth/realms/{self.realm}/protocol/openid-connect/token',
            data={
                'client_id': self.client_id,
                'refresh_token': self.offline_token,
                'grant_type': 'refresh_token',
            })
        body = response.json()
        return body['access_token']

    def enabled(self) -> bool:
        return self.offline_token != ''


class UsuPlatformApiService(Configurable):
    katana_base_url = Unicode(default_value='https://dev.katana.cloud/', config=True)

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        auth = IAPAuth(config=self.config)
        auth_header = {'Authorization': f'Bearer {auth.get_token()}'}

        if kwargs.get('headers'):
            kwargs.get('headers').update(auth_header)
        else:
            kwargs['headers'] = auth_header
        return requests.request(method=method, url=self.katana_base_url + path, **kwargs)

    def get(self, path: str, params=None, **kwargs) -> requests.Response:
        kwargs.setdefault('allow_redirects', True)
        return self._request('get', path, params=params, **kwargs)

    def options(self, path, **kwargs) -> requests.Response:
        kwargs.setdefault('allow_redirects', True)
        return self._request('options', path, **kwargs)

    def head(self, path, **kwargs) -> requests.Response:
        kwargs.setdefault('allow_redirects', False)
        return self._request('head', path, **kwargs)

    def post(self, path, data=None, json=None, **kwargs) -> requests.Response:
        return self._request('post', path, data=data, json=json, **kwargs)

    def put(self, path, data=None, **kwargs) -> requests.Response:
        return self._request('put', path, data=data, **kwargs)

    def patch(self, path, data=None, **kwargs) -> requests.Response:
        return self._request('patch', path, data=data, **kwargs)

    def delete(self, path, **kwargs) -> requests.Response:
        return self._request('delete', path, **kwargs)
