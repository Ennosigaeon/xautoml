import React from "react";
import {Candidate, Config, ConfigValue, MetaInformation, Structure} from "../model";
import * as dagre from "dagre";
import {graphlib} from "dagre";
import {fixedPrec, normalizeComponent} from "../util";
import {Table, TableBody, TableCell, TableRow, Tooltip, Typography} from "@material-ui/core";
import {OutputDescriptionData, requestOutputDescription} from "../handler";
import {LoadingIndicator} from "./loading";


interface StructureGraphProps {
    structure: Structure
    candidate: Candidate
    meta: MetaInformation
    onComponentSelection?: (component: [string, string]) => void
}

interface StructureGraphState {
    loading: boolean
    outputs: OutputDescriptionData
}

export class StructureGraphComponent extends React.Component<StructureGraphProps, StructureGraphState> {

    static readonly SOURCE = 'SOURCE'
    static readonly SINK = 'SINK'

    constructor(props: StructureGraphProps) {
        super(props);

        this.state = {loading: false, outputs: new Map<string, string>()}
        this.fetchOutputs = this.fetchOutputs.bind(this)
    }

    fetchOutputs() {
        if (this.state.loading) {
            // Loading already in progress
            return
        }
        if (this.state.outputs.size > 0) {
            // Outputs already cached
            return
        }

        this.setState({loading: true})
        requestOutputDescription(this.props.candidate.id, this.props.meta.data_file, this.props.meta.model_dir)
            .then(data => this.setState({outputs: data, loading: false}))
            .catch(reason => {
                // TODO handle error
                console.error(`Failed to fetch output data.\n${reason}`);
                this.setState({loading: false})
            });
    }

    private static isPipEnd(id: string): boolean {
        return id === StructureGraphComponent.SOURCE || id === StructureGraphComponent.SINK
    }

    render() {
        const {structure, candidate} = this.props
        const nodeDimensions = {width: 100, height: 40}
        const margin = {top: 5, left: 10}

        const graph = new graphlib.Graph();
        graph.setGraph({rankdir: 'LR', nodesep: 20, ranksep: 20});
        graph.setDefaultEdgeLabel(() => ({}))

        const edges: [string, string][] = []
        const nodeMap = new Map<string, string>([[StructureGraphComponent.SOURCE, 'Source'], [StructureGraphComponent.SINK, 'Sink']])


        let source = StructureGraphComponent.SOURCE
        structure.pipeline.steps.forEach(([id, label]) => {
            nodeMap.set(id, label)
            edges.push([source, id])
            source = id
        })
        edges.push([source, StructureGraphComponent.SINK])
        nodeMap.forEach((label, id) => graph.setNode(id, {
            label: normalizeComponent(label),
            width: StructureGraphComponent.isPipEnd(id) ? nodeDimensions.width / 4 : nodeDimensions.width,
            height: StructureGraphComponent.isPipEnd(id) ? nodeDimensions.width / 4 : nodeDimensions.height
        }))
        edges.forEach(([source, target]) => graph.setEdge(source, target))
        dagre.layout(graph);

        const subConfigs = new Map<string, Config>(
            structure.pipeline.steps
                .map(([id, _]) => id)
                .map(step => {
                        const prefix = `${step}:`
                        const subConfig = new Map<string, ConfigValue>()

                        Array.from(candidate.config.keys())
                            .filter(k => k.startsWith(prefix))
                            .forEach(key => {
                                subConfig.set(key.substring(prefix.length), candidate.config.get(key))
                            })
                        return [step, subConfig]
                    }
                )
        )

        return (
            <svg style={{width: '100%', height: '100%'}}>
                <g id={"transformGroup"} transform={`translate(${margin.left},${margin.top})`}>
                    {graph.nodes().map(id => {
                        const node = graph.node(id)
                        const content = StructureGraphComponent.isPipEnd(id) ?
                            <div className={'structure-graph_node structure-graph_end-node'}/> :
                            <div className={'structure-graph_node'}>{node.label}</div>

                        const configuration = subConfigs.has(id) && subConfigs.get(id).size > 0 ? <>
                            <Typography color="inherit" component={'h4'}>Configuration</Typography>
                            <Table>
                                <TableBody>
                                    {Array.from(subConfigs.get(id)?.entries())
                                        .map(([name, value]) => (
                                            <TableRow key={name}>
                                                <TableCell component="th"
                                                           scope="row">{name}</TableCell>
                                                <TableCell align="right">{
                                                    typeof value === 'number' ? fixedPrec(value, 5) : String(value)
                                                }</TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </> : <Typography color="inherit" component={'h4'}>No Configuration</Typography>

                        const output = this.state.outputs.has(id) ?
                            <div dangerouslySetInnerHTML={{__html: this.state.outputs.get(id)}}/> : <div>Missing</div>

                        const tooltipContent = <>
                            {configuration}
                            <hr/>
                            <Typography color="inherit" component={'h4'}>Output</Typography>
                            <LoadingIndicator loading={this.state.loading}/>
                            {!this.state.loading && output}
                        </>

                        return <g key={id}
                                  transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}>
                            <foreignObject
                                width={`${node.width}px`}
                                height={`${node.height}px`}
                                requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility"
                                onClick={(e) => {
                                    if (!!this.props.onComponentSelection) {
                                        this.props.onComponentSelection([id, node.label])
                                        e.stopPropagation()
                                    }
                                }}>
                                <Tooltip placement={'top'}
                                         classes={{tooltip: 'structure-graph_tooltip jp-RenderedHTMLCommon'}}
                                         title={tooltipContent}
                                         enterDelay={750}
                                         onOpen={this.fetchOutputs}>
                                    {content}
                                </Tooltip>
                            </foreignObject>
                        </g>
                    })}

                    {graph.edges().map(edge => {
                        return (
                            <path
                                key={`${edge.v}-${edge.w}`}
                                markerEnd="url(#triangle)"
                                stroke="black"
                                fill="none"
                                d={`${graph.edge(edge).points
                                    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
                                    .join(' ')}`}
                            />
                        );
                    })}


                </g>
            </svg>
        )
    }

}
