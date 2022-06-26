import json

import requests
import tornado.web

from xautoml.usu_iap import BaseHandler


class IAPLimitsHandler(BaseHandler):

    @classmethod
    def get_route(cls) -> str:
        return 'limits'

    @tornado.web.authenticated
    def get(self):
        try:
            r = self.get_deployment_resources()

            if 200 <= r.status_code < 300:
                self.set_status(r.status_code)
                self.write(self._extract_resource_config(r.json()))
                self.finish()
            else:
                if r.status_code == 401 or r.status_code == 403:
                    reason = 'Unauthorized. Please verify your token and permissions.'
                elif r.status_code == 404:
                    reason = 'Internal Server Error'
                else:
                    reason = 'Unknown Server Error'

                message = f'Loading of deployment resources failed: {reason}'
                self.log.error(f'{message} ({r.status_code}): {r.text}')
                self.send_error(r.status_code, message=message)

        except ValueError as e:
            self.log.error(f'GetResources error: {e}')
            self.send_error(500, message=f'Internal error: {e}')

        except Exception as e:
            self.log.error(f'GetResources error: {e}')
            self.send_error(500, message='Unknown error while getting resources.')

    def get_deployment_resources(self) -> requests.Response:
        # api_service = UsuPlatformApiService(config=self.config)
        # return api_service.get('ia/v1/go/deployments/resources', req=self.request)

        # TODO remove mock
        response = requests.Response()
        response.status_code = 200
        response._content = str.encode(json.dumps({
            'memoryResource': {
                'min': 100,
                'max': 1000,
            },
            'cpuResource': {
                'min': 0.5,
                'max': 4
            },
        }))
        return response

    @staticmethod
    def _extract_resource_config(json_resp):
        resource_config = {
            'memory': [json_resp['memoryResource']['min'], json_resp['memoryResource']['max']],
            'cpu': [json_resp['cpuResource']['min'], json_resp['cpuResource']['max']],
            'memoryStep': 10,
            'cpuStep': 100
        }

        return resource_config
