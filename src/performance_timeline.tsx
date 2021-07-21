import React from 'react';
import {CartesianGrid, ComposedChart, Label, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis} from 'recharts';
import {Config, MetaInformation} from "./model";

interface ConfigHistoryProps {
    data: Map<string, Config[]>
    meta: MetaInformation
}

interface ConfigHistoryState {
    data: ConfigRecord[];
}


export interface ConfigRecord {
    x: number;
    y: number;
    best: number;
    label?: string;
}

export default class PerformanceTimeline extends React.Component<ConfigHistoryProps, ConfigHistoryState> {

    constructor(props: ConfigHistoryProps) {
        super(props);
        this.state = {data: []}
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
                    return {x: c.runtime.timestamp, y: sign * c.loss[0], label: value[0]}
                }))
        ).sort((a, b) => a.x - b.x)
            .map(v => {
                best = Math.max(best, v.y)
                return {x: v.x, y: v.y, best: best, label: v.label}
            })
    }

    render() {
        if (this.state.data.length === 0)
            return <p>Loading...</p>

        return (
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    width={400}
                    height={400}
                    margin={{
                        top: 20,
                        right: 20,
                        bottom: 20,
                        left: 20,
                    }}
                    data={this.state.data}
                >
                    <CartesianGrid/>
                    <XAxis type="number" dataKey="x" name="Time" unit="s">
                        <Label value="Time" position={'bottom'}/>
                    </XAxis>
                    <YAxis type="number" dataKey="y" name="Score">
                        <Label angle={270} position={'left'} value={this.props.meta.metric}/>
                    </YAxis>
                    <Tooltip/>

                    <Scatter dataKey="y" fill="#8884d8"/>
                    <Line type="stepAfter" dataKey="best" dot={false} activeDot={false} legendType="none"/>
                </ComposedChart>
            </ResponsiveContainer>
        );
    }
}
