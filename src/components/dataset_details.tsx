import React from "react";
import {Candidate, MetaInformation} from "../model";
import {JupyterContext} from "../util";
import {TwoColumnLayout} from "../util/layout";
import {LimeComponent} from "./details/lime";
import {FeatureImportanceComponent} from "./details/feature_importance";
import {RawDataset} from "./details/raw_dataset";
import {DetailsModel} from "./details/model";
import {GlobalSurrogateComponent} from "./details/global_surrogate";

interface DataSetDetailsProps {
    candidate: Candidate
    component: [string, string]
    meta: MetaInformation
}

interface DataSetDetailsState {
    selectedSample: number
}

export class DataSetDetailsComponent extends React.Component<DataSetDetailsProps, DataSetDetailsState> {

    static selectedClassName = 'selected-config'
    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;
    dfTableRef = React.createRef<HTMLDivElement>()

    constructor(props: DataSetDetailsProps) {
        super(props);
        this.state = {selectedSample: undefined}

        this.handleSampleSelection = this.handleSampleSelection.bind(this)
    }

    private handleSampleSelection(idx: number) {
        this.setState({selectedSample: idx})
    }

    render() {
        const {candidate, meta, component} = this.props
        const {selectedSample} = this.state

        const model = new DetailsModel(meta, candidate, component[0], component[1], selectedSample)

        return (
            <>
                <TwoColumnLayout>
                    <>
                        <RawDataset model={model} onSampleClick={this.handleSampleSelection}/>
                        <FeatureImportanceComponent model={model} height={200}/>
                        <GlobalSurrogateComponent model={model}/>
                    </>
                    <>
                        <LimeComponent model={model}/>
                    </>
                </TwoColumnLayout>
            </>
        )
    }
}
