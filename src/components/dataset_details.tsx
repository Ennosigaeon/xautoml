import React from "react";
import {Candidate, Explanations, MetaInformation, Structure} from "../model";
import {cidToSid, Components, JupyterContext} from "../util";
import {TwoColumnLayout} from "../util/layout";
import {LimeComponent} from "./details/lime";
import {FeatureImportanceComponent} from "./details/feature_importance";
import {RawDataset} from "./details/raw_dataset";
import {DetailsModel} from "./details/model";
import {GlobalSurrogateComponent} from "./details/global_surrogate";
import {CollapseComp} from "../util/collapse";
import {PerformanceComponent} from "./details/performance";
import {BanditExplanationsComponent} from "./bandit_explanation";
import {HPImportanceComp} from "./details/hp_importance";
import {SurrogateExplanation} from "./surrogate_explanation";

interface DataSetDetailsProps {
    candidate: Candidate
    structure: Structure
    componentId: string
    componentLabel: string
    meta: MetaInformation

    structures: Structure[]
    explanations: Explanations
}

interface DataSetDetailsState {
    selectedSample: number

    showFeatureImportance: boolean
    showGlobalSurrogate: boolean
}

export class DataSetDetailsComponent extends React.Component<DataSetDetailsProps, DataSetDetailsState> {

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
        const {candidate, structure, meta, componentId, componentLabel, structures, explanations} = this.props
        const {selectedSample} = this.state

        const model = new DetailsModel(meta, candidate, componentId, componentLabel, selectedSample)

        return (
            <>
                <CollapseComp showInitial={true}>
                    <h4>Search Space Overview</h4>
                    {explanations.structures &&
                        <BanditExplanationsComponent explanations={explanations.structures}
                                                     structures={structures}
                                                     timestamp={cidToSid(candidate.id)}/>
                    }
                    <SurrogateExplanation meta={meta} structure={structure} candidate={candidate}
                                          explanation={explanations.configs.get(candidate.id)}/>
                </CollapseComp>

                <CollapseComp showInitial={true} help={RawDataset.HELP + '\n\n' + LimeComponent.HELP}>
                    <h4>Data Set Preview</h4>
                    <TwoColumnLayout widthRight={'15%'}>
                        <RawDataset model={model} onSampleClick={this.handleSampleSelection}/>
                        <LimeComponent model={model}/>
                    </TwoColumnLayout>
                </CollapseComp>

                <CollapseComp showInitial={true} help={HPImportanceComp.HELP}>
                    <h4>Hyperparameter Importance of {Components.isPipEnd(model.component) ? <>All Components</> :
                        <i>{model.algorithm} ({model.component})</i>}</h4>
                    <HPImportanceComp structure={structure} component={componentId}/>
                </CollapseComp>

                <CollapseComp showInitial={true} help={PerformanceComponent.HELP}>
                    <h4>Performance Details</h4>
                    <PerformanceComponent model={model} candidateMap={new Map(structure.configs.map(c => [c.id, c]))}/>
                </CollapseComp>

                <CollapseComp showInitial={true} help={FeatureImportanceComponent.HELP}>
                    <h4>Feature Importance</h4>
                    <FeatureImportanceComponent model={model} height={200}/>
                </CollapseComp>

                <CollapseComp showInitial={true} help={GlobalSurrogateComponent.HELP}>
                    <h4>Global Approximation</h4>
                    <GlobalSurrogateComponent model={model}/>
                </CollapseComp>
            </>
        )
    }
}
