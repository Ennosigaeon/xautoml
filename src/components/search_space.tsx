import React from "react";
import {CollapseComp} from "../util/collapse";
import {BanditExplanationsComponent} from "./search_space/bandit_explanation";
import {ParallelCoordinates} from "./pc/parallel_corrdinates";
import {CandidateId, Explanations, MetaInformation, Structure} from "../model";
import Slider from "rc-slider";
import {ConfigSimilarity} from "./search_space/config_similarity";
import {ConfigSimilarityResponse} from "../handler";

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
        this.state = {sliderMarks: sliderMarks, timestamp: keys.length - 1, configSimilarity: undefined}

        this.changeTimestamp = this.changeTimestamp.bind(this)
    }

    private changeTimestamp(v: number) {
        this.setState({timestamp: v})
    }

    render() {
        const {explanations, structures, meta, selectedCandidates, onCandidateSelection, hideUnselectedCandidates} = this.props
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
                                         timestamp={this.state.timestamp}/>
                </CollapseComp>

                {structures.length > 0 &&
                    <CollapseComp showInitial={true} help={''}>
                        <h4>Candidate Distribution</h4>
                        <ConfigSimilarity structures={structures}
                                          selectedCandidates={selectedCandidates}
                                          hideUnselectedCandidates={hideUnselectedCandidates}
                                          meta={meta}
                                          timestamp={this.state.timestamp}
                                          onCandidateSelection={onCandidateSelection}/>
                    </CollapseComp>
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
