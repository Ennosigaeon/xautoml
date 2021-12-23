import React from "react";
import {CollapseComp} from "../util/collapse";
import {BanditExplanationsComponent} from "./search_space/bandit_explanation";
import {ParallelCoordinates} from "./pc/parallel_corrdinates";
import {CandidateId, Config, ConfigValue, Explanations, MetaInformation, Structure} from "../model";
import Slider from "rc-slider";
import {ConfigSimilarity} from "./search_space/config_similarity";
import {ConfigSimilarityResponse} from "../handler";
import {SamplingHistory} from "./search_space/sampling_history";
import * as d3 from "d3";
import {HyperparameterHistory} from "./search_space/model";
import CategoricalHyperparameter = Config.CategoricalHyperparameter;
import NumericalHyperparameter = Config.NumericalHyperparameter;

interface SearchSpaceProps {
    structures: Structure[],
    meta: MetaInformation,
    explanations: Explanations,
    selectedCandidates: Set<CandidateId>
    hideUnselectedCandidates: boolean
    onCandidateSelection?: (cid: Set<CandidateId>, show?: boolean) => void
}

interface SearchSpaceState {
    sliderMarks: { [key: string]: string; }
    timestamp: number
    configSimilarity: ConfigSimilarityResponse
    hpHistory: HyperparameterHistory
}

export class SearchSpace extends React.Component<SearchSpaceProps, SearchSpaceState> {

    private readonly cids: string[]

    constructor(props: SearchSpaceProps) {
        super(props);

        const sliderMarks: { [key: string]: string; } = {}

        this.cids = [].concat(...this.props.structures.map(s => s.configs.map(c => c.id)))

        let keys: string[]
        if (this.cids.length <= 10)
            keys = this.cids
        else if (this.cids.length <= 50)
            keys = this.cids.map(c => c.split(':').slice(1).join(':'))
        else if (this.cids.length <= 100)
            keys = this.cids.map((c, idx) => idx.toString())
        else {
            const stepSize = Math.ceil(this.cids.length / 100)
            keys = this.cids
                .map((c, idx) => idx)
                .filter(idx => idx % stepSize === 0)
                .map(idx => idx.toString())
        }

        keys.forEach((k, idx) => sliderMarks[idx] = k)
        this.state = {
            sliderMarks: sliderMarks,
            timestamp: keys.length - 1,
            configSimilarity: undefined,
            hpHistory: undefined
        }

        this.changeTimestamp = this.changeTimestamp.bind(this)
        this.onHyperparameterSelection = this.onHyperparameterSelection.bind(this)
    }

    private changeTimestamp(v: number) {
        this.setState({timestamp: v})
    }

    private onHyperparameterSelection(hyperparameter: string) {
        let scale: d3.ScaleBand<ConfigValue> | d3.ScaleContinuousNumeric<number, number> = undefined
        let type = undefined
        const data = [].concat(...this.props.structures
            .map(structure => {
                if (scale === undefined) {
                    const hp = structure.configspace.hyperparameters.find(hp => hp.name === hyperparameter)
                    if (hp instanceof CategoricalHyperparameter) {
                        scale = d3.scaleBand((hp as CategoricalHyperparameter).choices, [0, 1])
                        type = 'category'
                    } else if (hp instanceof NumericalHyperparameter) {
                        const numHp = hp as NumericalHyperparameter
                        type = 'number'
                        if (numHp.log)
                            scale = d3.scaleLog([numHp.lower, numHp.upper], [0, 1])
                        else
                            scale = d3.scaleLinear([numHp.lower, numHp.upper], [0, 1])
                    }
                }

                return structure.configs
                    .filter(c => !this.props.hideUnselectedCandidates || this.props.selectedCandidates.has(c.id))
                    .filter(c => c.config.has(hyperparameter))
                    .map(c => ({
                        cid: c.id,
                        value: c.config.get(hyperparameter),
                        performance: c.loss,
                        timestamp: c.runtime.timestamp
                    }))
            }))

        this.setState({
            hpHistory: {
                name: hyperparameter,
                type: type,
                scale: scale,
                data: data
            }
        })

    }

    render() {
        const {
            explanations,
            structures,
            meta,
            selectedCandidates,
            onCandidateSelection,
            hideUnselectedCandidates
        } = this.props
        const nSteps = Object.keys(this.state.sliderMarks).length - 1;

        return (
            <>
                {explanations.structures &&
                    <CollapseComp showInitial={true} help={BanditExplanationsComponent.HELP}>
                        <h4>Reinforcement Learning</h4>
                        <BanditExplanationsComponent explanations={explanations.structures}
                                                     selectedCandidates={selectedCandidates}
                                                     hideUnselectedCandidates={hideUnselectedCandidates}
                                                     structures={structures}
                                                     timestamp={this.cids[this.state.timestamp].split(':').slice(0, -1).join(':')}
                                                     onCandidateSelection={onCandidateSelection}/>
                    </CollapseComp>}
                <CollapseComp showInitial={true} help={ParallelCoordinates.HELP}>
                    <h4>Bayesian Optimization</h4>
                    <ParallelCoordinates structures={structures} meta={meta}
                                         hideUnselectedCandidates={hideUnselectedCandidates}
                                         selectedCandidates={selectedCandidates}
                                         onCandidateSelection={onCandidateSelection}
                                         onAxisSelection={this.onHyperparameterSelection}
                                         timestamp={this.state.timestamp}/>
                </CollapseComp>

                {structures.length > 0 &&
                    <div style={{display: 'flex'}}>
                        <div style={{flex: '1', overflowX: 'hidden', margin: 0, marginRight: '5px'}}>
                            <CollapseComp showInitial={true} help={''}>
                                <h4>Candidate Distribution</h4>
                                <ConfigSimilarity structures={structures}
                                                  selectedCandidates={selectedCandidates}
                                                  hideUnselectedCandidates={hideUnselectedCandidates}
                                                  meta={meta}
                                                  height={'300px'}
                                                  timestamp={this.state.timestamp}
                                                  onCandidateSelection={onCandidateSelection}/>
                            </CollapseComp>
                        </div>
                        <div style={{flex: '1', margin: 0, marginLeft: '5px'}}>
                            <CollapseComp showInitial={true} help={SamplingHistory.HELP}>
                                <h4>Sampling History</h4>
                                <SamplingHistory history={this.state.hpHistory}
                                                 meta={meta}
                                                 selectedCandidates={selectedCandidates}
                                                 hideUnselectedCandidates={hideUnselectedCandidates}
                                                 onCandidateSelection={onCandidateSelection}
                                                 height={'300px'}/>
                            </CollapseComp>
                        </div>
                    </div>
                }

                {nSteps > 0 &&
                    <div style={{margin: '20px'}}>
                        <Slider min={0} max={nSteps} marks={this.state.sliderMarks} defaultValue={nSteps}
                                included={false} onChange={this.changeTimestamp}/>
                    </div>}
            </>
        )
    }
}
