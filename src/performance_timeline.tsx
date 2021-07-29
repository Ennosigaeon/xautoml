import React from 'react';
import {CandidateId, Candidate, MetaInformation} from "./model";
import {fixedPrec} from "./util";
import {Hint, HorizontalGridLines, LineSeries, MarkSeries, VerticalGridLines, XAxis, XYPlot, YAxis} from "react-vis";

import * as d3 from 'd3'

interface ConfigHistoryProps {
    data: Map<CandidateId, Candidate[]>
    meta: MetaInformation
    selectedCandidates: CandidateId[]
    onCandidateSelection?: (cid: CandidateId[]) => void
}

interface ConfigHistoryState {
    data: ConfigRecord[];
    hovered: ConfigRecord;
}


export interface ConfigRecord {
    x: number;
    y: number;
    Incumbent: number;
    cid: CandidateId;
}

export default class PerformanceTimeline extends React.Component<ConfigHistoryProps, ConfigHistoryState> {

    static defaultProps = {
        onCandidateSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: ConfigHistoryProps) {
        super(props);
        this.state = {data: [], hovered: undefined}

        this.onScatterClick = this.onScatterClick.bind(this)
    }

    componentDidMount() {
        const data = this.performanceTimeline()
        this.setState({data: data})
    }

    private performanceTimeline(): ConfigRecord[] {
        const sign = this.props.meta.metric_sign
        let best = -Infinity
        return [].concat(
            ...Array.from(this.props.data.entries())
                .map(value => value[1].map(c => {
                    return {x: c.runtime.timestamp, y: sign * c.loss[0], cid: c.id}
                }))
        ).sort((a, b) => a.x - b.x)
            .map(v => {
                best = Math.max(best, v.y)
                return {x: fixedPrec(v.x), y: fixedPrec(v.y), Incumbent: fixedPrec(best), cid: v.cid}
            })
    }

    private onScatterClick(x: any) {
        const cid: CandidateId = x.cid

        const idx = this.props.selectedCandidates.indexOf(cid)
        if (idx === -1)
            this.props.onCandidateSelection([...this.props.selectedCandidates, cid])
        else {
            const newSelection = [...this.props.selectedCandidates]
            newSelection.splice(idx, 1)
            this.props.onCandidateSelection(newSelection)
        }
    }

    render() {
        if (this.state.data.length === 0)
            return <p>Loading...</p>
        const dataWithColor = this.state.data.map(d => ({
            ...d,
            color: Number(!this.props.selectedCandidates.includes(d.cid))
        }));
        const incumbent = this.state.data.map(d => ({x: d.x, y: d.Incumbent}))

        return (
            <XYPlot width={400} height={400}>
                <HorizontalGridLines/>
                <VerticalGridLines/>
                <XAxis title="Timestamp"/>
                <YAxis title="Performance"/>

                <LineSeries data={incumbent} curve={d3.curveStepAfter}/>
                <MarkSeries data={dataWithColor} colorRange={['#007bff', '#c6c8e0']}
                            onValueMouseOver={value => this.setState({hovered: value as ConfigRecord})}
                            onValueMouseOut={() => this.setState({hovered: undefined})}
                            onValueClick={this.onScatterClick}
                />

                {this.state.hovered ? <Hint value={{'x': this.state.hovered.x, 'y': this.state.hovered.y}}/> : null}
            </XYPlot>
        );
    }
}
