import React from "react";
import * as d3 from "d3";
import {BanditDetails, CandidateId, HierarchicalBandit, Pipeline, Structure} from "../model";
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import {normalizeComponent} from "../util";
import {CollapsibleNode, CollapsiblePointNode, GraphEdge, GraphNode, HierarchicalTree} from "./tree_structure";

const NODE_HEIGHT = 65;
const NODE_WIDTH = 190;

namespace CollapsibleNodeActions {

    export function collapseNode(node: CollapsibleNode<HierarchicalBandit>, key: string, recursive: boolean = false) {
        if (node.children === undefined)
            return
        if (recursive)
            node.children.forEach(child => collapseNode(child, key, recursive))

        const hidden: CollapsibleNode<HierarchicalBandit>[] = [];
        const visible: CollapsibleNode<HierarchicalBandit>[] = [];

        node.children
            .filter(child => child.data.shouldDisplay(key))
            .forEach(child => {
                const details = child.data.getDetails(key)
                if (details.failure_message === 'Unvisited' && !details.selected)
                    hidden.push(child);
                else
                    visible.push(child);
            })

        node._children = hidden
        if (visible.length > 0)
            node.children = visible.sort((a, b) => a.data.label.localeCompare(b.data.label))
        else
            node.children = undefined
    }

    export function expandNode(node: CollapsibleNode<HierarchicalBandit>) {
        const children = node.children ? node.children.concat(node._children) : node._children;
        node.children = children.sort((a, b) => a.data.label.localeCompare(b.data.label))
        node._children = [];
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
    root: CollapsibleNode<HierarchicalBandit>;
    sliderMarks: { [key: string]: string; };
    timestamp: string;
}

export class BanditExplanationsComponent extends React.Component<BanditExplanationsProps, BanditExplanationsState> {

    private reversePipelines: Map<number, CandidateId[]>;
    private selectedPipelines: Set<number>;

    static defaultProps = {
        onCandidateSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: BanditExplanationsProps) {
        super(props);
        this.state = {root: undefined, sliderMarks: {}, timestamp: undefined};

        this.renderNodes = this.renderNodes.bind(this);
        this.selectNode = this.selectNode.bind(this);
        this.toggleNode = this.toggleNode.bind(this);
        this.changeTimestamp = this.changeTimestamp.bind(this);

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

    componentDidMount() {
        const root: CollapsibleNode<HierarchicalBandit> = d3.hierarchy(this.props.data, d => d.children);

        const detailsKeysSet = new Set<string>()
        root.descendants().map(d => Array.from(d.data.details.keys()).forEach(k => detailsKeysSet.add(k)));
        const detailsKeysArray = Array.from(detailsKeysSet).sort()
        const detailsKeys: { [key: string]: string; } = {}
        detailsKeysArray.forEach((k, idx) => detailsKeys[idx] = k)
        const timestamp = detailsKeysArray.slice(-1)[0]

        CollapsibleNodeActions.collapseNode(root, timestamp, true)

        this.setState({
            root: root,
            sliderMarks: detailsKeys,
            timestamp: timestamp
        });
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
            CollapsibleNodeActions.collapseNode(node, this.state.timestamp)
        } else {
            CollapsibleNodeActions.expandNode(node)
        }

        this.setState({root: this.state.root});
    }

    private changeTimestamp(v: number) {
        const timestamp = this.state.sliderMarks[v];

        const root: CollapsibleNode<HierarchicalBandit> = d3.hierarchy(this.props.data, d => d.children);
        CollapsibleNodeActions.collapseNode(root, timestamp, true)

        this.setState({root: root, timestamp: timestamp});
    }

    private static determineNodeClass(details: BanditDetails, highlight: boolean) {
        if (highlight) {
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

    renderNode(node: CollapsiblePointNode<HierarchicalBandit>): [JSX.Element, JSX.Element] {
        const details = node.data.getDetails(this.state.timestamp)
        const highlight = this.selectedPipelines.has(node.data.id)

        const edgeClass = details.selected || highlight ? 'bandit-explanation_selected' : ''
        const renderedEdge = <GraphEdge key={node.data.id}
                                        node={node}
                                        nodeWidth={NODE_WIDTH} nodeHeight={NODE_HEIGHT}
                                        className={edgeClass}/>

        const data = node.data;
        const nodeClass = BanditExplanationsComponent.determineNodeClass(details, highlight)
        const renderedNode =
            <GraphNode key={node.data.id}
                       node={node}
                       className={`bandit-explanation ${nodeClass}`}
                       nodeWidth={NODE_WIDTH} nodeHeight={NODE_HEIGHT}
                       onClickHandler={this.selectNode}
                       onAlternativeClickHandler={this.toggleNode}>
                <>
                    <h3>{normalizeComponent(data.label)} ({data.id})</h3>
                    <div className={'bandit-explanation_node-details'}>
                        <div>{details.failure_message ? details.failure_message : 'Reward: ' + (details.reward / details.visits).toFixed(3)}</div>
                        <div>Visits: {details.visits}</div>
                        {Array.from(details.policy.keys()).map(k =>
                            <div key={k}>{`${k}: ${details.policy.get(k).toFixed(3)}`}</div>)
                        }
                    </div>
                </>
            </GraphNode>

        return [renderedNode, renderedEdge]
    }

    private renderNodes(root: CollapsiblePointNode<HierarchicalBandit>): JSX.Element {
        const renderedEdges: JSX.Element[] = []
        const renderedNodes: JSX.Element[] = []

        root.descendants().forEach(node => {
            const [renderedNode, renderedEdge] = this.renderNode(node)
            renderedEdges.push(renderedEdge)
            renderedNodes.push(renderedNode)
        })

        return (
            <>
                {renderedEdges}
                {renderedNodes}
            </>
        )
    }

    render() {
        const nSteps = Object.keys(this.state.sliderMarks).length - 1;

        // TODO https://reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html#what-about-memoization
        this.selectedPipelines = new Set()
        this.props.selectedCandidates.forEach(cid => {
            const sid = cid.substring(0, cid.indexOf(':', 4))
            this.props.pipelines.get(sid).steps.map(v => Number.parseInt(v[0]))
                .forEach(n => this.selectedPipelines.add(n))
        })

        return <>
            <HierarchicalTree nodeHeight={NODE_HEIGHT}
                              nodeWidth={NODE_WIDTH}
                              data={this.state.root}
                              render={this.renderNodes}/>
            <div style={{margin: '20px'}}>
                {/* Only display slider when actual data is already loaded*/}
                {nSteps > 0 && <Slider min={0} max={nSteps} marks={this.state.sliderMarks} defaultValue={nSteps}
                                       included={false} onAfterChange={this.changeTimestamp}/>}
            </div>
        </>
    }
}
