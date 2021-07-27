import React from "react";
import * as d3 from "d3";
import {HierarchyNode, HierarchyPointNode, TreeLayout} from "d3";
import {Animate} from "react-move";
import {easeExpInOut} from "d3-ease";
import {CandidateId, Config, NodeDetails, Pipeline, StructureGraphNode} from "./model";
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

interface StructureGraphProps {
    data: StructureGraphNode;
    pipelines: Map<CandidateId, Pipeline>;
    configs: Map<CandidateId, Config[]>;
    selectedConfigs: CandidateId[];
    onConfigSelection?: (cid: CandidateId[]) => void;
}

interface StructureGraphState {
    nodes: CollapsibleHierarchyPointNode<StructureGraphNode>;
    source: CollapsibleHierarchyPointNode<StructureGraphNode>;
    sliderMarks: { [key: string]: string; };
    timestamp: string;
}

interface CollapsibleHierarchyNode<Datum> extends HierarchyNode<Datum> {
    _children?: this[];
}

interface CollapsibleHierarchyPointNode<Datum> extends HierarchyPointNode<Datum> {
    _children?: this[];
}

interface StructureGraphElementProps {
    source: CollapsibleHierarchyPointNode<StructureGraphNode>;
    node: CollapsibleHierarchyPointNode<StructureGraphNode>;
    timestamp: string;
    highlight: boolean;
    onClickHandler?: (d: CollapsibleHierarchyPointNode<StructureGraphNode>) => void;
    onDoubleClickHandler?: (d: CollapsibleHierarchyPointNode<StructureGraphNode>) => void;
}

const NODE_HEIGHT = 65;
const NODE_WIDTH = 190;

class GraphNode extends React.Component<StructureGraphElementProps, any> {

    constructor(props: StructureGraphElementProps) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
    }

    private handleClick() {
        if (this.props.onClickHandler) {
            this.props.onClickHandler(this.props.node);
        }
    }

    private handleDoubleClick() {
        if (this.props.onDoubleClickHandler) {
            this.props.onDoubleClickHandler(this.props.node);
        }
    }

    private determineState(details: NodeDetails) {
        if (this.props.highlight) {
            return 'selected selected-config'
        }

        const selected = details.selected ? 'selected' : ''

        if (!details.failure_message)
            return selected;
        if (details.failure_message.startsWith('Duplicate') || details.failure_message === 'Ineffective')
            return `${selected} node-duplicate`;
        if (details.failure_message === 'Unvisited')
            return `${selected} node-unvisited`;
        return 'node-crashed';
    }

    render() {
        const node = this.props.node;
        const parent = node.parent ? node.parent : this.props.source;
        const data = node.data;
        const details = data.getDetails(this.props.timestamp);

        const className = this.determineState(details);

        return (
            <Animate
                start={{x: parent.x, y: parent.y, opacity: 0, r: 1e-6}}
                update={{x: [node.x], y: [node.y], opacity: [1], r: [10], timing: {duration: 750, ease: easeExpInOut}}}
                enter={{x: [node.x], y: [node.y], opacity: [1], r: [10], timing: {duration: 750, ease: easeExpInOut}}}
            >{({x: x, y: y, opacity: opacity, r: r}) =>
                <g className={'node'} transform={`translate(${y},${x})`} onDoubleClick={this.handleDoubleClick}
                   onClick={this.handleClick}>
                    <foreignObject x={0} y={-NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT}>
                        <div className={`node-content ${className}`}>
                            <h3>{data.label} ({data.id})</h3>
                            <div className={'node-details'}>
                                <div>{details.failure_message ? details.failure_message : 'Reward: ' + (details.reward / details.visits).toFixed(3)}</div>
                                <div>Visits: {details.visits}</div>
                                {Array.from(details.policy.keys()).map(k =>
                                    <div key={k}>{`${k}: ${details.policy.get(k).toFixed(3)}`}</div>)
                                }
                            </div>
                        </div>
                    </foreignObject>
                </g>
            }
            </Animate>
        )
    }
}

class GraphEdge extends React.Component<StructureGraphElementProps, any> {

    constructor(props: StructureGraphElementProps) {
        super(props);
    }

