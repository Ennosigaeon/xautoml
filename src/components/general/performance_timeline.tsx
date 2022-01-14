import React from 'react';
import {CandidateId, MetaInformation} from "../../model";
import {Colors, fixedPrec} from "../../util";
import {CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Scatter, XAxis, YAxis} from "recharts";
import {LoadingIndicator} from "../../util/loading";
import {Margin} from "recharts/types/util/types";


export interface TimelineRecord {
    timestamp: number;
    performance: number;
    cid: CandidateId;
}

interface ConfigHistoryProps {
    data: TimelineRecord[]
    meta: MetaInformation
    selectedCandidates: Set<CandidateId>
    onCandidateSelection?: (cid: Set<CandidateId>, show?: boolean) => void
    height: number

    margin?: Margin
    xDomain?: [any, any]
}

interface ConfigHistoryState {
    data: IncumbentRecord[];
}

interface IncumbentRecord extends TimelineRecord {
    Incumbent: number;
}

export default class PerformanceTimeline extends React.Component<ConfigHistoryProps, ConfigHistoryState> {

    static readonly HELP = 'This view provides an overview of the performance of each evaluated candidate. Results ' +
        'can either be aggregated over time or group by achieved performance. In the temporal plot each scatter dot ' +
        'represents a single candidate and the line plot shows the performance of the best candidate over time. ' +
        'The distribution plot aggregates candidates by their performance.'

    static defaultProps = {
        margin: undefined as Margin,
        xDomain: [0, 'auto'],
        onCandidateSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: ConfigHistoryProps) {
        super(props);
        this.state = {data: this.calcIncumbent()}

        this.onScatterClick = this.onScatterClick.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<ConfigHistoryProps>, prevState: Readonly<ConfigHistoryState>, snapshot?: any) {
        if (prevProps.data.length !== this.props.data.length)
            this.setState({data: this.calcIncumbent()})
    }

    private calcIncumbent() {
        const optimFunction = this.props.meta.is_minimization ? Math.min : Math.max
        let best = this.props.meta.is_minimization ? Infinity : -Infinity

        return this.props.data
            .map(v => {
                best = optimFunction(best, v.performance)
                return {
                    timestamp: fixedPrec(v.timestamp),
                    performance: fixedPrec(v.performance),
                    Incumbent: fixedPrec(best),
                    cid: v.cid
                }
            })
    }

    private onScatterClick(x: any, _: number, e: React.MouseEvent) {
        const cid: CandidateId = x.cid
        if (!e.ctrlKey) {
            const selected = new Set(this.props.selectedCandidates)
            if (this.props.selectedCandidates.has(cid))
                selected.delete(cid)
            else
                selected.add(cid)
            this.props.onCandidateSelection(selected)
        } else
            this.props.onCandidateSelection(new Set<CandidateId>([cid]), true)
    }

    render() {
        const {data} = this.state
        const {selectedCandidates} = this.props

        return (
            <div style={{height: this.props.height}}>
                <LoadingIndicator loading={data.length === 0}/>

                {data.length > 0 &&
                    <ResponsiveContainer>
                        <ComposedChart data={data} margin={this.props.margin}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey="timestamp" label={{value: 'Timestamp', dy: 10}}
                                   type={'number'} unit={'s'}
                                   domain={this.props.xDomain}/>
                            <YAxis domain={['dataMin', 'dataMax']}
                                   label={{
                                       value: this.props.meta.metric,
                                       angle: -90,
                                       dx: this.props.margin ? -this.props.margin.left - 10 : -25
                                   }}/>

                            <Line dataKey={'Incumbent'} stroke={Colors.HIGHLIGHT} dot={false}/>
                            <Scatter dataKey="performance" onClick={this.onScatterClick}>
                                {data.map((d, index) => (
                                    <Cell key={`cell-${index}`}
                                          fill={selectedCandidates.has(d.cid) ? Colors.HIGHLIGHT : Colors.DEFAULT}
                                          stroke={Colors.BORDER}
                                          cursor={'pointer'}/>
                                ))}
                            </Scatter>
                        </ComposedChart>
                    </ResponsiveContainer>
                }
            </div>
        );
    }
}
