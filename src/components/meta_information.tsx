import React from "react";
import {MetaInformation} from "../model";
import {Collapse, IconButton} from "@material-ui/core";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";

interface MetaInformationProps {
    meta: MetaInformation
}

interface MetaInformationState {
    overviewOpen: boolean
    configOpen: boolean
}

export default class MetaInformationTable extends React.Component<MetaInformationProps, MetaInformationState> {

    constructor(props: MetaInformationProps) {
        super(props);
        this.state = {overviewOpen: true, configOpen: false}

        this.toggleOverview = this.toggleOverview.bind(this)
        this.toggleConfig = this.toggleConfig.bind(this)
    }

    private toggleOverview() {
        this.setState((state) => ({overviewOpen: !state.overviewOpen}))
    }

    private toggleConfig() {
        this.setState((state) => ({configOpen: !state.configOpen}))
    }

    render() {
        const meta = this.props.meta
        const start = new Date(0)
        start.setUTCSeconds(meta.start_time)
        const end = new Date(0)
        end.setUTCSeconds(meta.end_time)

        return (
            <div className={'overview'}>
                <div style={{display: "flex"}}>
                    <h4 style={{flexGrow: 1}}>Optimization Overview</h4>
                    <IconButton style={{flexShrink: 1}} size='small' onClick={this.toggleOverview}>
                        {this.state.overviewOpen ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                    </IconButton>
                </div>

                <Collapse in={this.state.overviewOpen}>
                    <div className={'overview-row'}>
                        Data Set: <a href={`https://www.openml.org/t/${meta.openml_task}`} target={'_blank'}>{meta.openml_task} on fold {meta.openml_fold}</a>
                    </div>
                    <div className={'overview-row'}>
                        Start Time: {start.toLocaleString()}
                    </div>
                    <div className={'overview-row'}>
                        End Time: {end.toLocaleString()}
                    </div>
                    <div className={'overview-row'}>
                        Metric: {meta.metric}
                    </div>
                    <div className={'overview-row'}>
                        {/* TODO */}
                        Best Performance: 0.9
                    </div>
                    <div className={'overview-row'}>
                        Total Nr. Configs: {meta.n_configs}
                    </div>
                    <div className={'overview-row'}>
                        Unique Structures: {meta.n_structures}
                    </div>
                </Collapse>

                <hr/>
                <div style={{display: "flex"}}>
                    <h4 style={{flexGrow: 1}}>Optimization Configuration</h4>
                    <IconButton style={{flexShrink: 1}} size='small' onClick={this.toggleConfig}>
                        {this.state.configOpen ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                    </IconButton>
                </div>

                <Collapse in={this.state.configOpen}>
                    <div className={'overview-row'}>
                        Wallclock Limit: {meta.wallclock_limit}
                    </div>
                    <div className={'overview-row'}>
                        Cutoff Limit: {meta.cutoff}
                    </div>
                    <div className={'overview-row'}>
                        {/* TODO */}
                        Iterations: 10
                    </div>
                    <div className={'overview-row'}>
                        Work Directory: {meta.model_dir}
                    </div>
                </Collapse>
            </div>
        )
    }
}
