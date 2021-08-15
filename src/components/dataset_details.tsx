import React from "react";
import {Candidate, MetaInformation} from "../model";
import {OutputDescriptionData, requestOutputComplete} from "../handler";
import {JupyterContext} from "../util";
import {Button} from "@material-ui/core";
import {LoadingIndicator} from "./loading";

interface DataSetDetailsProps {
    candidate: Candidate
    component: string
    meta: MetaInformation
}

interface DataSetDetailsState {
    loading: boolean
    outputs: OutputDescriptionData
}


export class DataSetDetailsComponent extends React.Component<DataSetDetailsProps, DataSetDetailsState> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: DataSetDetailsProps) {
        super(props);
        this.state = {loading: false, outputs: new Map<string, string>()}

        this.handleLoadDataframe = this.handleLoadDataframe.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<DataSetDetailsProps>, prevState: Readonly<DataSetDetailsState>, snapshot?: any) {
        if (prevProps.component !== this.props.component) {
            if (this.state.loading) {
                // Loading already in progress
                return
            }
            if (this.state.outputs.size > 0) {
                // Outputs already cached
                return
            }

            this.setState({loading: true})
            requestOutputComplete(this.props.candidate.id, this.props.meta.data_file, this.props.meta.model_dir)
                .then(data => this.setState({outputs: data, loading: false}))
                .catch(reason => {
                    // TODO handle error
                    console.error(`Failed to fetch output data.\n${reason}`);
                    this.setState({loading: false})
                });
        }
    }

    private handleLoadDataframe() {
        const framework = 'dswizard'

        this.context.createCell(`
from xautoml.util import io_utils

xautoml_X, _, xautoml_feature_labels = io_utils.load_input_data('${this.props.meta.data_file}', framework='${framework}')
xautoml_pipeline = io_utils.load_pipeline('${this.props.meta.model_dir}', '${this.props.candidate.id}', framework='${framework}')

xautoml_df = io_utils.load_output_dataframe(xautoml_pipeline, '${this.props.component}', xautoml_X, xautoml_feature_labels)
xautoml_df
        `.trim())
    }

    render() {
        const {component, candidate} = this.props
        const {loading, outputs} = this.state

        const output = outputs.has(component) ?
            <div className={'jp-RenderedHTMLCommon'}
                 dangerouslySetInnerHTML={{__html: outputs.get(component)}}/> :
            <div>Missing</div>

        return (
            <>
                <h4>{candidate.id} ({component})</h4>
                <Button onClick={this.handleLoadDataframe}>Show In Jupyter</Button>
                <div style={{display: 'flex'}}>
                    <div style={{flex: "1 1 auto", overflowX: 'auto'}}>
                        <LoadingIndicator loading={loading}/>
                        {!loading && output}
                    </div>
                    <div>
                        <LoadingIndicator loading={true}/>
                    </div>
                </div>
            </>
        )
    }
}
