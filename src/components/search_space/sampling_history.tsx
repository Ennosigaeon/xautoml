import React from "react";
import {HPRecord, HyperparameterHistory} from "./model";
import {CartesianGrid, Cell, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis} from "recharts";
import {CandidateId, ConfigValue, MetaInformation} from "../../model";
import {Colors, prettyPrint} from "../../util";
import {bin} from "d3";
import PerformanceTimeline from "../general/performance_timeline";
import memoizeOne from "memoize-one";

interface SamplingHistoryProps {
    history: HyperparameterHistory
    meta: MetaInformation
    selectedCandidates: Set<CandidateId>
    hideUnselectedCandidates: boolean
    height: string
    onCandidateSelection: (cid: Set<CandidateId>, show?: boolean) => void
}

interface SamplingHistoryState {
    data: any
}

class LabelEncoder {

    public labels: ConfigValue[]

    fit(data: HPRecord[]): HPRecord[] {
        this.labels = ['', ...new Set(data.map(d => d.value)), '']
        return data.map((x) => ({
            cid: x.cid,
            timestamp: x.timestamp,
            value: this.labels.indexOf(x.value),
            performance: x.performance
        }))
    }
}


export class SamplingHistory extends React.Component<SamplingHistoryProps, SamplingHistoryState> {

    static readonly HELP = 'Shows the distribution and performance of a single hyperparameter over time. This ' +
        'view can be used to validate that the complete range of the hyperparameter is searched. Furthermore, it can ' +
        'be verified that the search algorithm converges to a well performing region of the hyperparameter.'

    constructor(props: SamplingHistoryProps) {
        super(props);
        this.state = {data: undefined}

        this.onScatterClick = this.onScatterClick.bind(this)
    }

    private onScatterClick(x: HPRecord, _: number, e: React.MouseEvent) {
        const cid: CandidateId = x.cid
        if (e.ctrlKey) {
            const selected = new Set(this.props.selectedCandidates)
            if (this.props.selectedCandidates.has(cid))
                selected.delete(cid)
            else
                selected.add(cid)
            this.props.onCandidateSelection(selected)
        } else
            this.props.onCandidateSelection(new Set<CandidateId>([cid]), true)
    }

    private calcData(history: HyperparameterHistory) {
        if (history === undefined || history.data.length === 0)
            return {
                yAxisProps: {},
                marginLeft: 0,
                data: history ? [] : undefined,
                bins: [],
                name: ''
            }

        let data = history.data
        let yAxisProps: any
        let marginLeft = 0
        let bins

        if (history.type === 'category') {
            const encoder = new LabelEncoder()
            data = encoder.fit(data)

            yAxisProps = {
                ticks: [...Array(encoder.labels.length).keys()],
                interval: 0,
                tickFormatter: (y: number) => prettyPrint(encoder.labels[y])
            }
            marginLeft = encoder.labels.map(l => prettyPrint(l).length).reduce((a, b) => Math.max(a, b), 0) * 5

            bins = bin()
                .domain([1, encoder.labels.length - 1])
                .thresholds(encoder.labels.length - 2)
                (data.map(d => d.value as number))
        } else {
            yAxisProps = {tickFormatter: (y: number) => prettyPrint(y), domain: history.scale.domain()}
            bins = bin()
                .domain(history.scale.domain() as [number, number])
                (data.map(d => d.value as number))
        }

        data = !data ? [] :
            data.filter(x => !this.props.hideUnselectedCandidates || this.props.selectedCandidates.has(x.cid))
                .sort((a, b) => a.timestamp - b.timestamp)

        let trimmedName = ''
        for (const token of history.name.split(':').reverse()) {
            if (trimmedName === '')
                trimmedName = token
            else if (trimmedName.length + token.length < 25)
                trimmedName = token + ':' + trimmedName
            else
                break
        }

        return {
            yAxisProps: yAxisProps,
            marginLeft: marginLeft,
            data: data,
            bins: bins,
            name: trimmedName
        }
    }

    private calcDataMem = memoizeOne(this.calcData)

    render() {
        const {history, selectedCandidates} = this.props

        const {yAxisProps, marginLeft, data, bins, name} = this.calcDataMem(history)

        const xMax = data?.length > 0 ? Math.ceil(data[data.length - 1].timestamp) : 0
        const maxLength = bins ? Math.max(...bins.map(b => b.length)) : 0
        const xDomain = [0, xMax * 1.25]

        return (
            <div style={{height: this.props.height}}>
                {!history &&
                    <p>
                        Select a hyperparameter name in the parallel coordinate plot (Bayesian Optimization) above by
                        clicking on the name of a hyperparameter. In the resulting  to get more details about the sampled values of this hyperparameter.
                    </p>
                }
                {data?.length === 0 &&
                    <p>
                        The hyperparameter <i>{history.name}</i> has no evaluations. Please select a hyperparameter
                        with at least one evaluation.
                    </p>
                }
                {data?.length > 0 &&
                    <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                        <div style={{flex: '1 1 auto', padding: '5px'}}>
                            <h4>Sampled Values</h4>
                            <ResponsiveContainer>
                                <ScatterChart margin={{left: marginLeft, bottom: 5}}>
                                    <CartesianGrid strokeDasharray="3 3"/>
                                    <XAxis type="number" dataKey="timestamp" name="Timestamp"
                                           label={{value: 'Timestamp', dy: 10}} unit={'s'}
                                           domain={xDomain}
                                           tickFormatter={(x: number) => prettyPrint(x)}/>

                                    <YAxis yAxisId="density" type="number"
                                           dataKey="value" name="Density"
                                           label={{value: 'Density', angle: -90}}
                                           orientation="right" tick={false}
                                           width={20}
                                           {...yAxisProps}/>

                                    <YAxis yAxisId="value" type="number"
                                           dataKey="value" name="Value"
                                           orientation="left"
                                           label={{value: name, angle: -90, dx: -marginLeft - 10}}
                                           {...yAxisProps}/>

                                    {bins.map(patch => {
                                            const xOffset = history.type === 'category' ? (patch.x1 - patch.x0) / 2 : 0
                                            const padding = history.type === 'category' ? 0.1 : 0

                                            return <ReferenceArea
                                                yAxisId={'density'}
                                                className={'barchart-xxx'}
                                                key={`${patch.x0}_${patch.x1}`}
                                                x1={xMax * (1.25 - Math.max(0.01, (patch.length / maxLength)) / 5)}
                                                x2={xMax * 1.25}
                                                y1={patch.x0 - xOffset + padding}
                                                y2={patch.x1 - xOffset - padding}
                                                fill={Colors.DEFAULT}
                                                fillOpacity={1}
                                                stroke={Colors.BORDER}
                                            />
                                        }
                                    )}

                                    <Scatter yAxisId="value" data={data} onClick={this.onScatterClick}>
                                        {data.map((d, index) => (
                                            <Cell key={`cell-${index}`}
                                                  fill={selectedCandidates.has(d.cid) ? Colors.HIGHLIGHT : Colors.DEFAULT}
                                                  stroke={Colors.BORDER}
                                                  cursor={'pointer'}/>
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{flex: '0 1 auto', padding: '5px'}}>
                            <h4>Performance Overview</h4>
                            <PerformanceTimeline data={data} meta={this.props.meta}
                                                 height={100}
                                                 xDomain={xDomain as [number, number]}
                                                 margin={{right: 20, left: marginLeft}}
                                                 onCandidateSelection={this.props.onCandidateSelection}
                                                 selectedCandidates={selectedCandidates}/>
                        </div>
                    </div>
                }
            </div>
        )
    }

}
