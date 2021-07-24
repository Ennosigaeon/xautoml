import React from 'react';
import {
    CartesianGrid,
    Cell,
    ComposedChart,
    Label,
    Line,
    ResponsiveContainer,
    Scatter,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {CandidateId, Config, MetaInformation} from "./model";

interface ConfigHistoryProps {
    data: Map<CandidateId, Config[]>
    meta: MetaInformation
    selectedConfigs: CandidateId[]
    onConfigSelection?: (cid: CandidateId[]) => void
}

interface ConfigHistoryState {
    data: ConfigRecord[];
}


export interface ConfigRecord {
    x: number;
    Performance: number;
    Incumbent: number;
    cid: CandidateId;
}

export default class PerformanceTimeline extends React.Component<ConfigHistoryProps, ConfigHistoryState> {

    static defaultProps = {
        onConfigSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: ConfigHistoryProps) {
        super(props);
        this.state = {data: []}

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
                return {x: v.x, Performance: v.y, Incumbent: best, cid: v.cid}
            })
    }

    private onScatterClick(x: any) {
        const cid: CandidateId = x.cid

        const idx = this.props.selectedConfigs.indexOf(cid)
        if (idx === -1)
            this.props.onConfigSelection([...this.props.selectedConfigs, cid])
        else {
            const newSelection = [...this.props.selectedConfigs]
            newSelection.splice(idx, 1)
            this.props.onConfigSelection(newSelection)
        }
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
                    <YAxis type="number" dataKey="Performance" name="Score">
                        <Label angle={270} position={'left'} value={this.props.meta.metric}/>
                    </YAxis>
                    <Tooltip/>


                    <Scatter dataKey="Performance" fill="#8884d8" onClick={this.onScatterClick}>
                        {this.state.data.map((entry, index) => (
                            <Cell key={`cell-${index}`}
                                  className={this.props.selectedConfigs.includes(entry.cid) ? 'selected-config' : ''}
                                  fill={'#c6c8e0'}/>
                        ))}
                    </Scatter>
                    <Line type="stepAfter" dataKey="Incumbent" dot={false} activeDot={false} legendType="none"/>
                </ComposedChart>
            </ResponsiveContainer>
        );
    }
}
