import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {requestAPI} from './handler';

import {MainAreaWidget} from '@jupyterlab/apputils';

import {ILauncher} from '@jupyterlab/launcher';

import {reactIcon} from '@jupyterlab/ui-components';

import {TestWidget} from './widget';
import {DemoWidget} from "./demo";

/**
 * The command IDs used by the react-widget plugin.
 */
namespace CommandIDs {
    export const createClock = 'create-clock-widget';
    export const createList = 'create-filterable-list-widget';
}

/**
 * Initialization data for the xautoml extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
    id: 'xautoml:plugin',
    autoStart: true,
    optional: [ILauncher],
    activate: (app: JupyterFrontEnd, launcher: ILauncher) => {
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

        const {commands} = app;

        commands.addCommand(CommandIDs.createClock, {
            caption: 'Clock Counter Demo',
            label: 'Clock Counter Demo',
            icon: args => (args['isPalette'] ? null : reactIcon),
            execute: () => {
                const content = new TestWidget();
                const widget = new MainAreaWidget<TestWidget>({content});
                widget.title.label = 'Clock Counter Demo';
                widget.title.icon = reactIcon;
                app.shell.add(widget, 'main');
            }
        });

        commands.addCommand(CommandIDs.createList, {
            caption: 'Filterable List Demo',
            label: 'Filterable List Demo',
            icon: args => (args['isPalette'] ? null : reactIcon),
            execute: () => {
                const content = new DemoWidget();
                const widget = new MainAreaWidget<TestWidget>({content});
                widget.title.label = 'Filterable List Demo';
                widget.title.icon = reactIcon;
                app.shell.add(widget, 'main');
            }
        });

        if (launcher) {
            launcher.add({
                command: CommandIDs.createClock
            });
            launcher.add({
                command: CommandIDs.createList
            });
        }
    }
};

export default extension;
