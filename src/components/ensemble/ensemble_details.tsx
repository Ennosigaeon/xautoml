import React from "react";
import {Candidate, MetaInformation, Runtime} from "../../model";
import {Components, JupyterContext} from "../../util";
import {DetailsModel} from "../details/model";
import {CollapseComp} from "../../util/collapse";
import {PerformanceComponent} from "../details/performance";
import {TwoColumnLayout} from "../../util/layout";
import {RawDataset} from "../details/raw_dataset";
import {LimeComponent} from "../details/lime";
import {FeatureImportanceComponent} from "../details/feature_importance";
import {GlobalSurrogateComponent} from "../details/global_surrogate";
import SOURCE = Components.SOURCE;
import ENSEMBLE = Components.ENSEMBLE;


interface EnsembleDetailsProps {
    meta: MetaInformation
}

interface EnsembleDetailsState {
    selectedSample: number
}

export class EnsembleDetailsComponent extends React.Component<EnsembleDetailsProps, EnsembleDetailsState> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: EnsembleDetailsProps) {
        super(props)
        this.state = {selectedSample: undefined}

        this.handleSampleSelection = this.handleSampleSelection.bind(this)
    }

    private handleSampleSelection(idx: number) {
        this.setState({selectedSample: idx})
    }

    render() {
        const {meta} = this.props
        const {selectedSample} = this.state

        const candidate = new Candidate(ENSEMBLE, '', 0, 0, new Runtime(0, 0, 0), undefined, undefined)
        const model = new DetailsModel(undefined, candidate, SOURCE, SOURCE, selectedSample)

        return (
            <>
                <CollapseComp name={'performance'} showInitial={false} help={PerformanceComponent.HELP}>
                    <h3>Performance Details</h3>
                    <PerformanceComponent model={model} meta={meta}/>
                </CollapseComp>

                <CollapseComp name={'raw-dataset'} showInitial={false} help={RawDataset.HELP}>
                    <h3>Data Set Preview</h3>
                    <TwoColumnLayout widthRight={'25%'}>
                        <RawDataset model={model} onSampleClick={this.handleSampleSelection}/>
                        <LimeComponent model={model} orientation={'vertical'}/>
                    </TwoColumnLayout>
                </CollapseComp>

                {/* TODO very slow */}
                {/*<CollapseComp name={'feature-importance'} showInitial={false} help={FeatureImportanceComponent.HELP}>*/}
                {/*    <h3>Feature Importance</h3>*/}
                {/*    <FeatureImportanceComponent model={model}/>*/}
                {/*</CollapseComp>*/}

                <CollapseComp name={'global-surrogate'} showInitial={false} help={GlobalSurrogateComponent.HELP}>
                    <h3>Global Approximation</h3>
                    <GlobalSurrogateComponent model={model}/>
                </CollapseComp>
            </>
        )
    }
}