    render() {
        const node = this.props.node;
        const parent = node.parent ? node.parent : this.props.source;
        const details = node.data.getDetails(this.props.timestamp);

        return (
            <Animate
                start={{
                    source: {x: parent.x, y: parent.y + NODE_WIDTH},
                    target: {x: parent.x, y: parent.y}
                }}
                update={{
                    source: {x: [parent.x], y: [parent.y + NODE_WIDTH]},
                    target: {x: [node.x], y: [node.y]},
                    timing: {duration: 750, ease: easeExpInOut}
                }}
                enter={{
                    source: {x: [parent.x], y: [parent.y + NODE_WIDTH]},
                    target: {x: [node.x], y: [node.y]},
                    timing: {duration: 750, ease: easeExpInOut}
                }}
            >{({source: source, target: target}) =>
                <path className={details.selected || this.props.highlight ? 'link selected' : 'link'} d={
                    d3.linkHorizontal().x(d => d[1]).y(d => d[0])({
                        source: [source.x, source.y],
                        target: [target.x, target.y]
                    })}/>
            }
            </Animate>
        )
    }
}

export class StructureGraphComponent extends React.Component<StructureGraphProps, StructureGraphState> {

    private readonly containerRef: React.RefObject<SVGSVGElement>;
    private readonly layout: TreeLayout<StructureGraphNode>;
    private readonly margin: number;
    private reversePipelines: Map<number, CandidateId[]>;

    static defaultProps = {
        onConfigSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: StructureGraphProps) {
        super(props);
        this.containerRef = React.createRef<SVGSVGElement>();
        this.margin = 20;
        this.layout = d3.tree<StructureGraphNode>().size([1, 1]);
        this.state = {nodes: undefined, source: undefined, sliderMarks: {}, timestamp: undefined};

        this.selectNode = this.selectNode.bind(this);
        this.toggleNode = this.toggleNode.bind(this);
        this.changeTimestamp = this.changeTimestamp.bind(this);
    }

    componentDidMount() {
        // Crude hack to actually wait for base container to be rendered in Jupyter
        window.setTimeout(() => {
            const nodes: CollapsibleHierarchyNode<StructureGraphNode> = d3.hierarchy(this.props.data, d => d.children);

            const detailsKeysSet = new Set<string>()
            nodes.descendants().map(d => Array.from(d.data.details.keys()).forEach(k => detailsKeysSet.add(k)));
            const detailsKeysArray = Array.from(detailsKeysSet).sort()
            const detailsKeys: { [key: string]: string; } = {}
            detailsKeysArray.forEach((k, idx) => detailsKeys[idx] = k)
            const timestamp = detailsKeysArray.slice(-1)[0]

            StructureGraphComponent.collapseAll(nodes, timestamp);

            const root = this.layout(nodes)
            this.adaptHeight(root)
            this.setState({
                nodes: root,
                source: root,
                sliderMarks: detailsKeys,
                timestamp: timestamp
            });
        }, 500)
    }

    componentDidUpdate(prevProps: Readonly<StructureGraphProps>, prevState: Readonly<StructureGraphState>, snapshot?: any) {
        if (prevProps.pipelines !== this.props.pipelines) {
            this.reversePipelines = new Map<number, CandidateId[]>();
            this.props.pipelines.forEach((v, k) => v.steps.map(v => Number.parseInt(v[0]))
                .forEach(step => {
                    if (this.reversePipelines.has(step))
                        this.reversePipelines.get(step).push(k)
                    else
                        this.reversePipelines.set(step, [k])
                })
            );
        }
    }

    private static collapseAll(d: CollapsibleHierarchyNode<StructureGraphNode>, key: string) {
        if (d.children) {
            d.children.forEach(d2 => this.collapseAll(d2, key))
            StructureGraphComponent.collapseNode(d, key)
        }
    }

    private static collapseNode(d: CollapsibleHierarchyNode<StructureGraphNode>, key: string) {
        const unvisited: CollapsibleHierarchyNode<StructureGraphNode>[] = [];
        const visited: CollapsibleHierarchyNode<StructureGraphNode>[] = [];
        // noinspection JSMismatchedCollectionQueryUpdate
        const hidden: CollapsibleHierarchyNode<StructureGraphNode>[] = [];

        d.children.forEach(child => {
            const details = child.data.getDetails(key)
            if (child.data.shouldDisplay(key)) {
                if (details.failure_message === 'Unvisited' && !details.selected)
                    unvisited.push(child);
                else
                    visited.push(child);
            } else
                hidden.push(child);
        })

        d._children = unvisited
        if (visited.length > 0)
            d.children = visited.sort((a, b) => a.data.label.localeCompare(b.data.label))
        else
            d.children = undefined
    }

