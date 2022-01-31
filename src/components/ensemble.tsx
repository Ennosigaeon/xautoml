import React from "react";
import {JupyterContext} from "../util";
import {DecisionSurfaceResponse, EnsembleOverview} from "../dao";
import {CollapseComp} from "../util/collapse";
import {TwoColumnLayout} from "../util/layout";
import {ErrorIndicator} from "../util/error";
import {LoadingIndicator} from "../util/loading";
import {DataSetTable} from "./details/dataset_table";
import {EnsembleTable} from "./ensemble/ensemble_table";
import {CandidateId, MetaInformation, Prediction} from "../model";
import {DecisionSurface} from "./ensemble/decision_surface";
import {Checkbox} from "@material-ui/core";
import {Heading} from "../util/heading";
import {EnsembleDetailsComponent} from "./ensemble/ensemble_details";

interface EnsembleProps {
    meta: MetaInformation
    onCandidateSelection: (cid: Set<CandidateId>, show?: boolean) => void
}

interface EnsembleState {
    overview: EnsembleOverview
    overviewError: Error

    predictions: Map<CandidateId, Prediction>
    selectedSample: number

    decisionSurface: DecisionSurfaceResponse
    surfaceError: Error
    showScatter: boolean
}

export class Ensemble extends React.Component<EnsembleProps, EnsembleState> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: EnsembleProps) {
        super(props);
        this.state = {
            overview: undefined,
            overviewError: undefined,
            predictions: new Map<CandidateId, Prediction>(),
            selectedSample: undefined,
            decisionSurface: undefined,
            surfaceError: undefined,
            showScatter: false
        }

        this.selectSampleIdx = this.selectSampleIdx.bind(this)
        this.toggleShowScatter = this.toggleShowScatter.bind(this)
    }

    componentDidMount() {
        this.context.requestEnsembleOverview()
            .then(data => this.setState({overview: data}))
            .catch(error => {
                console.error(`Failed to fetch ensemble overview: \n${error.name}: ${error.message}`);
                this.setState({overviewError: error})
            });

        this.context.requestEnsembleDecisionSurface()
            .then(data => this.setState({decisionSurface: data}))
            .catch(error => {
                console.error(`Failed to fetch decision surface: \n${error.name}: ${error.message}`);
                this.setState({surfaceError: error})
            });

    }

    private selectSampleIdx(idx: number) {
        this.context.requestEnsemblePredictions(idx)
            .then((data: Map<CandidateId, Prediction>) => this.setState({predictions: data}))
    }

    private toggleShowScatter(_: React.ChangeEvent, checked: boolean) {
        this.setState({showScatter: checked})
    }

    render() {
        const {
            overview,
            selectedSample,
            predictions,
            overviewError,
            surfaceError,
            decisionSurface,
            showScatter
        } = this.state

        return (
            <>
                <CollapseComp name={'ensemble-details'} showInitial={true} help={''}>
                    <h3>Insights for Ensemble</h3>
                    <EnsembleDetailsComponent meta={this.props.meta}/>
                </CollapseComp>

                <CollapseComp name={'ensemble'} showInitial={true}
                              help={'Displays the individual ensemble members and some basic statics. In addition ' +
                                  'a selection of data set samples with conflicting predictions in the ensemble is ' +
                                  'given.'}>
                    <h3>Ensemble Overview</h3>
                    <>
                        <ErrorIndicator error={overviewError}/>
                        {!overviewError &&
                            <>
                                <LoadingIndicator loading={overview === undefined}/>

                                {overview &&
                                    <TwoColumnLayout flexShrinkLeft={'1'} flexGrowLeft={'0'} flexGrowRight={'1'}
                                                     flexShrinkRight={'0'}>
                                        <div style={{marginTop: '10px'}}>
                                            <Heading help={'A selection of input data samples, where at least one ' +
                                                'ensemble member had another prediction than the rest.'}>
                                                <h4>Samples with Conflicting Predictions </h4>
                                            </Heading>
                                            <DataSetTable data={overview.df}
                                                          selectedSample={selectedSample}
                                                          onSampleClick={this.selectSampleIdx}/>
                                        </div>

                                        <>
                                            <Heading help={EnsembleTable.HELP}>
                                                <h4>Ensemble Members</h4>
                                            </Heading>
                                            <EnsembleTable metrics={overview.metrics} predictions={predictions}
                                                           onCandidateSelection={this.props.onCandidateSelection}/>
                                        </>
                                    </TwoColumnLayout>
                                }
                            </>
                        }
                    </>
                </CollapseComp>

                <CollapseComp name={'decision-surface'} showInitial={true} help={DecisionSurface.HELP}>
                    <h3>Decision Surface</h3>
                    <>
                        <ErrorIndicator error={surfaceError}/>
                        {!surfaceError &&
                            <>
                                <LoadingIndicator loading={decisionSurface === undefined}/>

                                {decisionSurface &&
                                    <>
                                        <label className={'MuiFormControlLabel-root'}>
                                            <Checkbox checked={showScatter} onChange={this.toggleShowScatter}/>
                                            <span>Show&nbsp;Scatter&nbsp;Plot</span>
                                        </label>
                                        <div className={'decision-surface'}>
                                            {Array.from(decisionSurface.contours.entries()).map(([cid, value]) => {
                                                return (
                                                    <div key={cid}>
                                                        <h4 onClick={() => {
                                                            if (cid !== 'Ensemble')
                                                                this.props.onCandidateSelection(new Set<CandidateId>([cid]), true)
                                                        }}
                                                            style={{cursor: 'pointer'}}>{cid}</h4>
                                                        <DecisionSurface contour={value}
                                                                         X={decisionSurface.X}
                                                                         y={decisionSurface.y}
                                                                         colors={decisionSurface.colors}
                                                                         showScatter={showScatter}/>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </>
                                }
                            </>
                        }
                    </>
                </CollapseComp>
            </>
        )
    }
}
