import MetaInformationTable from "./general/meta_information";
import {CollapseComp} from "../util/collapse";
import PerformanceTimeline, {TimelineRecord} from "./general/performance_timeline";
import {RocCurve} from "./general/roc_curve";
import React from "react";
import {Candidate, CandidateId, MetaInformation, Structure} from "../model";
import {TabContext, TabPanel} from "@material-ui/lab";
import {Box, Tab, Tabs} from "@material-ui/core";
import {Colors} from "../util";
import PerformanceDistribution from "./general/performance_distribution";


interface GeneralInformationProps {
    structures: Structure[]
    meta: MetaInformation
    selectedCandidates: Set<CandidateId>
    onCandidateSelection: (selected: Set<CandidateId>) => void
}

interface GeneralInformationState {
    timeline: TimelineRecord[]
    openTab: string
}

export class GeneralInformation extends React.Component<GeneralInformationProps, GeneralInformationState> {

    constructor(props: GeneralInformationProps) {
        super(props)
        this.state = {timeline: [], openTab: '1'}

        this.switchTab = this.switchTab.bind(this)
    }

    componentDidMount() {
        const runTimeline = [].concat(...this.props.structures.map(s => s.configs))
            .map((c: Candidate) => ({timestamp: c.runtime.timestamp, performance: c.loss, cid: c.id}))
            .sort((a, b) => a.timestamp - b.timestamp)

        this.setState({timeline: runTimeline})
    }

    private switchTab(_: any, selectedTab: string) {
        this.setState({openTab: selectedTab})
    }

    render() {
        const {meta, selectedCandidates, onCandidateSelection} = this.props
        const {openTab} = this.state

        return (
            <>
                <MetaInformationTable meta={meta}/>
                <CollapseComp name={'performance-overview'} showInitial={true} help={PerformanceTimeline.HELP}>
                    <h4>Performance Overview</h4>
                    <TabContext value={openTab}>
                        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                            <Tabs value={openTab} onChange={this.switchTab} style={{minHeight: 0}} TabIndicatorProps={{
                                style: {backgroundColor: Colors.HIGHLIGHT}
                            }}>
                                <Tab className={'tab-small'} label="Timeline" value={'1'}/>
                                <Tab className={'tab-small'} label="Distribution" value={'2'}/>
                            </Tabs>
                        </Box>

                        <TabPanel value={'1'}>
                            <PerformanceTimeline data={this.state.timeline} meta={meta} height={220}
                                                 selectedCandidates={selectedCandidates}
                                                 onCandidateSelection={onCandidateSelection}/>
                        </TabPanel>
                        <TabPanel value={'2'} style={{padding: 0, paddingTop: "5px"}}>
                            <PerformanceDistribution data={this.state.timeline} meta={meta} height={220}/>
                        </TabPanel>
                    </TabContext>
                </CollapseComp>
                <CollapseComp name={'roc-curve'} showInitial={true} help={RocCurve.HELP}>
                    <h4>ROC Curve</h4>
                    <RocCurve selectedCandidates={selectedCandidates} height={250}/>
                </CollapseComp>
            </>
        )
    }
}