    private selectNode(node: CollapsibleHierarchyPointNode<StructureGraphNode>) {
        const configs = this.reversePipelines.get(node.data.id)
            .map(id => this.props.configs.get(id))
            .reduce((acc, val) => acc.concat(val), [])
            .map(c => c.id);
        const intersection = configs.filter(c => this.props.selectedConfigs.includes(c));

        if (intersection.length === configs.length) {
            const tmp = this.props.selectedConfigs.filter(v => !configs.includes(v));
            this.props.onConfigSelection(tmp);
        } else {
            const tmp = [...this.props.selectedConfigs, ...configs.filter(v => !intersection.includes(v))];
            this.props.onConfigSelection(tmp);
        }
    }

    private toggleNode(node: CollapsibleHierarchyPointNode<StructureGraphNode>) {
        if (!node.children && !node._children) {
            // No children
            return;
        } else if (node._children?.length === 0) {
            // Node is expanded
            StructureGraphComponent.collapseNode(node, this.state.timestamp);
        } else {
            // Node is collapsed
            const children = node.children ? node.children.concat(node._children) : node._children;
            node.children = children.sort((a, b) => a.data.label.localeCompare(b.data.label))
            node._children = [];
        }
        const root = this.layout(this.state.nodes)
        this.adaptHeight(root)
        this.setState({nodes: root, source: node});
    }

    private changeTimestamp(v: number) {
        const timestamp = this.state.sliderMarks[v];

        const nodes: CollapsibleHierarchyNode<StructureGraphNode> = d3.hierarchy(this.props.data, d => d.children);
        StructureGraphComponent.collapseAll(nodes, timestamp);

        const root = this.layout(nodes)
        this.adaptHeight(root)
        this.setState({
            nodes: root,
            source: root,
            timestamp: timestamp
        });
    }

    private adaptHeight(root: CollapsibleHierarchyNode<StructureGraphNode>) {
        if (!root) {
            return 100;
        }

        const nodeCount = new Array<number>(Math.max(...root.descendants().map(d => d.depth)) + 1).fill(0);
        root.descendants().map(d => nodeCount[d.depth]++);
        const maxNodes = Math.max(...nodeCount);
        const newHeight = maxNodes * (1.5 * NODE_HEIGHT + this.margin) + 2 * this.margin;


        const currentHeight = this.containerRef.current ?
            Number.parseFloat(this.containerRef.current.getAttribute('height')) : 100;
        if (currentHeight > newHeight) {
            window.setTimeout(() => {
                this.containerRef.current?.setAttribute('height', newHeight.toString());
            }, 500);
        } else {
            this.containerRef.current?.setAttribute('height', newHeight.toString());
        }

        (root.descendants() as CollapsibleHierarchyPointNode<StructureGraphNode>[])
            .map(d => {
                d.y = d.depth * (NODE_WIDTH + 75);
                d.x = d.x * (newHeight - 2 * this.margin);
                return d;
            })
    }

    render() {
        const nodes = this.state.nodes ? (this.state.nodes.descendants() as CollapsibleHierarchyPointNode<StructureGraphNode>[]) : [];
        const nSteps = Object.keys(this.state.sliderMarks).length - 1;

        const highlightedNodes: number[] = this.props.selectedConfigs.map(cid => cid.substring(0, cid.indexOf(':', 4)))
            .map(sid => this.props.pipelines.get(sid).steps.map(v => Number.parseInt(v[0])))
            .reduce((acc, val) => acc.concat(val), [])

        return <>
            <svg className={'base-container'} ref={this.containerRef}>
                {this.state.nodes && <g transform={`translate(${this.margin},${this.margin})`}>
                    {nodes.map(d => <GraphEdge key={d.data.id} source={this.state.nodes} node={d}
                                               highlight={highlightedNodes.includes(d.data.id)}
                                               timestamp={this.state.timestamp}/>)}
                    {nodes.map(d => <GraphNode key={d.data.id} source={this.state.nodes} node={d}
                                               timestamp={this.state.timestamp}
                                               highlight={highlightedNodes.includes(d.data.id)}
                                               onClickHandler={this.selectNode}
                                               onDoubleClickHandler={this.toggleNode}/>)}
                </g>}
            </svg>
            <div style={{margin: '20px'}}>
                {/* Only display slider when actual data is already loaded*/}
                {nSteps > 0 && <Slider min={0} max={nSteps} marks={this.state.sliderMarks} defaultValue={nSteps}
                                       included={false} onAfterChange={this.changeTimestamp}/>}
            </div>
        </>
    }
}
