import json
import os
import tempfile
import time
from typing import Dict, Any, Optional

import requests
import tornado.web
from notebook.base.handlers import HTTPError

from xautoml.usu_iap import BaseHandler
from xautoml.usu_iap.constants import UserRole, ENVIRONMENT_YML_FILE


class IAPDeploymentRouteHandler(BaseHandler):

    @classmethod
    def get_route(cls) -> str:
        return 'deployment'

    @staticmethod
    def get_required_usu_role() -> Optional[UserRole]:
        return UserRole.KatanaGo

    def write_error(self, status_code: int, message: str = '', **kwargs) -> None:
        message = {
            'deploymentId': self.get_json_body()['id'],
            'version': None,
            'deploymentState': 'Failed',
            'detailMessage': message
        }
        super().write_error(status_code=status_code, message=json.dumps(message), kwargs=kwargs)

    @tornado.web.authenticated
    def post(self):
        input_data = self.get_json_body()

        with tempfile.NamedTemporaryFile() as tmp_zip_file:
            try:
                self.create_deployment_archive(input_data, tmp_zip_file.name)
                r = self.upload_deployment(input_data, tmp_zip_file.name)

                if 200 <= r.status_code < 300:
                    self.log.info('Successful created deployment')
                    self.set_status(r.status_code)
                    self.write(r.text)
                    self.finish()
                else:
                    if r.status_code == 401 or r.status_code == 403:
                        message = 'Unauthorized. Please verify your permissions.'
                    elif r.status_code == 400:
                        message = 'Bad deployment request. Please verify your selected files.'
                    else:
                        message = 'Unknown deployment Server Error'
                    self.log.error(f'{message} ({r.status_code}): {r.text}')
                    self.send_error(r.status_code, message=message)

            except KeyError as e:
                self.log.exception('Invalid request')
                self.send_error(400, message=f'Invalid request: {e}')
                return
            except (IOError, HTTPError) as e:
                self.log.exception('Unable to process file')
                self.send_error(400, message=f'Unable to process file: {e}')
                return
            except ValueError as e:
                self.log.error(f'Deployment error: {e}')
                message = f'Internal error: {e}'
                self.send_error(500, message=message)
            except Exception as e:
                self.log.error(f'Deployment error: {e}')
                self.send_error(500, message='Unknown error while creating deployment.')

    # noinspection PyProtectedMember
    def create_deployment_archive(self, input_data: dict, zip_file: str) -> None:
        cm = self.contents_manager

        with tempfile.TemporaryDirectory() as tmp_path:
            # TODO create deployment

            with open(os.path.join(tmp_path, ENVIRONMENT_YML_FILE), 'w') as env_file:
                env_file.writelines('name: python-deployment\n')

            for file_path in input_data['additionalFiles']:
                os.makedirs(os.path.join(tmp_path, os.path.dirname(file_path)), exist_ok=True)
                os.symlink(cm._get_os_path(file_path), os.path.join(tmp_path, file_path))

            # TODO create zip file

    def upload_deployment(self, input_data: Dict[str, Any], zip_file: str) -> requests.Response:
        # TODO remove mock
        time.sleep(2)
        response = requests.Response()
        response.status_code = 200
        response._content = str.encode(json.dumps({
            'deploymentId': 'foobar',
            'version': 1,
            'deploymentState': 'Pending',
            'detailMessage': 'details'
        }))
        return response

        # with open(zip_file + '.zip', 'rb') as my_zip:
        #     runner_args_file = input_data['deploymentFile']
        #
        #     custom_properties = {
        #         'runnerOutputMode': 'stdout',
        #         'runnerOutputName': '',
        #         'runnerArgsFile': runner_args_file,
        #         'configMap': input_data['configMap'],
        #         'runnerExecutable': 'python'
        #     }
        #
        #     instance_create_params = {
        #         'goDeployment': {
        #             'id': input_data['id'],
        #             'serviceType': ServiceType.Container.value,
        #             'deploymentType': DeploymentType.Python.value,
        #             'description': input_data['deploymentDescription']
        #         },
        #         'goInstanceConfig': {
        #             'description': input_data['instanceDescription'],
        #             'resources': {
        #                 'memory': input_data['memoryResources'],
        #                 'cpu': input_data['cpuResources']
        #             },
        #             'customProperties': custom_properties
        #         },
        #         'activate': input_data['active']}
        #
        #     files = {
        #         'content': my_zip,
        #         'instanceCreateParams': (None, json.dumps(instance_create_params))
        #     }
        #     apiService = UsuPlatformApiService(config=self.config)
        #     return apiService.post('ia/v1/go/deployments/python', files=files, req=self.request)
