import React from "react";
import {ContinuousHPImportance, HPImportance, requestFANOVADetails} from "../../handler";


import * as d3 from 'd3'

import {Colors, fixedPrec} from "../../util";
import {DetailsModel} from "./model";
import {
    Area,
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    LineChart,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import {ErrorIndicator} from "../../util/error";
import {LoadingIndicator} from "../loading";


interface SingleHPProps {
    data: HPImportance
}

class SingleHP extends React.Component<SingleHPProps> {

    render() {
        const {data} = this.props

        let plot;
        let additionalData;
        if (data.mode === 'discrete') {
            const whiskers: any[] = [];
            (data.data as Map<string, [number, number]>).forEach((value, key) => {
                whiskers.push({label: key, y: value})
            })

            plot = (
                <BarChart data={whiskers}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="label" label={{value: data.name[0], dy: 10}}/>
                    <YAxis label={{value: 'Performance', angle: -90, dx: -20}} domain={['auto', 'auto']}/>
                    <Bar dataKey="y" fill={Colors.DEFAULT}/>
                </BarChart>
            )
        } else if (data.mode === 'continuous') {
            if (data.name.length === 1) {
                plot = (
                    <ComposedChart data={(data.data as ContinuousHPImportance)}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="x" label={{value: data.name[0], dy: 10}} type={'number'}
                               domain={['dataMin', 'dataMax']}/>
                        <YAxis label={{value: 'Performance', angle: -90, dx: -20}} domain={['auto', 'auto']}/>
                        <Area type="monotone" dataKey="area" fill={Colors.DEFAULT} stroke={Colors.DEFAULT}/>
                        <Line type="monotone" dataKey={'y'} stroke={Colors.HIGHLIGHT} strokeWidth={2} dot={false}/>
                    </ComposedChart>
                )
            } else {
                const keys = Object.keys(data.data[0]).filter(k => k !== 'x')
                plot = (
                    <LineChart data={data.data}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="x" label={{value: data.name[1], dy: 10}} type={'number'}
                               domain={['dataMin', 'dataMax']}/>
                        <YAxis label={{value: 'Performance', angle: -90, dx: -20}} domain={['auto', 'auto']}/>
                        <Legend/>
                        {keys.map((key, idx) => (
                            <Line key={key} type="monotone" name={key} dataKey={key}
                                  stroke={Colors.getColor(idx)} strokeWidth={2} dot={false}/>
                        ))}
                    </LineChart>
                )
            }
        } else if (data.mode === 'heatmap') {
            const columns = Object.keys(data.data)
            const rows = Object.keys(data.data[columns[0]])

            const values: number[] = Object.values(data.data)
                .map(d => Object.values(d)).reduce((a, b) => a.concat(b), [])
            const min = Math.min(...values)
            const max = Math.max(...values)
            const scale = d3.scaleSequential(d3.interpolateBlues)
                .domain([min, max])

            const marginLeft = rows.map(r => r.length).reduce((a, b) => Math.max(a, b), 0) * 8
            plot = (
                <LineChart margin={{left: marginLeft, top: 0, right: 0, bottom: 0}}>
                    {this.generateHeatMap(columns, rows).map(sector => (
                        <ReferenceArea
                            key={`${sector.x1}_${sector.y1}`}
                            x1={sector.x1}
                            x2={sector.x2}
                            y1={sector.y1}
                            y2={sector.y2}
                            fill={scale(data.data[sector.column][sector.row])}
                            fillOpacity={1}
                            stroke="white"
                            strokeOpacity={0}
                        />
                    ))}
                    <XAxis type="number" dataKey="x"
                           domain={[0, rows.length]}
                           ticks={[0.5, 1.5]}
                           tickFormatter={x => rows[x - 0.5]}
                           label={{value: data.name[0], dy: 10}}/>
                    <YAxis type="number" dataKey="y"
                           domain={[0, columns.length]}
                           ticks={[0.5, 1.5, 2.5]}
                           tickFormatter={y => columns[y - 0.5]}
                           label={{value: data.name[1], angle: -90, dx: -marginLeft - 20}}/>
                    <Tooltip cursor={{strokeDasharray: '3 3'}}/>
                </LineChart>
            )
            additionalData = (
                <div style={{width: "100%", paddingLeft: marginLeft, marginTop: "10px", boxSizing: 'border-box'}}>
                    <svg height="20" width="100%">
                        <defs>
                            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" style={{stopColor: scale(min), stopOpacity: 1}}/>
                                <stop offset="100%" style={{stopColor: scale(max), stopOpacity: 1}}/>
                            </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="100%" height="100%" fill="url(#grad1)"/>

                        <text x={'5%'} y={'50%'} dominantBaseline={'middle'}>
                            {fixedPrec(min, 5).toFixed(5)}
                        </text>
                        <text x={'95%'} y={'50%'} dominantBaseline={'middle'} textAnchor={'end'}>
                            {fixedPrec(max, 5).toFixed(5)}
                        </text>
                    </svg>
                </div>
            )
        }

        return (
            <>
                <div style={{height: '300px', width: '100%'}}>
                    <ResponsiveContainer>
                        {plot}
                    </ResponsiveContainer>
                </div>
                {additionalData && additionalData}
            </>
        )
    }

    private generateHeatMap(columns: string[], rows: string[]) {
        return rows.map((r, i) =>
            columns.map((c, j) => ({
                row: r,
                column: c,
                x1: i + 0.01,
                x2: i + 0.99,
                y1: j + 0.01,
                y2: j + 0.99
            }))
        ).reduce((a, b) => a.concat(b), [])
    }

}


interface HPImportanceProps {
    model: DetailsModel
    height: number
}

interface HPImportanceState {
    data: HPImportance[]
    error: Error
}


export class HPImportanceComp extends React.Component<HPImportanceProps, HPImportanceState> {

    static HELP = ""

    constructor(props: HPImportanceProps) {
        super(props);

        this.state = {data: undefined, error: undefined}
    }

    componentDidMount() {
        this.queryHPImportance()
    }

    private queryHPImportance() {
        const {candidate, component} = this.props.model;
        this.setState({error: undefined});
        requestFANOVADetails(candidate.id, component)
            .then(data => this.setState({data: data}))
            .catch(error => {
                console.error(`Failed to fetch HPImportance data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });
    }


    render() {
        const {error, data} = this.state

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error &&
                <>
                    <LoadingIndicator loading={data === undefined}/>
                    {data !== undefined &&
                    <>
                        {data.map(d => <SingleHP key={d.name.join()} data={d}/>)}
                    </>
                    }
                </>
                }
            </>
        )
    }
}
