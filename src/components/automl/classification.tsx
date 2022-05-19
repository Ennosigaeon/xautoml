import {IFileBrowserFactory} from "@jupyterlab/filebrowser";
import React from "react";
import {TwoColumnLayout} from "../../util/layout";
import {KernelWrapper} from "../../jupyter";
import {DataSetTable} from "../details/dataset_table";
import {FormValues, InputForm} from "./form";
import {Button} from "@material-ui/core";
import {IDocumentManager} from '@jupyterlab/docmanager';
import {OutputPanel} from "./output";
import {ProgressBar} from "./progress";
import {Result} from "./result";


interface ClassificationRootState {
    running: boolean
    duration: number
    finish: boolean
    file: string
    dfPreview: string
}

interface ClassificationRootProps {
    fileBrowserFactory: IFileBrowserFactory
    documentManager: IDocumentManager
    kernel: KernelWrapper
}

export class ClassificationRoot extends React.Component<ClassificationRootProps, ClassificationRootState> {

    private readonly ref: React.RefObject<OutputPanel> = React.createRef<OutputPanel>();

    constructor(props: ClassificationRootProps) {
        super(props);
        this.state = {
            running: false,
            finish: false,
            duration: undefined,
            file: undefined,
            dfPreview: undefined
        }

        this.loadPreview = this.loadPreview.bind(this)
        this.onStart = this.onStart.bind(this)
        this.onShowDataSet = this.onShowDataSet.bind(this)
        this.onFinish = this.onFinish.bind(this)
    }

    componentWillUnmount() {
        this.props.kernel.close()
    }

    private loadPreview(file: string) {
        this.props.kernel.executeCode<{ preview: string }>(
            `
from xautoml.gui import dataset_preview
dataset_preview('${file}')
                `
        ).then(response => {
            this.setState({dfPreview: response.preview, file: file})
        })
    }

    private onStart(data: FormValues) {
        console.log(`Starting optimization with configuration ${JSON.stringify(data)}`)
        this.setState({running: true, duration: data.runtime, finish: false})

        this.props.kernel.executeCode<any>(
            `
from xautoml.gui import optimize
optimize('${data.optimizer}', ${data.runtime}, ${data.timeout}, '${data.metric}', '''${data.config}''')
            `,
            (msg) => {
                this.ref.current?.addMessage(msg)
            }
        )
    }

    private onShowDataSet() {
        this.props.documentManager.openOrReveal(this.state.file)
    }

    private onFinish() {
        this.setState({finish: true, running: false})
    }

    render() {
        return (
            <div>
                <TwoColumnLayout>
                    <InputForm fileBrowserFactory={this.props.fileBrowserFactory} kernel={this.props.kernel}
                               onFileSelection={this.loadPreview} onSubmit={this.onStart}
                               submitDisabled={this.state.running}/>
                    <>
                        {(this.state.dfPreview && !this.state.running && !this.state.finish) &&
                            <>
                                <h2>Data Set Preview</h2>
                                <DataSetTable data={this.state.dfPreview} selectedSample={undefined}/>
                                <Button variant="contained" color="primary" onClick={this.onShowDataSet}>Show Complete
                                    Data Set
                                </Button>
                            </>
                        }

                        {(this.state.running || this.state.finish) &&
                            <>
                                {!this.state.finish && <ProgressBar duration={this.state.duration}/>}
                                {this.state.finish && <Result/>}
                                <OutputPanel ref={this.ref} finish={this.onFinish}/>
                            </>
                        }
                    </>
                </TwoColumnLayout>
            </div>
        );
    }
}
