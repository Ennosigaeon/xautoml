import MetaInformationTable from "./general/meta_information";
import {CollapseComp} from "../util/collapse";
import PerformanceTimeline from "./general/performance_timeline";
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

export class GeneralInformation extends React.Component<GeneralInformationProps, any> {
    render() {
        const {structures, meta, candidateMap, selectedCandidates, onCandidateSelection} = this.props

        return (
            <>
                <MetaInformationTable meta={meta}/>
                <CollapseComp showInitial={true} help={PerformanceTimeline.HELP}>
                    <h4>Performance Timeline</h4>
                    <PerformanceTimeline data={structures} meta={meta}
                                         selectedCandidates={selectedCandidates}
                                         onCandidateSelection={onCandidateSelection}/>
                </CollapseComp>
                <CollapseComp showInitial={true} help={RocCurve.HELP}>
                    <h4>ROC Curve</h4>
                    <RocCurve selectedCandidates={selectedCandidates}
                              candidateMap={candidateMap}
                              meta={meta}
                              height={300}/>
                </CollapseComp>
            </>
        )
    }
}
