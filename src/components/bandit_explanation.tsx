import React from "react";
import * as d3 from "d3";
import {HierarchyNode, HierarchyPointNode, TreeLayout} from "d3";
import {Animate} from "react-move";
import {easeExpInOut} from "d3-ease";
import {BanditDetails, CandidateId, HierarchicalBandit, Pipeline, Structure} from "../model";
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import {normalizeComponent} from "../util";

interface CollapsibleNode<Datum> extends HierarchyNode<Datum> {
    _children?: this[];
}

interface CollapsiblePointNode<Datum> extends HierarchyPointNode<Datum> {
    _children?: this[];
}

const NODE_HEIGHT = 65;
const NODE_WIDTH = 190;


interface GraphElementProps {
    source: CollapsiblePointNode<HierarchicalBandit>;
    node: CollapsiblePointNode<HierarchicalBandit>;
    timestamp: string;
    highlight: boolean;
    onClickHandler?: (d: CollapsiblePointNode<HierarchicalBandit>) => void;
    onAlternativeClickHandler?: (d: CollapsiblePointNode<HierarchicalBandit>) => void;
}

class GraphNode extends React.Component<GraphElementProps, any> {

    constructor(props: GraphElementProps) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }

    private handleClick(e: React.MouseEvent) {
        if (e.ctrlKey && this.props.onAlternativeClickHandler) {
            this.props.onAlternativeClickHandler(this.props.node);
        } else if (this.props.onClickHandler) {
            this.props.onClickHandler(this.props.node);
        }
    }

    private determineState(details: BanditDetails) {
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
        return 'failed-config';
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
                <g className={'bandit-explanation_node'} transform={`translate(${y},${x})`}
                   onClick={this.handleClick}>
                    <foreignObject x={0} y={-NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT}>
                        <div className={`bandit-explanation_node-content ${className}`}>
                            <h3>{normalizeComponent(data.label)} ({data.id})</h3>
                            <div className={'bandit-explanation_node-details'}>
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

class GraphEdge extends React.Component<GraphElementProps, any> {

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
                <path
                    className={details.selected || this.props.highlight ? 'bandit-explanation_link bandit-explanation_selected' : 'bandit-explanation_link'}
                    d={
                        d3.linkHorizontal().x(d => d[1]).y(d => d[0])({
                            source: [source.x, source.y],
                            target: [target.x, target.y]
                        })}/>
            }
            </Animate>
        )
    }
}


interface BanditExplanationsProps {
    data: HierarchicalBandit;
    pipelines: Map<CandidateId, Pipeline>;
    structures: Structure[];
    selectedCandidates: Set<CandidateId>;
    onCandidateSelection?: (cid: Set<CandidateId>) => void;
}

interface BanditExplanationsState {
    nodes: CollapsiblePointNode<HierarchicalBandit>;
    source: CollapsiblePointNode<HierarchicalBandit>;
    sliderMarks: { [key: string]: string; };
    timestamp: string;
}

export class BanditExplanationsComponent extends React.Component<BanditExplanationsProps, BanditExplanationsState> {

    private readonly containerRef: React.RefObject<SVGSVGElement> = React.createRef<SVGSVGElement>();
    private readonly layout: TreeLayout<HierarchicalBandit> = d3.tree<HierarchicalBandit>().size([1, 1]);
    private readonly margin: number = 20;
    private reversePipelines: Map<number, CandidateId[]>;

    static defaultProps = {
        onCandidateSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: BanditExplanationsProps) {
        super(props);
        this.state = {nodes: undefined, source: undefined, sliderMarks: {}, timestamp: undefined};

        this.selectNode = this.selectNode.bind(this);
        this.toggleNode = this.toggleNode.bind(this);
        this.changeTimestamp = this.changeTimestamp.bind(this);
    }

