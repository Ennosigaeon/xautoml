import React from "react";
import {JupyterContext} from "../util";
import {DecisionSurfaceResponse, EnsembleOverview} from "../dao";
import {CollapseComp} from "../util/collapse";
import {TwoColumnLayout} from "../util/layout";
import {ErrorIndicator} from "../util/error";
import {LoadingIndicator} from "../util/loading";
import {DatasetTable} from "./details/dataset_table";
import {EnsembleTable} from "./ensemble/ensemble_table";
import {CandidateId, Prediction} from "../model";
import {DecisionSurface} from "./ensemble/decision_surface";
import {Checkbox} from "@material-ui/core";

interface EnsembleProps {
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
                <CollapseComp name={'ensemble'} showInitial={true}>
                    <h4>Ensemble Overview</h4>
                    <>
                        <ErrorIndicator error={overviewError}/>
                        {!overviewError &&
                            <>
                                <LoadingIndicator loading={overview === undefined}/>

                                {overview &&
                                    <TwoColumnLayout flexShrinkRight={'0'}>
                                        <div style={{marginTop: '10px'}}>
                                            <DatasetTable data={overview.df}
                                                          selectedSample={selectedSample}
                                                          onSampleClick={this.selectSampleIdx}/>
                                        </div>
                                        <EnsembleTable metrics={overview.metrics} predictions={predictions}
                                                       onCandidateSelection={this.props.onCandidateSelection}/>
                                    </TwoColumnLayout>
                                }
                            </>
                        }
                    </>
                </CollapseComp>

                <CollapseComp name={'decision-surface'} showInitial={true}>
                    <h4>Decision Surface</h4>
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
                                                        <h5>{cid}</h5>
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
