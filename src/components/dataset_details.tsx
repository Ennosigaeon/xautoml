import React from "react";
import {Candidate, MetaInformation} from "../model";
import {OutputDescriptionData, requestOutputComplete} from "../handler";
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

    constructor(props: DataSetDetailsProps) {
        super(props);
        this.state = {loading: false, outputs: new Map<string, string>()}
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

    render() {
        const output = this.state.outputs.has(this.props.component) ?
            <div className={'jp-RenderedHTMLCommon'}
                 dangerouslySetInnerHTML={{__html: this.state.outputs.get(this.props.component)}}/> :
            <div>Missing</div>

        return (
            <>
                <h5>{this.props.candidate.id} ({this.props.component})</h5>
                <LoadingIndicator loading={this.state.loading}/>
                {!this.state.loading && output}
            </>
        )
    }
}
