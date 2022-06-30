import React from 'react';
import {Slider, TextArea} from '@blueprintjs/core';
import {DeploymentModel, ResourceLimits} from "./model";
import {FileBrowser, FileDialog} from "@jupyterlab/filebrowser";
import {Dialog} from "@jupyterlab/apputils";
import {DeploymentIdUtils} from "./util";
import {PathExt} from "@jupyterlab/coreutils";
import {WaitingComponent} from "./waiting-dialog";
import {IAPService} from "./service";
import {LoadingIndicator} from "../../util/loading";
import {ErrorIndicator} from "../../util/error";

export class GoDeploymentComponent {

    private dialog: Dialog<any>
    private readonly model: DeploymentModel

    constructor(private name: string, private readonly fileBrowser: FileBrowser) {
        this.model = new DeploymentModel(DeploymentIdUtils.suggestDeploymentId(name), 1024, 500)

        this.openFileBrowser = this.openFileBrowser.bind(this)
        this.onValidation = this.onValidation.bind(this)
    }

    open() {
        const body = <DialogContent model={this.model}
                                    fileBrowser={this.fileBrowser}
                                    onOpenFileBrowser={this.openFileBrowser}
                                    onValidation={this.onValidation}/>

        this.dialog = new Dialog({
            title: 'Create new Deployment Instance',
            body: body,
            buttons: [
                Dialog.okButton({label: 'Deploy'}),
                Dialog.createButton({accept: true, label: 'Activate'}),
                Dialog.cancelButton()
            ]
        })

        this.dialog.launch().then((event: Dialog.IResult<DeploymentModel>) => {
            if (!event.button.accept)
                return

            this.model.active = event.button.label === 'Activate';

            const widget = <WaitingComponent config={this.model}/>
            const deployingDialog = new Dialog({
                title: 'Creating Deployment',
                body: widget,
                buttons: [Dialog.okButton({label: 'Ok'})]
            });
            deployingDialog.launch();
        })
    }

    private openFileBrowser() {
        this.dialog.reject()
        const fileDialog = FileDialog.getOpenFiles({
            manager: this.fileBrowser.model.manager,
            title: 'Select'
        });
        return fileDialog.then(result => {
            if (result.button.accept)
                this.model.additionalFiles = result.value.map(el => el.path)
            this.open()
        })
    }

    private onValidation(valid: boolean) {
        const disabled = !valid
        const buttons = this.dialog.node.getElementsByClassName('jp-Dialog-button jp-mod-accept jp-mod-styled')
        for (const button of buttons)
            (button as HTMLInputElement).disabled = disabled;
    }

}


interface DialogProps {
    model: DeploymentModel
    fileBrowser: FileBrowser;
    onOpenFileBrowser: () => void;
    onValidation: (valid: boolean) => void
}

interface DialogState {
    limits: ResourceLimits
    error: Error
}

class DialogContent extends React.Component<DialogProps, DialogState> {

    private readonly configMapRegex = RegExp(/^\w+=\w+$/, 'g')

    constructor(props: DialogProps) {
        super(props);
        this.state = {
            limits: undefined,
            error: undefined
        }

        IAPService.getLimits().then(limits => this.setState({limits: limits}))
            .catch(error => this.setState({error: error}))

        this.changeHandler = this.changeHandler.bind(this)
    }

    private changeHandler(key: string, value: any) {
        if (key === 'id')
            this.props.model.id = value
        else if (key == 'deploymentDescription')
            this.props.model.deploymentDescription = value
        else if (key == 'memoryResources')
            this.props.model.memoryResources = value
        else if (key == 'cpuResources')
            this.props.model.cpuResources = value
        else if (key == 'configMap')
            this.props.model.configMap = value
        else if (key == 'instanceDescription')
            this.props.model.instanceDescription = value
        else if (key == 'additionalFiles')
            this.props.model.additionalFiles = value
        else
            throw new Error(`Unknown field ${key}`)

        this.props.onValidation(this.isValidModel(this.props.model))
        this.forceUpdate()
    }

    private isValidModel(model: DeploymentModel): boolean {
        const configValid = model.configMap
            .split('\n')
            .map(line => line.trim().length === 0 || this.configMapRegex.test(line))
            .reduce((prev, cur) => prev && cur, true)

        return !!model.id && DeploymentIdUtils.isValidId(model.id) &&
            model.memoryResources >= this.state.limits.memory[0] && model.memoryResources <= this.state.limits.memory[1] &&
            model.cpuResources >= this.state.limits.memory[0] && model.memoryResources <= this.state.limits.memory[1] &&
            configValid
    }

