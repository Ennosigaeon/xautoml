import React from "react";
import {ContinuousHPImportance, HPImportanceDetails, ImportanceOverview} from "../../dao";


import * as d3 from 'd3'

import {Colors, JupyterContext, maxLabelLength, prettyPrint} from "../../util";
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
import {LoadingIndicator} from "../../util/loading";
import {Heatbar, MinimalisticTooltip} from "../../util/recharts";
import {ImportanceOverviewComp} from "../../util/importance_overview";
import {ID} from "../../jupyter";
import {DetailsModel} from "./model";
import {JupyterButton} from "../../util/jupyter-button";

interface SingleHPProps {
    data: HPImportanceDetails
    metric: string

    onExportClick: () => void
}

class SingleHP extends React.Component<SingleHPProps> {

    render() {
        const {data, metric} = this.props

        let description
        let plot;
        let additionalData;
        if (data.mode === 'discrete') {
            description = 'On the x axis, the different values of the selected categorical hyperparameter are ' +
                'displayed. For each possible value, the marginal performance is calculated by averaging over all ' +
                'other possible hyperparameter constellations. The according marginal performance is displayed on ' +
                'the y axis.'

            const whiskers: any[] = [];
            Object.entries<[number, number]>(data.data).forEach(([key, value]) => {
                whiskers.push({label: key, y: value})
            })

            plot = (
                <BarChart data={whiskers} margin={{left: 30, bottom: 5}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="label" label={{value: data.name[0], dy: 10}}/>
                    <YAxis label={{value: `Marginal ${metric}`, angle: -90, dx: -40}} domain={['auto', 'auto']}/>

                    <Tooltip content={<MinimalisticTooltip/>}/>

                    <Bar dataKey="y" fill={Colors.DEFAULT}/>
                </BarChart>
            )
        } else if (data.mode === 'continuous') {
            if (data.name.length === 1) {
                description = 'On the x axis, the range of the selected numerical hyperparameter is displayed. For 20 ' +
                    'evenly distributed values on this range, the marginal performance is calculated by averaging over ' +
                    'all other possible hyperparameter constellations. The according marginal performance is displayed ' +
                    'on the y axis.'

                plot = (
                    <ComposedChart data={(data.data as ContinuousHPImportance)} margin={{left: 30, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="x" label={{value: data.name[0], dy: 10}} type={'number'}
                               domain={['dataMin', 'dataMax']}/>
                        <YAxis label={{value: `Marginal ${metric}`, angle: -90, dx: -40}} domain={['auto', 'auto']}/>
                        <Area type="monotone" dataKey="area" fill={Colors.DEFAULT} stroke={Colors.DEFAULT}/>
                        <Line type="monotone" dataKey={'y'} stroke={Colors.HIGHLIGHT} strokeWidth={2} dot={false}/>
                    </ComposedChart>
                )
            } else {
                description = 'On the x axis, the range of the selected numerical hyperparameter is displayed. For ' +
                    'each possible value of the selected numerical hyperparameter, an additional line is plotted. ' +
                    'For each line, 20 evenly distributed values on the numerical range are created and the marginal ' +
                    'performance is calculated by averaging over all other possible hyperparameter constellations. ' +
                    'The according marginal performance is displayed on the y axis.'

                const keys = Object.keys(data.data[0]).filter(k => k !== 'x')
                plot = (
                    <LineChart data={data.data} margin={{left: 30}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="x" label={{value: data.name[1], dy: 10}} type={'number'}
                               domain={['dataMin', 'dataMax']}/>
                        <YAxis label={{value: `Marginal ${metric}`, angle: -90, dx: -40}} domain={['auto', 'auto']}/>
                        <Legend/>
                        {keys.map((key, idx) => (
                            <Line key={key} type="monotone" name={key} dataKey={key}
                                  stroke={Colors.getColor(idx)} strokeWidth={2} dot={false}/>
                        ))}
                    </LineChart>
                )
            }
        } else if (data.mode === 'heatmap') {
            description = 'On the x axis, the range of the first selected numerical hyperparameter and on the ' +
                'y axis the range of the second selected numerical hyperparameter is displayed. For both ' +
                'hyperparameters, 20 evenly distributed values are created and the marginal performance of each ' +
                'possible combination of those 20 points is calculated by averaging over all other possible ' +
                'hyperparameter constellations. The according marginal performance is displayed using a color ' +
                'scale. The range of the color scale is displayed above the heat map.'

            const rows = Object.keys(data.data)
            const columns = Object.keys(data.data[rows[0]])

            const values: number[] = Object.values(data.data)
                .map(d => Object.values(d)).reduce((a, b) => a.concat(b), [])
            const min = Math.min(...values)
            const max = Math.max(...values)
            const scale = d3.scaleSequential(d3.interpolateSpectral)
                .domain([min, max])

            const marginLeft = columns.map(r => r.length).reduce((a, b) => Math.max(a, b), 0) * 5
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
                           tickFormatter={x => prettyPrint(rows[x - 0.5], 2)}
                           label={{value: data.name[1], dy: 10}}/>
                    <YAxis type="number" dataKey="y"
                           domain={[0, columns.length]}
                           ticks={[...Array(columns.length).keys()].map((_, i) => i + 0.5)}
                           interval={0}
                           tickFormatter={y => prettyPrint(columns[y - 0.5], 2)}
                           label={{value: data.name[0], angle: -90, dx: -marginLeft - 20}}/>
                    <Tooltip cursor={{strokeDasharray: '3 3'}}/>
                </LineChart>
            )
            additionalData = (
                <Heatbar scale={scale} marginLeft={marginLeft} label={metric}/>
            )
        }

        return (
            <div>
                <div style={{display: "flex", alignItems: "end"}}>
                    <div>
                        <p>{description}</p>
                        <JupyterButton onClick={this.props.onExportClick}/>
                    </div>
                </div>

                {additionalData && additionalData}

                <div style={{height: '250px', width: '100%'}}>
                    <ResponsiveContainer>
                        {plot}
                    </ResponsiveContainer>
                </div>
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
    model: DetailsModel
    metric: string

    selectedHp1?: string
    selectedHp2?: string
    onHpChange?: (hp1: string, hp2: string) => void
}

interface HPImportanceState {
    overview: ImportanceOverview
    details: Map<string, Map<string, HPImportanceDetails>>
    error: Error
    selectedRow: number
}

export class HPImportanceComp extends React.Component<HPImportanceProps, HPImportanceState> {

    static readonly HELP = 'Visualizes the impact of each hyperparameter (pair) on the marginal performance. This ' +
        'allows the identification of hyperparameters with a large impact on the performance of the pipeline. ' +
        'Additionally, hyperparameter regions having a high correlation with a good performance can be identified. ' +
        'By selecting a single step in the structure graph above, only the hyperparameters of the selected step are ' +
        'shown. To view the overall most important hyperparameters, select either the pipeline source or sink.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: HPImportanceProps) {
        super(props);
        this.state = {overview: undefined, details: undefined, error: undefined, selectedRow: undefined}

        this.selectRow = this.selectRow.bind(this)
        this.exportOverview = this.exportOverview.bind(this)
        this.exportDetails = this.exportDetails.bind(this)
    }

    componentDidMount() {
        window.setTimeout(() => this.queryHPImportance()
            .then(() => this.selectRow(this.state.overview.keys
                .findIndex(k => k[0] === this.props.selectedHp1 && k[1] === this.props.selectedHp2))), 100)
    }

    componentDidUpdate(prevProps: Readonly<HPImportanceProps>, prevState: Readonly<HPImportanceState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component)
            this.queryHPImportance()
        if (prevProps.selectedHp1 !== this.props.selectedHp1 || prevProps.selectedHp2 !== this.props.selectedHp2)
            this.selectRow(this.state.overview.keys
                .findIndex(k => k[0] === this.props.selectedHp1 && k[1] === this.props.selectedHp2))
    }

    private queryHPImportance() {
        const {model} = this.props;
        this.setState({error: undefined, overview: undefined, selectedRow: undefined, details: undefined});

        return this.context.requestFANOVA(model.structure.cid, model.component)
            .then(resp => {
                if (resp.error)
                    this.setState({error: new Error(resp.error)})
                else
                    this.setState({overview: resp.overview})
            })
            .catch(error => {
                console.error(`Failed to fetch HPImportance data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });
    }

    private selectRow(idx: number) {
        if (idx === -1) {
            this.setState({selectedRow: undefined, details: undefined})
            return
        }

        const {model} = this.props;
        this.setState({selectedRow: idx, details: undefined})

        const [hp1, hp2] = this.state.overview.keys[idx]
        this.context.requestFANOVADetails(model.structure.cid, model.component, [hp1, hp2])
            .then(resp => {
                if (resp.error)
                    this.setState({error: new Error(resp.error)})
                else
                    this.setState({details: resp.details})
            })
            .catch(error => {
                console.error(`Failed to fetch HPImportance data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });

        if (this.props.onHpChange !== undefined && (this.props.selectedHp1 !== hp1 || this.props.selectedHp2 !== hp2))
            this.props.onHpChange(hp1, hp2)
    }

    private getDetails(selectedRow: number): HPImportanceDetails {
        if (selectedRow === undefined)
            return undefined

        const [hp0, hp1] = this.state.overview.keys[selectedRow]
        return this.state.details.get(hp0)?.get(hp1)
    }

    private exportOverview() {
        const {model} = this.props

        this.context.createCell(`
${ID}_hp_importance = gcx().hp_importance('${model.structure.cid}', '${model.component}')
${ID}_hp_importance
        `.trim())
    }

    private exportDetails() {
        const {model} = this.props
        const [hp1, hp2] = this.state.overview.keys[this.state.selectedRow]

        this.context.createCell(`
${ID}_hp_interactions = gcx().hp_interactions('${model.structure.cid}', '${model.component}', '${hp1}', '${hp2}')
${ID}_hp_interactions
        `.trim())
    }


    render() {
        const {error, overview, selectedRow} = this.state
        const marginTop = overview?.column_names ? maxLabelLength(overview.column_names) : 0

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error && <div style={{display: 'flex'}}>
                    <LoadingIndicator loading={overview === undefined}/>
                    {overview?.keys.length === 0 && <p>The selected component does not have any hyperparameters. </p>}
                    {overview?.keys.length > 0 && <>
                        <ImportanceOverviewComp overview={overview} selectedRow={selectedRow}
                                                onExportClick={this.exportOverview}
                                                onSelectRow={this.selectRow}/>
                        <div style={{
                            marginLeft: '20px',
                            flexGrow: 1,
                            flexShrink: 1,
                            minWidth: 'auto'
                        }}>
                            {selectedRow === undefined ?
                                <p style={{marginTop: marginTop}}>
                                    Select a hyperparameter (pair) on the left side to get a detailed visualization of
                                    the correlation of the selected hyperparameter (pairs) in combination with the
                                    marginal performance.
                                </p> :
                                <>
                                    <LoadingIndicator loading={this.state.details === undefined}/>
                                    {this.state.details && <SingleHP data={this.getDetails(selectedRow)}
                                                                     metric={this.props.metric}
                                                                     onExportClick={this.exportDetails}/>}
                                </>

                            }
                        </div>
                    </>}
                </div>
                }
            </>
        )
    }
}
