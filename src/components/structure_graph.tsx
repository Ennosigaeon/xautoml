import React from "react";
import {Candidate, Config, ConfigValue, MetaInformation, Structure} from "../model";
import * as dagre from "dagre";
import {graphlib} from "dagre";
import {fixedPrec, normalizeComponent} from "../util";
import {Table, TableBody, TableCell, TableRow, Tooltip, Typography} from "@material-ui/core";
import {requestOutputDescription} from "../handler";


interface StructureGraphProps {
    structure: Structure
    candidate: Candidate
    meta: MetaInformation
}

interface StructureGraphState {
    loading: boolean
    outputs: Map<string, string>
}

export class StructureGraphComponent extends React.Component<StructureGraphProps, StructureGraphState> {

    static readonly SOURCE = 'SOURCE'
    static readonly SINK = 'SINK'

    constructor(props: StructureGraphProps) {
        super(props);

        this.state = {loading: false, outputs: undefined}
        this.fetchOutputs = this.fetchOutputs.bind(this)
    }

    fetchOutputs() {
        if (this.state.loading) {
            // Loading already in progress
            return
        }
        if (this.state.outputs !== undefined) {
            // Outputs already cached
            return
        }

        this.setState({loading: true})
        requestOutputDescription([this.props.candidate.id], this.props.meta.data_file, this.props.meta.model_dir)
            .then(data => {
                if (this.props.candidate.id in data) {
                    const map = new Map<string, string>(Object.entries(data[this.props.candidate.id]))
                    this.setState({outputs: map, loading: false})
                } else {
                    // TODO handle error
                    console.error(`Expected ${this.props.candidate.id} in ${JSON.stringify(data)}`)
                    this.setState({outputs: new Map<string, string>(), loading: false})
                }
            })
            .catch(reason => {
                // TODO handle error
                console.error(`Failed to fetch output data.\n${reason}`);
                this.setState({outputs: new Map<string, string>(), loading: false})
            });
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
            width: nodeDimensions.width,
            height: nodeDimensions.height
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
                        let offset: [number, number]
                        let content: JSX.Element
                        switch (id) {
                            case StructureGraphComponent.SOURCE:
                                offset = [node.width - nodeDimensions.height / 2, nodeDimensions.height / 4]
                                content = <div className={'structure-graph_end-node'} style={{width: node.height / 2}}/>
                                break
                            case StructureGraphComponent.SINK:
                                offset = [0, nodeDimensions.height / 4]
                                // noinspection JSSuspiciousNameCombination
                                content = <div className={'structure-graph_end-node'} style={{width: node.height / 2}}/>
                                break
                            default:
                                offset = [0, 0]
                                content = <div className={'structure-graph_node'}>{node.label}</div>
                        }


                        const configuration = subConfigs.has(id) && subConfigs.get(id).size > 0 ? <>
                            <Typography color="inherit" component={'h4'}>Configuration</Typography>
                            <Table>
                                <TableBody>
                                    {Array.from(subConfigs.get(id).entries())
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

                        let output: JSX.Element
                        if (this.state.outputs === undefined) {
                            output = <div>Loading...</div>
                        } else if (!this.state.outputs.has(id)) {
                            output = <div>Missing</div>
                        } else {
                            output = <div dangerouslySetInnerHTML={{__html: this.state.outputs.get(id)}}/>
                        }

                        return <g key={id}
                                  transform={`translate(${node.x - node.width / 2 + offset[0]}, ${node.y - node.height / 2 + offset[1]})`}>
                            <foreignObject
                                width={`${node.width}px`}
                                height={`${node.height}px`}
                                requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility">
                                <Tooltip placement={'bottom'}
                                         classes={{tooltip: 'structure-graph_tooltip jp-RenderedHTMLCommon'}} title={
                                    <>
                                        {configuration}
                                        <hr/>
                                        <Typography color="inherit" component={'h4'}>Output</Typography>
                                        {output}
                                    </>
                                } onOpen={this.fetchOutputs}>
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
