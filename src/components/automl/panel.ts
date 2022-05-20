import {ISessionContext, ReactWidget, SessionContext, sessionContextDialogs,} from '@jupyterlab/apputils';
import {ServiceManager} from '@jupyterlab/services';
import {Message} from '@lumino/messaging';
import {StackedPanel} from '@lumino/widgets';
import {KernelWrapper} from "../../jupyter";

/**
 * The class name added to the panels.
 */
const PANEL_CLASS = 'jp-RovaPanel';

/**
 * A panel which has the ability to add other children.
 */
export class KernelPanel extends StackedPanel {
    public readonly model: KernelWrapper;
    private readonly _sessionContext: SessionContext;
    private readonly _child: ReactWidget;

    constructor(child: ReactWidget, manager: ServiceManager.IManager) {
        super();
        this.addClass(PANEL_CLASS);
        this.id = 'kernel-messaging-panel';
        this.title.label = 'Data Sciece Wizard Kernel'
        this.title.closable = true;

        this._sessionContext = new SessionContext({
            sessionManager: manager.sessions,
            specsManager: manager.kernelspecs,
            name: 'Data Science Wizard',
        });

        this._child = child
        child.addClass('jp-Notebook')
        this.model = new KernelWrapper(this._sessionContext);

        this.addWidget(this._child);
        void this._sessionContext
            .initialize()
            .then(async (value) => {
                if (value) {
                    await sessionContextDialogs.selectKernel(this._sessionContext);
                }
            })
            .catch((reason) => {
                console.error(
                    `Failed to initialize the session in Data Science Wizard.\n${reason}`
                );
            });
    }

    get session(): ISessionContext {
        return this._sessionContext;
    }

    dispose(): void {
        this._sessionContext.dispose();
        super.dispose();
    }

    protected onCloseRequest(msg: Message): void {
        super.onCloseRequest(msg);
        this.dispose();
    }

}
