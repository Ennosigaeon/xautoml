import {IFileBrowserFactory} from "@jupyterlab/filebrowser";
import React from "react";
import {TwoColumnLayout} from "../../util/layout";
import {KernelWrapper} from "../../jupyter";
import {DataSetSelector} from "./dataset_configuration";
import {IDocumentManager} from '@jupyterlab/docmanager';
import {OutputPanel} from "./output";
import {ProgressBar} from "./progress";
import {Result} from "./result";
import {ClassifierConfiguration} from "./classifier_configuration";
import {Button} from "@material-ui/core";


interface ClassificationRootState {
    running: boolean
    duration: number
    finish: boolean

    classifierValid: boolean
    dataSetValid: boolean
}

interface ClassificationRootProps {
    fileBrowserFactory: IFileBrowserFactory
    documentManager: IDocumentManager
    kernel: KernelWrapper
}

export class ClassificationRoot extends React.Component<ClassificationRootProps, ClassificationRootState> {

    private readonly classifierConfigRef: React.RefObject<ClassifierConfiguration> = React.createRef<ClassifierConfiguration>();
    private readonly dataSetConfigRef: React.RefObject<DataSetSelector> = React.createRef<DataSetSelector>();
    private readonly outpuRef: React.RefObject<OutputPanel> = React.createRef<OutputPanel>();

    constructor(props: ClassificationRootProps) {
        super(props);
        this.state = {
            running: false,
            finish: false,
            duration: undefined,

            classifierValid: true,
            dataSetValid: false
        }

        this.startOptimization = this.startOptimization.bind(this)
        this.onFinish = this.onFinish.bind(this)
        this.onClassifierValid = this.onClassifierValid.bind(this)
        this.onDataSetValid = this.onDataSetValid.bind(this)
        this.reset = this.reset.bind(this)
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
                this.outpuRef.current?.addMessage(msg)
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

    render() {
        return (
            <div>
                <h1>AutoML Classification</h1>
                <TwoColumnLayout>
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
                                <Button variant="contained" color="primary"
                                        disabled={!this.state.dataSetValid || !this.state.classifierValid}
                                        onClick={this.startOptimization}>
                                    Submit
                                </Button>
                            </>
                        }
                        {this.state.running && <ProgressBar duration={this.state.duration}/>}
                        {this.state.finish && <Result onReset={this.reset}/>}
                        {(this.state.running || this.state.finish) &&
                            <OutputPanel ref={this.outpuRef} finish={this.onFinish}/>}
                    </>
                </TwoColumnLayout>
            </div>
        );
    }
}
