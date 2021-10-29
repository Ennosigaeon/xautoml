import React from "react";
import {Candidate, MetaInformation} from "../model";
import {JupyterContext} from "../util";
import {TwoColumnLayout} from "../util/layout";
import {LimeComponent} from "./details/lime";
import {FeatureImportanceComponent} from "./details/feature_importance";
import {RawDataset} from "./details/raw_dataset";
import {DetailsModel} from "./details/model";
import {GlobalSurrogateComponent} from "./details/global_surrogate";
import {CollapseComp} from "../util/collapse";
import {PerformanceComponent} from "./details/performance";

interface DataSetDetailsProps {
    candidate: Candidate
    component: [string, string]
    meta: MetaInformation
}

interface DataSetDetailsState {
    selectedSample: number

    showFeatureImportance: boolean
    showGlobalSurrogate: boolean
}

export class DataSetDetailsComponent extends React.Component<DataSetDetailsProps, DataSetDetailsState> {

    static selectedClassName = 'selected-config'
    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: DataSetDetailsProps) {
        super(props);
        this.state = {selectedSample: undefined, showFeatureImportance: true, showGlobalSurrogate: true}

        this.handleSampleSelection = this.handleSampleSelection.bind(this)
        this.toggleFeatureImportance = this.toggleFeatureImportance.bind(this)
        this.toggleGlobalSurrogate = this.toggleGlobalSurrogate.bind(this)
    }

    private handleSampleSelection(idx: number) {
        this.setState({selectedSample: idx})
    }

    private toggleFeatureImportance() {
        this.setState((state) => ({showFeatureImportance: !state.showFeatureImportance}))
    }

    private toggleGlobalSurrogate() {
        this.setState((state) => ({showGlobalSurrogate: !state.showGlobalSurrogate}))
    }

    render() {
        const {candidate, meta, component} = this.props
        const {selectedSample} = this.state

        const model = new DetailsModel(meta, candidate, component[0], component[1], selectedSample)

        return (
            <>
                <CollapseComp showInitial={true}>
                    <h4>Data Set Preview</h4>
                    <TwoColumnLayout widthRight={'15%'}>
                        <RawDataset model={model} onSampleClick={this.handleSampleSelection}/>
                        <LimeComponent model={model}/>
                    </TwoColumnLayout>
                </CollapseComp>

                <CollapseComp showInitial={true}>
                    <h4>Performance Details</h4>
                    <PerformanceComponent model={model}/>
                </CollapseComp>

                <CollapseComp showInitial={true}>
                    <h4>Feature Importance</h4>
                    <FeatureImportanceComponent model={model} height={200}/>
                </CollapseComp>

                <CollapseComp showInitial={true}>
                    <h4>Global Approximation</h4>
                    <GlobalSurrogateComponent model={model}/>
                </CollapseComp>
            </>
        )
    }
}
