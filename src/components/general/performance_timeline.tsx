import React from 'react';
import {Candidate, CandidateId, MetaInformation, Structure} from "../../model";
import {Colors, fixedPrec} from "../../util";
import {CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Scatter, XAxis, YAxis} from "recharts";

interface ConfigHistoryProps {
    data: Structure[]
    meta: MetaInformation
    selectedCandidates: Set<CandidateId>
    onCandidateSelection?: (cid: Set<CandidateId>) => void
}

interface ConfigHistoryState {
    data: ConfigRecord[];
}


export interface ConfigRecord {
    x: number;
    y: number;
    Incumbent: number;
    cid: CandidateId;
}

export default class PerformanceTimeline extends React.Component<ConfigHistoryProps, ConfigHistoryState> {

    static HELP = 'This component provides a scatter plot of the performance of each evaluated candidate over the ' +
        'time. The line plot show the performance of the best candidate over time. Individual pipelines can be ' +
        'selected by clicking on the corresponding patch.'

    static defaultProps = {
        onCandidateSelection: (_: CandidateId[]) => {
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
        const optimFunction = this.props.meta.is_minimization ? Math.min : Math.max
        let best = this.props.meta.is_minimization ? Infinity : -Infinity

        return [].concat(...this.props.data.map(s => s.configs))
            .map((c: Candidate) => ({x: c.runtime.timestamp, y: c.loss, cid: c.id}))
            .sort((a, b) => a.x - b.x)
            .map(v => {
                best = optimFunction(best, v.y)
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

        return (
            <div style={{height: 300}}>
                <ResponsiveContainer>
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="x" label={{value: 'Timestamp', dy: 10}} type={'number'} unit={'s'}/>
                        <YAxis label={{value: 'Performance', angle: -90, dx: -25}} domain={['dataMin', 'dataMax']}/>

                        <Line dataKey={'Incumbent'} stroke={Colors.HIGHLIGHT} dot={false}/>
                        <Scatter dataKey="y" onClick={this.onScatterClick}>
                            {data.map((d, index) => (
                                <Cell key={`cell-${index}`}
                                      fill={selectedCandidates.has(d.cid) ? Colors.HIGHLIGHT : Colors.DEFAULT}
                                      cursor={'pointer'}/>
                            ))}
                        </Scatter>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        );
    }
}
