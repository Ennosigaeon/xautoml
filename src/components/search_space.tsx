import React from "react";
import {CollapseComp} from "../util/collapse";
import {MCTSExplanationsComponent} from "./search_space/mcts_explanation";
import {ParallelCoordinates} from "./pc/parallel_corrdinates";
import {BO, Candidate, CandidateId, ConfigValue, Explanations, MetaInformation, Structure} from "../model";
import Slider from "rc-slider";
import {ConfigSimilarity} from "./search_space/config_similarity";
import {ConfigSimilarityResponse} from "../dao";
import {SamplingHistory} from "./search_space/sampling_history";
import * as d3 from "d3";
import {HyperparameterHistory} from "./search_space/model";
import CategoricalHyperparameter = BO.CategoricalHyperparameter;
import NumericalHyperparameter = BO.NumericalHyperparameter;

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
    hpHistories: Map<string, HyperparameterHistory>
}

export class SearchSpace extends React.Component<SearchSpaceProps, SearchSpaceState> {

    private readonly cids: CandidateId[]

    constructor(props: SearchSpaceProps) {
        super(props);

        const sliderMarks: { [key: string]: string; } = {}

        this.cids = [].concat(...this.props.structures.map(s => s.configs))
            .sort((a: Candidate, b: Candidate) => a.runtime.timestamp - b.runtime.timestamp)
            .map(c => c.id)

        let keys: string[]
        let timestamp = this.cids.length - 1
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
            timestamp = Number.parseInt(keys.slice(-1)[0])
        }

        keys.forEach((k, idx) => sliderMarks[idx] = k)
        this.state = {
            sliderMarks: sliderMarks,
            timestamp: timestamp,
            configSimilarity: undefined,
            hpHistories: new Map<string, HyperparameterHistory>()
        }

        this.changeTimestamp = this.changeTimestamp.bind(this)
        this.onHyperparameterSelection = this.onHyperparameterSelection.bind(this)
    }

    private changeTimestamp(v: number) {
        if (this.cids.length <= 100)
            this.setState({timestamp: v})
        else
            this.setState({timestamp: Number.parseInt(this.state.sliderMarks[v])})
    }

    private onHyperparameterSelection(hyperparameter: string) {
        if (!this.state.hpHistories.has(hyperparameter)) {
            let scale: d3.ScaleBand<ConfigValue> | d3.ScaleContinuousNumeric<number, number> = undefined
            let type: 'category' | 'number' = undefined
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

            this.state.hpHistories.set(hyperparameter, {
                name: hyperparameter,
                type: type,
                scale: scale,
                data: data
            })
        } else
            this.state.hpHistories.delete(hyperparameter)
        this.setState({hpHistories: this.state.hpHistories})
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
                {nSteps > 0 &&
                    <div style={{margin: '20px'}}>
                        <Slider min={0} max={nSteps} marks={this.state.sliderMarks} defaultValue={nSteps}
                                included={false} onChange={this.changeTimestamp}/>
                    </div>}

                {explanations.structures &&
                    <CollapseComp name={'reinforcement-explanations'} showInitial={true}
                                  help={MCTSExplanationsComponent.HELP}>
                        <h3>Reinforcement Learning</h3>
                        <MCTSExplanationsComponent explanations={explanations.structures}
                                                   selectedCandidates={selectedCandidates}
                                                   hideUnselectedCandidates={hideUnselectedCandidates}
                                                   structures={structures}
                                                   timestamp={this.cids[this.state.timestamp].split(':').slice(0, -1).join(':')}
                                                   onCandidateSelection={onCandidateSelection}/>
                    </CollapseComp>}
                <CollapseComp name={'bayesian-explanations'} showInitial={true} help={ParallelCoordinates.HELP}>
                    <h3>Bayesian Optimization</h3>
                    <ParallelCoordinates structures={structures}
                                         perfAxis={{
                                             domain: [meta.bestPerformance, meta.worstPerformance],
                                             log: false,
                                             label: meta.metric
                                         }}
                                         hideUnselectedCandidates={hideUnselectedCandidates}
                                         selectedCandidates={selectedCandidates}
                                         selectedAxis={new Set(this.state.hpHistories.keys())}
                                         onCandidateSelection={onCandidateSelection}
                                         onAxisSelection={this.onHyperparameterSelection}
                                         explanation={explanations.configs.get(this.cids[this.state.timestamp])}
                                         timestamp={this.state.timestamp}/>
                </CollapseComp>

                {structures.length > 0 &&
                    <div style={{display: 'flex'}}>
                        <div style={{flex: '1', overflowX: 'hidden', margin: 0, marginRight: '5px'}}>
                            <CollapseComp name={'config-similarity'} showInitial={true} help={ConfigSimilarity.HELP}>
                                <h3>Candidate Distribution</h3>
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
                            <CollapseComp name={'sampling-history'} showInitial={true} help={SamplingHistory.HELP}>
                                <h3>Sampling History</h3>
                                <SamplingHistory histories={Array.from(this.state.hpHistories.values())}
                                                 meta={meta}
                                                 selectedCandidates={selectedCandidates}
                                                 hideUnselectedCandidates={hideUnselectedCandidates}
                                                 onCandidateSelection={onCandidateSelection}/>
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
