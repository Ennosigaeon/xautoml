import React from "react";
import {CollapseComp} from "../util/collapse";
import {BanditExplanationsComponent} from "./bandit_explanation";
import {ParallelCoordinates} from "./pc/parallel_corrdinates";
import {CandidateId, Runhistory} from "../model";
import Slider from "rc-slider";

interface SearchSpaceProps {
    runhistory: Runhistory
    selectedCandidates: Set<CandidateId>
    onCandidateSelection?: (cid: Set<CandidateId>) => void
}

interface SearchSpaceState {
    sliderMarks: { [key: string]: string; }
    timestamp: number
}

export class SearchSpace extends React.Component<SearchSpaceProps, SearchSpaceState> {

    constructor(props: SearchSpaceProps) {
        super(props);

        const sliderMarks: { [key: string]: string; } = {}
        const keys = [].concat(...this.props.runhistory.structures.map(s => s.configs.map(c => c.id.slice(3))))
        keys.forEach((k, idx) => sliderMarks[idx] = k)

        this.state = {sliderMarks: sliderMarks, timestamp: keys.length - 1}

        this.changeTimestamp = this.changeTimestamp.bind(this)
    }

    private changeTimestamp(v: number) {
        this.setState({timestamp: v})
    }

    render() {
        const {runhistory, selectedCandidates, onCandidateSelection} = this.props
        const nSteps = Object.keys(this.state.sliderMarks).length - 1;

        return (
            <>
                {runhistory.explanations.structures &&
                    <CollapseComp showInitial={true} help={BanditExplanationsComponent.HELP}>
                        <h4>Reinforcement Learning</h4>
                        <BanditExplanationsComponent explanations={runhistory.explanations.structures}
                                                     selectedCandidates={selectedCandidates}
                                                     structures={runhistory.structures}
                                                     timestamp={'00:' + this.state.sliderMarks[this.state.timestamp].split(':').slice(0, -1).join(':')}
                                                     onCandidateSelection={onCandidateSelection}/>
                    </CollapseComp>}
                <CollapseComp showInitial={true} help={ParallelCoordinates.HELP}>
                    <h4>Bayesian Optimization</h4>
                    <ParallelCoordinates structures={runhistory.structures} meta={runhistory.meta}
                                         selectedCandidates={selectedCandidates}
                                         onCandidateSelection={onCandidateSelection}
                                         timestamp={this.state.timestamp}/>
                </CollapseComp>

                {/* Only display slider when data is already loaded*/}
                {nSteps > 0 &&
                    <div style={{margin: '20px'}}>
                        <Slider min={0} max={nSteps} marks={this.state.sliderMarks} defaultValue={nSteps}
                                included={false} onAfterChange={this.changeTimestamp}/>
                    </div>}
            </>
        )
    }
}
