import React from "react";
import {ConfigSimilarityResponse} from "../../dao";
import {
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    ReferenceArea,
    ResponsiveContainer,
    Scatter,
    XAxis,
    YAxis
} from "recharts";
import {Colors, JupyterContext, prettyPrint} from "../../util";
import * as d3 from "d3";
import {CandidateId, MetaInformation, Structure} from "../../model";
import {LoadingIndicator} from "../../util/loading";
import {Heatbar} from "../../util/recharts";
import {ErrorIndicator} from "../../util/error";

interface OptimizationProgressProps {
    meta: MetaInformation
    structures: Structure[]
    selectedCandidates: Set<CandidateId>
    hideUnselectedCandidates: boolean
    timestamp: number
    height: string
    onCandidateSelection?: (cid: Set<CandidateId>, show?: boolean) => void
}

interface OptimizationProgressState {
    cids: CandidateId[]
    data: ConfigSimilarityResponse
    error: Error
}

export class OptimizationProgress extends React.Component<OptimizationProgressProps, OptimizationProgressState> {

    static readonly HELP = 'Visualizes the distribution of the selected configurations in the complete search space. ' +
        'For the visualization, the search space as well as all configurations are mapped into 2D space. Similar ' +
        'configurations are mapped into the same region in the 2D space. Each scatter dot represents a single ' +
        'configuration, squares are incumbent configurations. In addition, the marginal performance is displayed ' +
        'using a color scale. The range of the color scale is displayed above the heat map.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    static defaultProps = {
        onCandidateSelection: () => {
        }
    }

    constructor(props: OptimizationProgressProps) {
        super(props);
        this.state = {cids: [], data: undefined, error: undefined}

        this.onScatterClick = this.onScatterClick.bind(this)
    }

    componentDidMount() {
        this.setState({cids: [].concat(...this.props.structures.map(s => s.configs.map(c => c.id)))})
        this.queryConfigSimilarity()
    }

    private queryConfigSimilarity() {
        this.context.requestConfigSimilarity()
            .then(res => this.setState({data: res}))
            .catch(error => {
                console.error(`Failed to fetch Roc Curve data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });
    }

    private onScatterClick(point: { x: number, y: number, idx: number }, _: number, e: React.MouseEvent) {
        const cid: CandidateId = this.state.cids[point.idx]

        if (!e.ctrlKey) {
            const selected = new Set(this.props.selectedCandidates)
            if (this.props.selectedCandidates.has(cid))
                selected.delete(cid)
            else
                selected.add(cid)
            this.props.onCandidateSelection(selected)
        } else {
            this.props.onCandidateSelection(new Set<CandidateId>([cid]), true)
        }
    }

    render() {
        const {selectedCandidates, hideUnselectedCandidates} = this.props
        const {cids, data, error} = this.state

        const values = data ? data.surface.map(s => s.z) : [0, 1]
        const scale = d3.scaleSequential(d3.interpolateSpectral)
            .domain([Math.min(...values), Math.max(...values)])

        // Calculate padding for axes to ensure that all patches are actually plotted
        const patchPadding = data ? data.surface.slice(0, 1)
            .map(p => [(p.x2 - p.x1) / 1.9, (p.y2 - p.y1) / 1.9])[0] : [0, 0]

        return (
            <div style={{height: this.props.height}}>
                <LoadingIndicator loading={data === undefined && error === undefined}/>
                <ErrorIndicator error={error}/>
                {data &&
                    <div style={{height: '100%', display: "flex", flexDirection: "column"}}>
                        <div style={{flex: '1 1 auto'}}>
                            <ResponsiveContainer>
                                <ComposedChart>
                                    <CartesianGrid strokeDasharray="3 3"/>

                                    <XAxis type="number" dataKey="x" label={{value: 'Dimension 1', dy: 10}}
                                           domain={[`dataMin - ${patchPadding[0]}`, `dataMax + ${patchPadding[0]}`]}
                                           tickFormatter={prettyPrint}/>
                                    <YAxis type="number" dataKey="y" label={{value: 'Dimension 2', angle: -90, dx: -20}}
                                           domain={[`dataMin - ${patchPadding[1]}`, `dataMax + ${patchPadding[1]}`]}
                                           tickFormatter={prettyPrint}/>

                                    {data.surface.map(patch => (
                                        <ReferenceArea
                                            key={`${patch.x1}_${patch.y1}`}
                                            x1={patch.x1}
                                            x2={patch.x2}
                                            y1={patch.y1}
                                            y2={patch.y2}
                                            fill={scale(patch.z)}
                                            fillOpacity={1}
                                            stroke="white"
                                            strokeOpacity={0}
                                        />
                                    ))}

                                    <Scatter dataKey="y" data={data.config}
                                             fill={'none'} stroke={'none'}
                                             name={'Candidates'}
                                             onClick={this.onScatterClick}>
                                        {data.config
                                            .filter(c => c.idx <= this.props.timestamp && (!hideUnselectedCandidates || selectedCandidates.has(cids[c.idx])))
                                            .map((d, index) => (
                                                <Cell key={`cell-${index}`}
                                                      fill={selectedCandidates.has(cids[d.idx]) ? Colors.HIGHLIGHT : Colors.DEFAULT}
                                                      stroke={Colors.BORDER}
                                                      cursor={'pointer'}/>
                                            ))}
                                    </Scatter>

                                    <Scatter dataKey="y" data={data.incumbents}
                                             shape={<rect width={15} height={15}/>}
                                             fill={'none'} stroke={'none'}
                                             name={'Incumbents'} legendType={'rect'}
                                             onClick={this.onScatterClick}>
                                        {data.incumbents
                                            .filter(c => c.idx <= this.props.timestamp && (!hideUnselectedCandidates || selectedCandidates.has(cids[c.idx])))
                                            .map((d, index) => (
                                                <Cell key={`cell-${index}`}
                                                      fill={selectedCandidates.has(cids[d.idx]) ? Colors.HIGHLIGHT : Colors.DEFAULT}
                                                      width={15}
                                                      height={15}
                                                      stroke={Colors.BORDER}
                                                      cursor={'pointer'}/>
                                            ))}
                                    </Scatter>
                                    <Legend verticalAlign="top" content={
                                        <ul className="recharts-default-legend"
                                            style={{padding: '0px', margin: '0px', textAlign: 'center'}}>
                                            <li className="recharts-legend-item legend-item-0"
                                                style={{display: 'inline-block', marginRight: '10px'}}>
                                                <svg className="recharts-surface" width="14" height="14"
                                                     viewBox="0 0 32 32" version="1.1">
                                                    <path fill="#abe2fb" cx="16" cy="16" type="circle"
                                                          className="recharts-symbols" transform="translate(16, 16)"
                                                          d="M16,0A16,16,0,1,1,-16,0A16,16,0,1,1,16,0"/>
                                                </svg>
                                                <span className="recharts-legend-item-text">Candidates</span></li>
                                            <li className="recharts-legend-item legend-item-1"
                                                style={{display: 'inline-block', marginRight: '10px'}}>
                                                <svg className="recharts-surface" width="14" height="14"
                                                     viewBox="0 0 32 32" version="1.1">
                                                    <path stroke="none" fill="#abe2fb" d="M0,0h30v30h-30z"
                                                          className="recharts-legend-icon"/>
                                                </svg>
                                                <span className="recharts-legend-item-text">Incumbents</span></li>
                                        </ul>
                                    }/>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{flex: '0 1 auto'}}>
                            <Heatbar scale={scale} label={this.props.meta.metric}/>
                        </div>
                    </div>
                }
            </div>
        )
    }
}
