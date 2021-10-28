import React from "react";
import {Candidate, Config, ConfigValue, MetaInformation, Structure} from "../model";
import * as dagre from "dagre";
import {graphlib} from "dagre";
import {fixedPrec, normalizeComponent} from "../util";
import {Table, TableBody, TableCell, TableRow, Tooltip, Typography} from "@material-ui/core";
import {OutputDescriptionData, requestOutputDescription} from "../handler";
import {LoadingIndicator} from "./loading";
import {ErrorIndicator} from "../util/error";


interface Node {
    label: string
    config: Config
    x: number,
    y: number,
    width: number
    height: number
}

interface SingleComponentProps {
    id: string
    node: Node

    error: Error
    loading: boolean
    output: string

    onHover: () => void
    onClick?: (component: [string, string]) => void
}

class SingleComponent extends React.Component<SingleComponentProps, any> {

    render() {
        const {id, node, error, loading, output, onHover, onClick} = this.props

        const configTable: [[string, ConfigValue][], [string, ConfigValue][]] = [[], []]
        Array.from(node.config?.entries())
            .forEach(([name, value], idx) => {
                configTable[idx % 2].push([name, value])
            })
        // Ensure that left and right array have exactly the same amount of elements
        if (configTable[0].length != configTable[1].length)
            configTable[1].push(["", ""])

        const configuration = <>
            <Typography color="inherit" component={'h4'}>Configuration</Typography>
            <Table>
                <TableBody>
                    {configTable[0]
                        .map(([name, value], idx) => {
                            const name2 = configTable[1][idx][0]
                            const value2 = configTable[1][idx][1]

                            return (
                                <TableRow key={name}>
                                    <TableCell component="th"
                                               scope="row">{name}</TableCell>
                                    <TableCell align="right">{
                                        typeof value === 'number' ? fixedPrec(value, 5) : String(value)
                                    }</TableCell>

                                    <TableCell component="th"
                                               scope="row">{name2}</TableCell>
                                    <TableCell align="right">{
                                        typeof value2 === 'number' ? fixedPrec(value2, 5) : String(value2)
                                    }</TableCell>
                                </TableRow>
                            )
                        })
                    }
                </TableBody>
            </Table>
        </>

        const tooltipContent = <>
            {node.config.size > 0 ?
                configuration :
                <Typography color="inherit" component={'h4'}>No Configuration</Typography>}
            <hr/>
            <Typography color="inherit" component={'h4'}>Output</Typography>

            <ErrorIndicator error={error}/>
            {!error &&
            <>
                <LoadingIndicator loading={loading}/>
                {!loading && (output ?
                    <div style={{overflowX: "auto", marginBottom: 0}}
                         dangerouslySetInnerHTML={{__html: output}}/> : <div>Missing</div>)
                }
            </>}
        </>

        return (
            <g key={id}
               transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}>
                <foreignObject
                    width={`${node.width}px`}
                    height={`${node.height}px`}
                    requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility"
                    onClick={(e) => {
                        if (!!onClick) {
                            onClick([id, node.label])
                            e.stopPropagation()
                        }
                    }}>
                    <Tooltip placement={'top'}
                             classes={{tooltip: 'structure-graph_tooltip jp-RenderedHTMLCommon'}}
                             title={tooltipContent}
                             enterDelay={500}
                             enterNextDelay={500}
                             leaveDelay={500}
                             interactive={true}
                             onOpen={onHover}>
                        {isPipEnd(id) ?
                            <div className={'structure-graph_node structure-graph_end-node'}/> :
                            <div className={'structure-graph_node'}>{node.label}</div>
                        }
                    </Tooltip>
                </foreignObject>
            </g>

        )
    }
}

interface StructureGraphProps {
    structure: Structure
    candidate: Candidate
    meta: MetaInformation
    onComponentSelection?: (component: [string, string]) => void
}

interface StructureGraphState {
    loading: boolean
    outputs: OutputDescriptionData
    error: Error
}

export class StructureGraphComponent extends React.Component<StructureGraphProps, StructureGraphState> {

    static readonly SOURCE = 'SOURCE'
    static readonly SINK = 'SINK'

    constructor(props: StructureGraphProps) {
        super(props);

        this.state = {loading: false, outputs: new Map<string, string>(), error: undefined}
        this.fetchOutputs = this.fetchOutputs.bind(this)
    }

    fetchOutputs() {
        if (this.state.loading)
            // Loading already in progress
            return
        if (this.state.outputs.size > 0)
            // Outputs already cached
            return

        this.setState({loading: true})
        requestOutputDescription(this.props.candidate.id, this.props.meta.data_file, this.props.meta.model_dir)
            .then(data => this.setState({outputs: data, loading: false}))
            .catch(error => {
                console.error(`Failed to fetch output data.\n${error.name}: ${error.message}`);
                this.setState({error: error})
            });
    }

    render() {
        const {structure, candidate, onComponentSelection} = this.props
        const {outputs, loading, error} = this.state

        const nodeDimensions = {width: 100, height: 40}
        const margin = {top: 5, left: 10}

        const graph = new graphlib.Graph<Node>();
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

        nodeMap.forEach((label, id) => {
            const prefix = `${id}:`
            const subConfig = new Map<string, ConfigValue>()

            Array.from(candidate.config.keys())
                .filter(k => k.startsWith(prefix))
                .forEach(key => {
                    subConfig.set(key.substring(prefix.length), candidate.config.get(key))
                })

            graph.setNode(id, {
                label: normalizeComponent(label),
                config: subConfig,
                width: isPipEnd(id) ? nodeDimensions.width / 4 : nodeDimensions.width,
                height: isPipEnd(id) ? nodeDimensions.width / 4 : nodeDimensions.height
            })
        })
        edges.forEach(([source, target]) => graph.setEdge(source, target))
        dagre.layout(graph);

        return (
            <svg style={{width: '100%', height: '100%'}}>
                <g id={"transformGroup"} transform={`translate(${margin.left},${margin.top})`}>
                    {graph.nodes().map(id => {
                        return <SingleComponent id={id}
                                                node={graph.node(id)}
                                                loading={loading}
                                                error={error}
                                                output={outputs.get(id)}
                                                onHover={this.fetchOutputs}
                                                onClick={onComponentSelection}/>
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

function isPipEnd(id: string): boolean {
    return id === StructureGraphComponent.SOURCE || id === StructureGraphComponent.SINK
}