    componentDidMount() {
        // Crude hack to actually wait for base container to be rendered in Jupyter
        window.setTimeout(() => {
            const nodes: CollapsibleNode<HierarchicalBandit> = d3.hierarchy(this.props.data, d => d.children);

            const detailsKeysSet = new Set<string>()
            nodes.descendants().map(d => Array.from(d.data.details.keys()).forEach(k => detailsKeysSet.add(k)));
            const detailsKeysArray = Array.from(detailsKeysSet).sort()
            const detailsKeys: { [key: string]: string; } = {}
            detailsKeysArray.forEach((k, idx) => detailsKeys[idx] = k)
            const timestamp = detailsKeysArray.slice(-1)[0]

            BanditExplanationsComponent.collapseAll(nodes, timestamp);

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

    componentDidUpdate(prevProps: Readonly<BanditExplanationsProps>, prevState: Readonly<BanditExplanationsState>, snapshot?: any) {
        if (this.reversePipelines === undefined || prevProps.pipelines.size !== this.props.pipelines.size) {
            this.reversePipelines = new Map<number, CandidateId[]>();
            this.reversePipelines.set(0, [])

            this.props.pipelines.forEach((v, k) => v.steps.map(v => Number.parseInt(v[0]))
                .forEach(step => {
                    if (this.reversePipelines.has(step))
                        this.reversePipelines.get(step).push(k)
                    else
                        this.reversePipelines.set(step, [k])

                    // Always add to root
                    this.reversePipelines.get(0).push(k)
                })
            );
        }
    }

    private static collapseAll(d: CollapsibleNode<HierarchicalBandit>, key: string) {
        if (d.children) {
            d.children.forEach(d2 => this.collapseAll(d2, key))
            BanditExplanationsComponent.collapseNode(d, key)
        }
    }

    private static collapseNode(d: CollapsibleNode<HierarchicalBandit>, key: string) {
        const unvisited: CollapsibleNode<HierarchicalBandit>[] = [];
        const visited: CollapsibleNode<HierarchicalBandit>[] = [];
        // noinspection JSMismatchedCollectionQueryUpdate
        const hidden: CollapsibleNode<HierarchicalBandit>[] = [];

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

    private selectNode(node: CollapsiblePointNode<HierarchicalBandit>) {
        const candidates = this.reversePipelines.get(node.data.id)
            .map(id => this.props.structures.filter(s => s.cid === id).pop().configs)
            .reduce((acc, val) => acc.concat(val), [])
            .map(c => c.id);
        const intersection = candidates.filter(c => this.props.selectedCandidates.has(c));

        if (intersection.length === candidates.length) {
            const tmp = Array.from(this.props.selectedCandidates.values()).filter(v => !candidates.includes(v));
            this.props.onCandidateSelection(new Set(tmp));
        } else {
            const tmp = [...this.props.selectedCandidates, ...candidates.filter(v => !intersection.includes(v))];
            this.props.onCandidateSelection(new Set(tmp));
        }
    }

    private toggleNode(node: CollapsiblePointNode<HierarchicalBandit>) {
        if (!node.children && !node._children) {
            // No children
            return;
        } else if (node._children?.length === 0) {
            // Node is expanded
            BanditExplanationsComponent.collapseNode(node, this.state.timestamp);
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

        const nodes: CollapsibleNode<HierarchicalBandit> = d3.hierarchy(this.props.data, d => d.children);
        BanditExplanationsComponent.collapseAll(nodes, timestamp);

        const root = this.layout(nodes)
        this.adaptHeight(root)
        this.setState({
            nodes: root,
            source: root,
            timestamp: timestamp
        });
    }

    private adaptHeight(root: CollapsibleNode<HierarchicalBandit>) {
        if (!root) {
            return 100;
        }

        const nodeCount = new Array<number>(Math.max(...root.descendants().map(d => d.depth)) + 1).fill(0);
        root.descendants().map(d => nodeCount[d.depth]++);
        const maxNodes = Math.max(...nodeCount);
        const newHeight = maxNodes * (1.1 * NODE_HEIGHT + this.margin) + 2 * this.margin;


        const currentHeight = this.containerRef.current ?
            Number.parseFloat(this.containerRef.current.getAttribute('height')) : 100;
        if (currentHeight > newHeight) {
            window.setTimeout(() => {
                this.containerRef.current?.setAttribute('height', newHeight.toString());
            }, 500);
        } else {
            this.containerRef.current?.setAttribute('height', newHeight.toString());
        }

        (root.descendants() as CollapsiblePointNode<HierarchicalBandit>[])
            .map(d => {
                d.y = d.depth * (NODE_WIDTH + 75);
                d.x = d.x * (newHeight - 2 * this.margin);
                return d;
            })
    }

    render() {
        const nodes = this.state.nodes ? (this.state.nodes.descendants() as CollapsiblePointNode<HierarchicalBandit>[]) : [];
        const nSteps = Object.keys(this.state.sliderMarks).length - 1;

        const highlightedNodes = new Set()
        this.props.selectedCandidates.forEach(cid => {
            const sid = cid.substring(0, cid.indexOf(':', 4))
            this.props.pipelines.get(sid).steps.map(v => Number.parseInt(v[0]))
                .forEach(n => highlightedNodes.add(n))
        })

        return <>
            <svg className={'bandit-explanation'} ref={this.containerRef}>
                {this.state.nodes && <g transform={`translate(${this.margin},${this.margin})`}>
                    {nodes.map(d => <GraphEdge key={d.data.id} source={this.state.nodes} node={d}
                                               highlight={highlightedNodes.has(d.data.id)}
                                               timestamp={this.state.timestamp}/>)}
                    {nodes.map(d => <GraphNode key={d.data.id} source={this.state.nodes} node={d}
                                               timestamp={this.state.timestamp}
                                               highlight={highlightedNodes.has(d.data.id)}
                                               onClickHandler={this.selectNode}
                                               onAlternativeClickHandler={this.toggleNode}/>)}
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
