import {ILayoutRestorer, JupyterFrontEnd, JupyterFrontEndPlugin} from '@jupyterlab/application';
import {IRenderMimeRegistry} from '@jupyterlab/rendermime';
import {INotebookTracker} from '@jupyterlab/notebook';
import {ICommandPalette, MainAreaWidget, WidgetTracker} from '@jupyterlab/apputils';
import {ILauncher} from '@jupyterlab/launcher';
import {IRenderMime} from '@jupyterlab/rendermime-interfaces';
import {JupyterWidget} from "./xautoml";
import {TagTool} from "@jupyterlab/celltags";
import {Jupyter} from "./jupyter";
import {reactIcon} from '@jupyterlab/ui-components';
import {ClassificationWidget, TimeSeriesWidget} from "./automl";
import {IFileBrowserFactory} from '@jupyterlab/filebrowser';
import {KernelPanel} from "./components/automl/panel";
import {IDocumentManager} from "@jupyterlab/docmanager";

const MIME_TYPE = 'application/xautoml+json';

namespace CommandIDs {
    export const classification = 'create-dswizard-classification';
    export const timeseries = 'create-dswizard-timeseries';
}

const extension: JupyterFrontEndPlugin<void> = {
    id: 'xautoml:plugin',
    autoStart: true,
    requires: [IRenderMimeRegistry, INotebookTracker, ICommandPalette, IFileBrowserFactory, ILayoutRestorer, IDocumentManager, ILauncher],
    activate: (app: JupyterFrontEnd,
               rendermime: IRenderMimeRegistry,
               notebooks: INotebookTracker,
               palette: ICommandPalette,
               fileBrowserFactory: IFileBrowserFactory,
               layoutRestorer: ILayoutRestorer,
               documentManager: IDocumentManager,
               launcher: ILauncher) => {
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

        const classification = CommandIDs.classification;
        app.commands.addCommand(classification, {
            caption: 'Start a new AutoML classification optimization',
            label: 'Automatic Classification',
            icon: (args) => (args['isPalette'] ? null : reactIcon),
            execute: () => {
                const content = new ClassificationWidget(fileBrowserFactory, documentManager)
                const kernelWrapper = new KernelPanel(content, app.serviceManager);
                content.kernel = kernelWrapper.model;
                const widget = new MainAreaWidget<KernelPanel>({content: kernelWrapper});
                widget.title.label = 'Data Science Wizard';
                widget.title.icon = reactIcon;
                app.shell.add(widget, 'main');
            },
        });

        if (launcher) {
            launcher.add({
                command: classification,
                category: 'Data Science Wizard',
                rank: 1,
            });
        }

        const timeseries = CommandIDs.timeseries;
        app.commands.addCommand(timeseries, {
            caption: 'Start a new AutoML timeseries forecasting optimization',
            label: 'Automatic Timeseries Forecasting',
            icon: (args) => (args['isPalette'] ? null : reactIcon),
            execute: () => {
                console.log('Timeseries not implemented yet')
                const content = new TimeSeriesWidget();
                const widget = new MainAreaWidget<TimeSeriesWidget>({content});
                widget.title.label = 'Data Science Wizard';
                widget.title.icon = reactIcon;
                app.shell.add(widget, 'main');
            },
        });

        if (launcher) {
            launcher.add({
                command: timeseries,
                category: 'Data Science Wizard',
                rank: 2,
            });
        }

        // Track and restore the widget state
        const trackerClassification = new WidgetTracker<MainAreaWidget<ClassificationWidget>>({
            namespace: 'dswizard'
        });
        layoutRestorer.restore(trackerClassification, {
            command: classification,
            name: () => 'dswizard'
        });

    }
}

export default extension;
