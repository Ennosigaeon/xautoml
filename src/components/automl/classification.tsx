import {IFileBrowserFactory} from "@jupyterlab/filebrowser";
import React from "react";
import {TwoColumnLayout} from "../../util/layout";
import {KernelWrapper} from "../../jupyter";
import {DataSetTable} from "../details/dataset_table";
import {FormValues, InputForm} from "./form";


interface ClassificationRootState {
    running: boolean
    dfPreview: string
}

interface ClassificationRootProps {
    fileBrowserFactory: IFileBrowserFactory
    kernel: KernelWrapper
}

export class ClassificationRoot extends React.Component<ClassificationRootProps, ClassificationRootState> {

    constructor(props: ClassificationRootProps) {
        super(props);
        this.state = {
            running: false,
            dfPreview: undefined
        }

        this.loadPreview = this.loadPreview.bind(this)
        this.onStart = this.onStart.bind(this)
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
            this.setState({dfPreview: response.preview})
        })
    }

    private onStart(formValues: FormValues) {
        console.log(`Starting optimization with configuration ${JSON.stringify(formValues)}`)
        this.setState({running: true})
    }

    render() {
        return (
            <div>
                <TwoColumnLayout>
                    <InputForm fileBrowserFactory={this.props.fileBrowserFactory} kernel={this.props.kernel}
                               onFileSelection={this.loadPreview} onSubmit={this.onStart}/>
                    <>
                        {this.state.dfPreview &&
                            <>
                                <h2>Data Set Preview</h2>
                                <DataSetTable data={this.state.dfPreview} selectedSample={undefined}/>
                            </>
                        }
                    </>
                </TwoColumnLayout>
            </div>
        );
    }
}
