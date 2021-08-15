import {JupyterFrontEnd, JupyterFrontEndPlugin} from '@jupyterlab/application';
import {IRenderMimeRegistry} from '@jupyterlab/rendermime';
import {INotebookTracker} from '@jupyterlab/notebook';
import {IRenderMime} from '@jupyterlab/rendermime-interfaces';
import {JupyterWidget} from "./root";
import {TagTool} from "@jupyterlab/celltags";
import {Jupyter} from "./jupyter";

const MIME_TYPE = 'application/xautoml+json';

const extension: JupyterFrontEndPlugin<void> = {
    id: 'xautoml:plugin',
    autoStart: true,
    requires: [IRenderMimeRegistry, INotebookTracker],
    activate: (app: JupyterFrontEnd,
               rendermime: IRenderMimeRegistry,
               notebooks: INotebookTracker) => {
        const rendererFactory: IRenderMime.IRendererFactory = {
            safe: true,
            mimeTypes: [MIME_TYPE],
            createRenderer: (options) => new JupyterWidget(options, new Jupyter(notebooks, new TagTool(notebooks, app))),
        };

        // Add a renderer factory to application rendermime registry.
        rendermime.addFactory(rendererFactory, 0);

        notebooks.widgetAdded.connect((sender, panel) => {
            // Get the notebook's context and rendermime;
            const {content: {rendermime}} = panel;

            // Add the renderer factory to the notebook's rendermime registry;
            rendermime.addFactory(rendererFactory, 0);
        });

        app.docRegistry.addFileType({
            name: 'xautoml',
            mimeTypes: [MIME_TYPE],
            extensions: ['.xautoml', '.xautoml.json']
        });
    }
}

export default extension;
