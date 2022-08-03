import {IFileBrowserFactory} from "@jupyterlab/filebrowser";
import React from "react";
import {TwoColumnLayout} from "../../util/layout";
import {Jupyter, KernelWrapper} from "../../jupyter";
import {DataSetSelector} from "./dataset_configuration";
import {IDocumentManager} from '@jupyterlab/docmanager';
import {OutputPanel} from "./output";
import {ProgressBar} from "./progress";
import {Result} from "./result";
import {ClassifierConfiguration} from "./classifier_configuration";
import {Box} from "@material-ui/core";
import {IMimeBundle} from "@jupyterlab/nbformat";
import ReactRoot from "../../xautoml";
import {OptimizationData} from "../../model";
import {GoDeploymentComponent} from "../usu_iap/deployment-dialog";
import {IAPService} from "../usu_iap/service";
import {PathExt} from "@jupyterlab/coreutils";
import basename = PathExt.basename;

interface ClassificationRootState {
    running: boolean
    duration: number
    finish: boolean

    classifierValid: boolean
    dataSetValid: boolean

    data: OptimizationData

    deploymentEnabled: boolean
}

interface ClassificationRootProps {
    fileBrowserFactory: IFileBrowserFactory
    documentManager: IDocumentManager
    kernel: KernelWrapper

    mimeType: string
}

export class ClassificationRoot extends React.Component<ClassificationRootProps, ClassificationRootState> {

    private readonly classifierConfigRef: React.RefObject<ClassifierConfiguration> = React.createRef<ClassifierConfiguration>();
    private readonly dataSetConfigRef: React.RefObject<DataSetSelector> = React.createRef<DataSetSelector>();
    private readonly outputRef: React.RefObject<OutputPanel> = React.createRef<OutputPanel>();

    constructor(props: ClassificationRootProps) {
        super(props);
        this.state = {
            running: false,
            finish: false,
            duration: undefined,

            classifierValid: true,
            dataSetValid: false,

            data: undefined,

            deploymentEnabled: false
        }

        this.startOptimization = this.startOptimization.bind(this)
        this.onFinish = this.onFinish.bind(this)
        this.onClassifierValid = this.onClassifierValid.bind(this)
        this.onDataSetValid = this.onDataSetValid.bind(this)
        this.reset = this.reset.bind(this)
        this.openXAutoML = this.openXAutoML.bind(this)
        this.deployModel = this.deployModel.bind(this)
    }

    componentDidMount() {
        IAPService.enabled().then(enabled => this.setState({deploymentEnabled: enabled}))
            .catch(_ => this.setState({deploymentEnabled: false}))
    }

    componentWillUnmount() {
        this.props.kernel.close()
    }

    private startOptimization() {
        const data = this.dataSetConfigRef.current.state.config
        const classifier = this.classifierConfigRef.current.state.config
        this.setState({running: true, duration: classifier.runtime, finish: false})

        this.props.kernel.executeCode<any>(
            `
from xautoml.gui import optimize
optimize('${classifier.optimizer}', ${classifier.runtime}, ${classifier.timeout}, '${classifier.metric}', '''${classifier.config}''', '${data.inputFile}', '${data.target}')
            `,
            (msg) => {
                this.outputRef.current?.addMessage(msg)
            }
        )
    }

    private onDataSetValid(valid: boolean) {
        this.setState({dataSetValid: valid})
    }

    private onClassifierValid(valid: boolean) {
        this.setState({classifierValid: valid})
    }

    private onFinish() {
        this.setState({finish: true, running: false})
    }

    private reset() {
        this.setState({finish: false, running: false, duration: undefined})
    }

    private openXAutoML() {
        this.props.kernel.executeCode<IMimeBundle>(`
from xautoml.gui import render_xautoml
render_xautoml()
        `).then(response => {
            this.setState({data: OptimizationData.fromJson(response[this.props.mimeType] as unknown as OptimizationData)})
        })
    }

    private deployModel() {
        if (!this.state.deploymentEnabled) {
            window.alert('Deployment not enabled')
            return
        }

        this.props.kernel.executeCode<IMimeBundle>(`
from xautoml.gui import export
export('ENSEMBLE')
        `)
        const name = basename(this.dataSetConfigRef.current.state.config.inputFile, '.csv')
        new GoDeploymentComponent(name, this.props.fileBrowserFactory.createFileBrowser('usu_iap')).open()
    }

    render() {
        if (!!this.state.data) {
            const jupyter = new Jupyter(undefined, undefined, this.props.kernel.getSessionContext(), this.props.fileBrowserFactory)
            return <ReactRoot runHistory={this.state.data.runhistory} entrypoint={this.state.data.entrypoint} kwargs={new Map()} jupyter={jupyter}/>
        }

        return (
            <Box component={'div'} m={2} className={'automl'}>
                {!this.state.data &&
                    <>
                        <h1>AutoML Classification</h1>
                        <TwoColumnLayout flexShrinkLeft={"0.25"} flexGrowRight={"0.75"}>
                            <DataSetSelector fileBrowserFactory={this.props.fileBrowserFactory}
                                             documentManager={this.props.documentManager} kernel={this.props.kernel}
                                             isValid={this.onDataSetValid}
                                             ref={this.dataSetConfigRef}/>
                            <>
                                {(!this.state.running && !this.state.finish) &&
                                    <>
                                        <ClassifierConfiguration kernel={this.props.kernel}
                                                                 isValid={this.onClassifierValid}
                                                                 ref={this.classifierConfigRef}/>

                                        <hr style={{minWidth: '80%'}}/>
                                        <button
                                            className="jp-Dialog-button jp-mod-accept jp-mod-styled"
                                            disabled={!this.state.dataSetValid || !this.state.classifierValid}
                                            onClick={this.startOptimization}
                                        >
                                            Submit
                                        </button>
                                    </>
                                }
                                {this.state.running && <ProgressBar duration={this.state.duration}/>}
                                {this.state.finish && <Result onReset={this.reset} onXAutoML={this.openXAutoML}
                                                              onDeploy={this.deployModel}/>}
                                {(this.state.running || this.state.finish) &&
                                    <OutputPanel ref={this.outputRef} finish={this.onFinish}/>}
                            </>
                        </TwoColumnLayout>
                    </>
                }
            </Box>
        );
    }
}
