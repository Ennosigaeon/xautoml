import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './handler';

/**
 * Initialization data for the xautoml extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'xautoml:plugin',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension xautoml is activated!');

    requestAPI<any>('get_example')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The xautoml server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default extension;
