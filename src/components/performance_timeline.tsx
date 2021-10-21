import React from 'react';
import {CandidateId, MetaInformation, Structure} from "../model";
import {fixedPrec} from "../util";
import {
    FlexibleWidthXYPlot,
    HorizontalGridLines,
    LineSeries,
    MarkSeries,
    VerticalGridLines,
    XAxis,
    YAxis
} from "react-vis";
import 'react-vis/dist/style.css'

import * as d3 from 'd3'

interface ConfigHistoryProps {
    data: Structure[]
    meta: MetaInformation
    selectedCandidates: Set<CandidateId>
    onCandidateSelection?: (cid: Set<CandidateId>) => void
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
        return [].concat(...this.props.data.map(s => s.configs))
            .map(c => ({x: c.runtime.timestamp, y: sign * c.loss[0], cid: c.id}))
            .sort((a, b) => a.x - b.x)
            .map(v => {
                best = Math.max(best, v.y)
                return {x: fixedPrec(v.x), y: fixedPrec(v.y), Incumbent: fixedPrec(best), cid: v.cid}
            })
    }

    private onScatterClick(x: any) {
        const cid: CandidateId = x.cid
        const selected = new Set(this.props.selectedCandidates)
        if (this.props.selectedCandidates.has(cid))
            selected.delete(cid)
        else
            selected.add(cid)
        this.props.onCandidateSelection(selected)
    }

    render() {
        const {data} = this.state
        const {selectedCandidates} = this.props

        if (data.length === 0)
            return <p>Loading...</p>
        const dataWithColor = data.map(d => ({
            ...d,
            color: Number(!selectedCandidates.has(d.cid))
        }));
        const incumbent = data.map(d => ({x: d.x, y: d.Incumbent}))

        const bc = '#c6c8e0'
        const hc = '#007bff'
        // Somehow, if all points are selected only the base color is used and not the highlight color. Bug in react-vis?
        const colorRange = data.length === selectedCandidates.size ? [hc, hc] : [hc, bc]
        return (
            <>
                <FlexibleWidthXYPlot height={300}>
                    <HorizontalGridLines/>
                    <VerticalGridLines/>
                    <XAxis title="Timestamp"/>
                    <YAxis title="Performance"/>

                    <LineSeries data={incumbent} curve={d3.curveStepAfter}/>
                    <MarkSeries data={dataWithColor} colorRange={colorRange}
                                onValueMouseOver={value => this.setState({hovered: value as ConfigRecord})}
                                onValueMouseOut={() => this.setState({hovered: undefined})}
                                onValueClick={this.onScatterClick}
                    />

                    {/*TODO hint is currently broken. Does not disappear on onValueMouseOut and shows information for wrong item*/}
                    {/*{this.state.hovered ? <Hint value={{'x': (this.state.hovered.x + 10), 'y': this.state.hovered.y}}/> : null}*/}
                </FlexibleWidthXYPlot>
            </>
        );
    }
}
