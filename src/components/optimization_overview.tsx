import {CollapseComp} from "../util/collapse";
import PerformanceTimeline, {TimelineRecord} from "./general/performance_timeline";
import {RocCurve} from "./general/roc_curve";
import React from "react";
import {Candidate, CandidateId, ConfigValue, MetaInformation, Structure} from "../model";
import {TabContext, TabPanel} from "@material-ui/lab";
import {Box, Tab, Tabs} from "@material-ui/core";
import {Colors, prettyPrint} from "../util";
import PerformanceDistribution from "./general/performance_distribution";
import {KeyValue} from "../util/KeyValue";


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

    static CHILD_VIEWS = ['overview']

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

        const start = new Date(0)
        start.setUTCSeconds(meta.start_time)
        const end = new Date(0)
        end.setUTCSeconds(meta.end_time)

        const configValues: [string, ConfigValue][] = []
        meta.config.forEach((value, key) => configValues.push([key, value]))

        return (
            <>
                <CollapseComp name={'optimization-statistics'} showInitial={true}
                              help={'View the most important settings and statistics for this optimization run.'}>
                    <h4>Optimization Overview</h4>
                    <>
                        <KeyValue key_={'Framework'} value={meta.framework}/>
                        {meta.openml_task !== undefined && meta.openml_fold !== undefined &&
                            <KeyValue key_={'Data Set'} value={`Task ${meta.openml_task} on Fold ${meta.openml_fold}`}
                                      href={`https://www.openml.org/t/${meta.openml_task}`}/>
                        }
                        <KeyValue key_={'Start Time'} value={start}/>
                        <KeyValue key_={'End Time'} value={end}/>
                        <KeyValue key_={'Metric'} value={meta.metric}/>
                        <KeyValue key_={'Best Performance'} prec={4} value={meta.bestPerformance}/>
                        <KeyValue key_={'Total Nr. Candidates'} value={meta.n_configs}/>
                        <KeyValue key_={'Unique Structures'} value={meta.n_structures}/>
                    </>
                </CollapseComp>

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

                <CollapseComp name={'optimization-settings'} showInitial={false}
                              help={'View additional settings for this optimization run.'}>
                    <h4>Optimization Configuration</h4>
                    <>
                        {configValues.map(([key, value]) =>
                            <div className={'overview-row'} key={key}>
                                {key}: {prettyPrint(value)}
                            </div>
                        )}
                    </>
                </CollapseComp>
            </>
        )
    }
}
