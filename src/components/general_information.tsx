import MetaInformationTable from "./general/meta_information";
import {CollapseComp} from "../util/collapse";
import PerformanceTimeline, {TimelineRecord} from "./general/performance_timeline";
import {RocCurve} from "./general/roc_curve";
import React from "react";
import {Candidate, CandidateId, MetaInformation, Structure} from "../model";


interface GeneralInformationProps {
    structures: Structure[]
    meta: MetaInformation
    candidateMap: Map<CandidateId, Candidate>
    selectedCandidates: Set<CandidateId>
    onCandidateSelection: (selected: Set<CandidateId>) => void
}

interface GeneralInformationState {
    timeline: TimelineRecord[]
}

export class GeneralInformation extends React.Component<GeneralInformationProps, GeneralInformationState> {

    constructor(props: GeneralInformationProps) {
        super(props)
        this.state = {timeline: []}
    }

    componentDidMount() {
        const runTimeline = [].concat(...this.props.structures.map(s => s.configs))
            .map((c: Candidate) => ({timestamp: c.runtime.timestamp, performance: c.loss, cid: c.id}))
            .sort((a, b) => a.timestamp - b.timestamp)

        this.setState({timeline: runTimeline})
    }


    render() {
        const {meta, candidateMap, selectedCandidates, onCandidateSelection} = this.props

        return (
            <>
                <MetaInformationTable meta={meta}/>
                <CollapseComp showInitial={true} help={PerformanceTimeline.HELP}>
                    <h4>Performance Timeline</h4>
                    <PerformanceTimeline data={this.state.timeline} meta={meta} height={250}
                                         selectedCandidates={selectedCandidates}
                                         onCandidateSelection={onCandidateSelection}/>
                </CollapseComp>
                <CollapseComp showInitial={true} help={RocCurve.HELP}>
                    <h4>ROC Curve</h4>
                    <RocCurve selectedCandidates={selectedCandidates}
                              candidateMap={candidateMap}
                              meta={meta}
                              height={250}/>
                </CollapseComp>
            </>
        )
    }
}