    render() {
        const {model} = this.props
        const {limits, error} = this.state

        if (limits === undefined)
            return (
                <div className="go-deployment-dialog-body usu_iap">
                    <LoadingIndicator loading={error === undefined}/>
                    <ErrorIndicator error={error}/>
                </div>
            )

        return (
            <div className="go-deployment-dialog-body usu_iap">
                <div className="inline-button-container">
                    <h3>Deployment</h3>
                </div>

                <div className="flex-container">
                    <div>
                        <label className="bp3-label">
                            Name
                            <input
                                className={
                                    'jp-mod-styled full-width ' +
                                    (model.id && DeploymentIdUtils.isValidId(model.id)
                                        ? 'input-valid' : 'input-error')
                                }
                                inputMode="text"
                                required={true}
                                value={model.id}
                                onChange={e => this.changeHandler('id', e.target.value)}
                            />
                        </label>
                    </div>
                    <div>
                        <label className="bp3-label">
                            Description
                            <input
                                className="jp-mod-styled full-width"
                                inputMode="text"
                                value={model.deploymentDescription}
                                onChange={e => this.changeHandler('deploymentDescription', e.target.value)}
                            />
                        </label>
                    </div>
                </div>

                <h3>Instance</h3>
                <div className="flex-container">
                    <div>
                        <label className="bp3-label">
                            Resources

                            <div className="slider-container">
                                <div>
                                    <label>Memory in MB</label>
                                    <Slider
                                        min={limits.memory[0]}
                                        max={limits.memory[1]}
                                        stepSize={limits.memoryStep}
                                        labelRenderer={false}
                                        value={model.memoryResources}
                                        onChange={e => this.changeHandler('memoryResources', e)}
                                    />
                                    <input
                                        type="number"
                                        step={limits.memoryStep}
                                        min={limits.memory[0]}
                                        max={limits.memory[1]}
                                        className={'jp-mod-styled ' + (model.memoryResources ? 'input-valid' : 'input-error')}
                                        required={true}
                                        value={model.memoryResources}
                                        onChange={e => this.changeHandler('memoryResources', Number(e.target.value))}
                                    />
                                </div>

                                <div>
                                    <label>Milli-CPUs</label>
                                    <Slider
                                        min={limits.cpu[0]}
                                        max={limits.cpu[1]}
                                        stepSize={limits.cpuStep}
                                        labelRenderer={false}
                                        value={model.cpuResources}
                                        onChange={e => this.changeHandler('cpuResources', e)}
                                    />
                                    <input
                                        type="number"
                                        step={limits.cpuStep}
                                        min={limits.cpu[0]}
                                        max={limits.cpu[1]}
                                        className={'jp-mod-styled ' + (model.cpuResources ? 'input-valid' : 'input-error')}
                                        required={true}
                                        value={model.cpuResources}
                                        onChange={e => this.changeHandler('cpuResources', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </label>
                        <label className="bp3-label">
                            Configuration
                            <TextArea
                                className={'jp-mod-styled full-width'}
                                growVertically={false}
                                large={false}
                                rows={6}
                                onChange={e => this.changeHandler('configMap', e.target.value)}
                                value={model.configMap}
                            />
                        </label>
                    </div>
                    <div>
                        <label className="bp3-label">
                            Description
                            <input
                                className={'jp-mod-styled full-width'}
                                onChange={e => this.changeHandler('instanceDescription', e.target.value)}
                                value={model.instanceDescription}
                            />
                        </label>
                        <label className="bp3-label">
                            <div className="inline-button-container">
                                <label>Selected files/folders</label>
                                <button
                                    className="jp-Dialog-button jp-mod-reject jp-mod-styled"
                                    style={{marginLeft: '20px'}}
                                    id="GoDeploymentAdditionalSelection"
                                    onClick={this.props.onOpenFileBrowser}
                                >
                                    Select
                                </button>
                            </div>
                            <ul
                                className="file-list read-only-textbox"
                                style={{height: '154px'}}
                            >
                                {model.additionalFiles.map(el => <li className="file-list-item"
                                                                     key={el}>{el}</li>)}
                            </ul>
                        </label>
                    </div>
                </div>
            </div>
        )
    }
}
