import React from "react";
import {Candidate, Config, ConfigValue, Structure} from "./model";
import * as dagre from "dagre";
import {graphlib} from "dagre";
import {fixedPrec, normalizeComponent} from "./util";
import {Paper, Table, TableBody, TableCell, TableContainer, TableRow, Tooltip, Typography} from "@material-ui/core";


interface StructureGraphProps {
    structure: Structure
    candidate: Candidate
}

export class StructureGraphComponent extends React.Component<StructureGraphProps, {}> {

    static readonly SOURCE = '-1'
    static readonly SINK = '-2'

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


                        const configuration = subConfigs.has(id) ? <>
                            <Typography color="inherit" component={'h4'}>Configuration</Typography>
                            <TableContainer component={Paper}>
                                <Table size="small">
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
                            </TableContainer>
                        </> : <Typography color="inherit" component={'h4'}>No Configuration</Typography>

                        return <g key={id}
                                  transform={`translate(${node.x - node.width / 2 + offset[0]}, ${node.y - node.height / 2 + offset[1]})`}>
                            <foreignObject
                                width={`${node.width}px`}
                                height={`${node.height}px`}
                                requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility">
                                <Tooltip title={configuration} placement={'left'}>
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
