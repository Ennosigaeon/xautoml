import {IRenderMime} from '@jupyterlab/rendermime-interfaces';
import {OutputWidget} from "./demo";

const MIME_TYPE = 'application/xautoml';
export const rendererFactory: IRenderMime.IRendererFactory = {
    safe: true,
    mimeTypes: [MIME_TYPE],
    createRenderer: (options) => new OutputWidget(options),
};

const extension: IRenderMime.IExtension = {
    id: 'xautoml:plugin',
    rendererFactory,
    rank: 0,
    dataType: 'json',
    fileTypes: [
        {
            name: 'xautoml',
            mimeTypes: [MIME_TYPE],
            extensions: ['.xautoml'],
        },
    ],
    documentWidgetFactoryOptions: {
        name: 'XAutoML Viewer',
        primaryFileType: 'xautoml',
        fileTypes: ['xautoml'],
        defaultFor: ['xautoml'],
    },
};

// noinspection JSUnusedGlobalSymbols
export default extension;
