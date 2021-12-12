import React from "react";
import {ContinuousHPImportance, HPImportance, HPImportanceDetails, requestFANOVA} from "../../handler";


import * as d3 from 'd3'

import {Colors, prettyPrint} from "../../util";
import {
    Area,
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    ErrorBar,
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
import {Structure} from "../../model";


interface SingleHPProps {
    data: HPImportanceDetails
}

class SingleHP extends React.Component<SingleHPProps> {

    render() {
        const {data} = this.props

        let plot;
        let additionalData;
        if (data.mode === 'discrete') {
            const whiskers: any[] = [];
            Object.entries<[number, number]>(data.data).forEach(([key, value]) => {
                whiskers.push({label: key, y: value})
            })

            plot = (
                <BarChart data={whiskers} margin={{left: 40, bottom: 5}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="label" label={{value: data.name[0], dy: 10}}/>
                    <YAxis label={{value: 'Marginal Performance', angle: -90, dx: -40}} domain={['auto', 'auto']}/>
                    <Bar dataKey="y" fill={Colors.DEFAULT}/>
                </BarChart>
            )
        } else if (data.mode === 'continuous') {
            if (data.name.length === 1) {
                plot = (
                    <ComposedChart data={(data.data as ContinuousHPImportance)} margin={{left: 40, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="x" label={{value: data.name[0], dy: 10}} type={'number'}
                               domain={['dataMin', 'dataMax']}/>
                        <YAxis label={{value: 'Marginal Performance', angle: -90, dx: -40}} domain={['auto', 'auto']}/>
                        <Area type="monotone" dataKey="area" fill={Colors.DEFAULT} stroke={Colors.DEFAULT}/>
                        <Line type="monotone" dataKey={'y'} stroke={Colors.HIGHLIGHT} strokeWidth={2} dot={false}/>
                    </ComposedChart>
                )
            } else {
                const keys = Object.keys(data.data[0]).filter(k => k !== 'x')
                plot = (
                    <LineChart data={data.data} margin={{left: 40}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="x" label={{value: data.name[1], dy: 10}} type={'number'}
                               domain={['dataMin', 'dataMax']}/>
                        <YAxis label={{value: 'Marginal Performance', angle: -90, dx: -40}} domain={['auto', 'auto']}/>
                        <Legend/>
                        {keys.map((key, idx) => (
                            <Line key={key} type="monotone" name={key} dataKey={key}
                                  stroke={Colors.getColor(idx)} strokeWidth={2} dot={false}/>
                        ))}
                    </LineChart>
                )
            }
        } else if (data.mode === 'heatmap') {
            const rows = Object.keys(data.data)
            const columns = Object.keys(data.data[rows[0]])

            const values: number[] = Object.values(data.data)
                .map(d => Object.values(d)).reduce((a, b) => a.concat(b), [])
            const min = Math.min(...values)
            const max = Math.max(...values)
            const scale = d3.scaleSequential(d3.interpolateBlues)
                .domain([min, max])

            const marginLeft = columns.map(r => r.length).reduce((a, b) => Math.max(a, b), 0) * 8
            plot = (
                <LineChart margin={{left: marginLeft, bottom: 5}}>
                    {this.generateHeatMap(columns, rows).map(sector => (
                        <ReferenceArea
                            key={`${sector.x1}_${sector.y1}`}
                            x1={sector.x1}
                            x2={sector.x2}
                            y1={sector.y1}
                            y2={sector.y2}
                            fill={scale(data.data[sector.row][sector.column])}
                            fillOpacity={1}
                            stroke="white"
                            strokeOpacity={0}
                        />
                    ))}
                    <XAxis type="number" dataKey="x"
                           domain={[0, rows.length]}
                           ticks={[...Array(rows.length).keys()].map((_, i) => i + 0.5)}
                           interval={0}
                           tickFormatter={x => prettyPrint(rows[x - 0.5])}
                           label={{value: data.name[1], dy: 10}}/>
                    <YAxis type="number" dataKey="y"
                           domain={[0, columns.length]}
                           ticks={[...Array(columns.length).keys()].map((_, i) => i + 0.5)}
                           interval={0}
                           tickFormatter={y => prettyPrint(columns[y - 0.5])}
                           label={{value: data.name[0], angle: -90, dx: -marginLeft}}/>
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
                            {prettyPrint(min, 5)}
                        </text>
                        <text x={'95%'} y={'50%'} dominantBaseline={'middle'} textAnchor={'end'}>
                            {prettyPrint(max, 5)}
                        </text>
                    </svg>
                </div>
            )
        }

        return (
            <div>
                <div style={{height: '300px', width: '100%'}}>
                    <ResponsiveContainer>
                        {plot}
                    </ResponsiveContainer>
                </div>
                {additionalData && additionalData}
            </div>
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
    structure: Structure
    component: string
}

interface HPImportanceState {
    overview: HPImportance
    details: Map<number, Map<number, HPImportanceDetails>>
    error: Error
    selectedRow: number
}


export class HPImportanceComp extends React.Component<HPImportanceProps, HPImportanceState> {

    static HELP = 'Visualizes the impact of each hyperparameter (pair) on the marginal performance. This allows ' +
        'the identification of hyperparameters with a large impact on the performance of the pipeline. ' +
        'Additionally, hyperparameter regions having a high correlation with a good performance can be identified. ' +
        'By selecting a single step, only the hyperparameters of the selected step are shown. To view the overall ' +
        'most important hyperparameters, select either the pipeline source or sink.'

    constructor(props: HPImportanceProps) {
        super(props);
        this.state = {overview: undefined, details: undefined, error: undefined, selectedRow: undefined}

        this.selectRow = this.selectRow.bind(this)
    }

    componentDidMount() {
        this.queryHPImportance()
    }

    componentDidUpdate(prevProps: Readonly<HPImportanceProps>, prevState: Readonly<HPImportanceState>, snapshot?: any) {
        if (prevProps.component !== this.props.component)
            this.queryHPImportance()
    }

    private queryHPImportance() {
        const {structure, component} = this.props;
        this.setState({error: undefined});

        const cs = structure.configspace
        const configs = structure.configs.map(c => {
            const obj: any = {}
            c.config.forEach((v, k) => obj[k] = v)
            return obj
        })
        const loss = structure.configs.map(c => c.loss)

        requestFANOVA(cs, configs, loss, component)
            .then(resp => {
                if (resp.details)
                    this.setState({overview: resp.overview, details: resp.details})
                else
                    this.setState({overview: resp.overview})
            })
            .catch(error => {
                console.error(`Failed to fetch HPImportance data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });
    }

    private selectRow(idx: number) {
        this.setState({selectedRow: idx})
    }

    private getDetails(selectedRow: number): HPImportanceDetails {
        if (selectedRow === undefined)
            return undefined

        const keys = this.state.overview.keys[selectedRow]
        if (isNaN(keys[1]))
            keys[1] = keys[0]
        // @ts-ignore
        return this.state.details[keys[0]][keys[1]]
    }

    private renderOverview(marginTop: number) {
        const {overview, selectedRow} = this.state
        const radius = 10
        const margin = 5

        const stepSize = (2 * radius) + margin

        const nColumns = overview.hyperparameters.length
        const nRows = overview.keys.length

        const width = nColumns * stepSize
        const height = nRows * stepSize

        const rows = [...Array(nRows).keys()].map(i => {
            const activeColumns = overview.keys[i].filter(a => !isNaN(a))
            return (
                <g key={overview.hyperparameters[i]} onClick={() => this.selectRow(i)}>
                    {selectedRow === i &&
                    <rect x={-1.25 * radius} width={width + radius}
                          y={i * stepSize - 1.25 * radius} height={2.5 * radius}
                          fill={'var(--md-grey-300)'}/>}

                    {[...Array(nColumns).keys()].map(j => (
                        <circle key={overview.hyperparameters[j]} cx={j * stepSize} cy={i * stepSize} r={radius}
                                fill={activeColumns.includes(j) ? '#555' : '#ccc'}/>
                    ))}
                    {d3.pairs<number>(activeColumns).map(([a, b]) => (
                        <path d={`M ${a * stepSize} ${i * stepSize} H ${b * stepSize}`} stroke={'#555'}
                              strokeWidth={radius / 2}/>
                    ))}
                </g>
            )
        })

        const boldHeaders = selectedRow !== undefined ? this.state.overview.keys[selectedRow] : []
        const headers = [...Array(nRows).keys()].map(i => (
            <g transform={`translate(${i * stepSize + (radius / 2)}, ${marginTop - 20})`}>
                <text transform={'rotate(-50)'} className={boldHeaders.includes(i) ? 'selected-header' : ''}>
                    {overview.hyperparameters[i]}</text>
            </g>))

        return (
            <>
                <svg width={width} height={height + marginTop} style={{overflow: "visible"}}>
                    <g transform={'translate(10, 10)'}>
                        <g transform={`translate(0, ${marginTop})`}>{rows}</g>
                        <g>{headers}</g>
                    </g>
                </svg>
                <BarChart data={overview.importance} layout={'vertical'} width={width}
                          height={height + marginTop}
                          margin={{top: marginTop - 32, bottom: 0, left: 5, right: 5}}
                          barSize={2 * radius} barGap={margin} style={{overflow: "visible"}}>
                    <text x={width / 2} y={marginTop - 30} textAnchor={'middle'}>Importance</text>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey={'importance'} type={'number'} orientation={'top'} domain={[-0.001, 1]}/>
                    <YAxis dataKey="idx" type={"category"} interval={0} hide/>

                    {selectedRow !== undefined && <ReferenceArea x1={0} x2={1} y1={selectedRow} y2={selectedRow}
                                                                 fill={'var(--md-grey-300)'} fillOpacity={1}/>}

                    <Bar dataKey="importance"
                         fill={Colors.DEFAULT}
                         onClick={(d) => this.selectRow(d.idx)}
                         isAnimationActive={selectedRow === undefined}>
                        <ErrorBar dataKey="std" height={radius / 2} strokeWidth={2} stroke={Colors.HIGHLIGHT}
                                  direction="x"/>
                    </Bar>
                </BarChart>
            </>
        )
    }

    render() {
        const {error, overview, selectedRow} = this.state

        const maxLabelLength = overview?.hyperparameters ?
            Math.max(...overview.hyperparameters.map(d => d.length)) * 6 : 0

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error &&
                <div style={{display: 'flex'}}>
                    <LoadingIndicator loading={overview === undefined}/>
                    {overview?.keys.length === 0 && <p>The selected component does not have any hyperparameters. </p>}
                    {overview?.keys.length > 0 &&
                    <>
                        {this.renderOverview(maxLabelLength)}
                        <div style={{marginTop: maxLabelLength, marginLeft: '20px', flexGrow: 1, flexShrink: 1}}>
                            {selectedRow === undefined ?
                                <p>Select a hyperparameter (pair) on the left side to get a detailed visualization of
                                    the correlation of the selected hyperparameter with the marginal performance.</p> :
                                <SingleHP data={this.getDetails(selectedRow)}/>
                            }
                        </div>
                    </>}
                </div>
                }
            </>
        )
    }
}
