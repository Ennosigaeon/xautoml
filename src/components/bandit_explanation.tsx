import React from "react";
import * as d3 from "d3";
import {BanditDetails, CandidateId, HierarchicalBandit, Pipeline, Structure} from "../model";
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import {areSetInputsEqual, fixedPrec, normalizeComponent} from "../util";
import {GraphEdge, GraphNode, HierarchicalTree} from "./tree_structure";
import {Dag, DagNode} from "d3-dag";
import memoizeOne from "memoize-one";
import {CollapseComp} from "../util/collapse";
import {KeyValue} from "../util/KeyValue";


interface CollapsibleNode {
    data?: HierarchicalBandit;
    children?: this[];
    _children?: this[];
}

namespace CollapsibleNodeActions {

    export function collapseNode(node: CollapsibleNode, key: string, recursive: boolean = false) {
        if (node.children === undefined)
            return
        if (recursive)
            node.children.forEach(child => collapseNode(child, key, recursive))

        const hidden: CollapsibleNode[] = [];
        const visible: CollapsibleNode[] = [];

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

    export function expandNode(node: CollapsibleNode) {
        const children = node.children ? node.children.concat(node._children) : node._children;
        node.children = children.sort((a, b) => a.data.label.localeCompare(b.data.label))
        node._children = [];
    }

    export function countNodes(node: CollapsibleNode): number {
        if (!node || !node.children)
            return 1
        return node.children.map(child => countNodes(child)).reduce((a, b) => a + b, 1)
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
    root: CollapsibleNode;
    sliderMarks: { [key: string]: string; };
    timestamp: string;
}

export class BanditExplanationsComponent extends React.Component<BanditExplanationsProps, BanditExplanationsState> {

    private static readonly NODE_HEIGHT = 87;
    private static readonly NODE_WIDTH = 190;

    static defaultProps = {
        onCandidateSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: BanditExplanationsProps) {
        super(props);
        this.state = {root: undefined, sliderMarks: {}, timestamp: undefined};

        this.renderNodes = this.renderNodes.bind(this)
        this.selectNode = this.selectNode.bind(this)
        this.toggleNode = this.toggleNode.bind(this)
        this.changeTimestamp = this.changeTimestamp.bind(this)
        this.getSelectedNodes = this.getSelectedNodes.bind(this)
    }

    componentDidMount() {
        const root = d3.hierarchy(this.props.data, d => d.children);

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

    private selectNode(node: CollapsibleNode) {
        const reversePipelines = new Map<number, CandidateId[]>();
        reversePipelines.set(0, [])
        this.props.pipelines.forEach((v, k) => v.steps
            .map(v => Number.parseInt(v[0]))
            .forEach(step => {
                if (reversePipelines.has(step))
                    reversePipelines.get(step).push(k)
                else
                    reversePipelines.set(step, [k])

                // Always add to root
                reversePipelines.get(0).push(k)
            })
        );

        const candidates = reversePipelines.get(node.data.id)
            .map(id => this.props.structures.filter(s => s.cid === id).pop().configs)
            .reduce((acc, val) => acc.concat(val), [])
            .map(c => c.id);
        const intersection = candidates.filter(c => this.props.selectedCandidates.has(c));

        if (intersection.length === candidates.length) {
            const tmp = Array.from(this.props.selectedCandidates.values()).filter(v => !candidates.includes(v));
            this.props.onCandidateSelection(new Set(tmp));
        } else {
            const tmp = [...this.props.selectedCandidates, ...candidates];
            this.props.onCandidateSelection(new Set(tmp));
        }
    }

    private toggleNode(node: CollapsibleNode) {
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

        // Convert props data to CollapsibleNodes
        const root: CollapsibleNode = d3.hierarchy(this.props.data, d => d.children);
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

    renderNode(node: DagNode<CollapsibleNode>): JSX.Element {
        const data: HierarchicalBandit = node.data.data
        const details = data.getDetails(this.state.timestamp)
        const highlight = this.selectedNodes(this.props.selectedCandidates).has(data.id)

        const nodeClass = BanditExplanationsComponent.determineNodeClass(details, highlight)
        return (
            <GraphNode key={data.id}
                       node={node}
                       className={`bandit-explanation ${nodeClass}`}
                       nodeWidth={BanditExplanationsComponent.NODE_WIDTH}
                       nodeHeight={BanditExplanationsComponent.NODE_HEIGHT}
                       onClickHandler={this.selectNode}
                       onAlternativeClickHandler={this.toggleNode}>
                <>
                    <CollapseComp showInitial={false} className={''}>
                        <h3>{normalizeComponent(data.label)}: {fixedPrec(details.score)}</h3>
                        <div className={'bandit-explanation_node-details'} style={{marginTop: "-10px"}}>
                            <KeyValue key_={'Id'} value={data.id} tight={true}/>
                            {details.failure_message &&
                            <KeyValue key_={'Reason'} value={details.failure_message} tight={true}/>}

                            {Array.from(details.policy.keys()).map(k =>
                                <KeyValue key={k} key_={k} value={fixedPrec(details.policy.get(k))} tight={true}/>
                            )}
                        </div>
                    </CollapseComp>
                </>
            </GraphNode>
        )
    }

    private renderNodes(root: Dag<CollapsibleNode>): JSX.Element {
        const renderedNodes = root.descendants().map(node => this.renderNode(node))
        const renderedEdges = root.links()
            .map(link => {
                const key = link.source.data.data.id + '-' + link.target.data.data.id

                const data: HierarchicalBandit = link.target.data.data
                const details = data.getDetails(this.state.timestamp)
                const highlight = this.selectedNodes(this.props.selectedCandidates).has(data.id)

                return <GraphEdge key={key}
                                  link={link}
                                  nodeWidth={BanditExplanationsComponent.NODE_WIDTH}
                                  nodeHeight={BanditExplanationsComponent.NODE_HEIGHT}
                                  highlight={details.selected || highlight}/>
            })

        return (
            <>
                {renderedEdges}
                {renderedNodes}
            </>
        )
    }

    private selectedNodes = memoizeOne(this.getSelectedNodes, areSetInputsEqual)

    private getSelectedNodes(selectedCandidates: Set<CandidateId>) {
        console.log('Calculating highlights')
        const selectedPipelines = new Set()
        selectedCandidates.forEach(cid => {
            const sid = cid.substring(0, cid.indexOf(':', 4))
            this.props.pipelines
                .get(sid).steps
                .map(([id, _]) => selectedPipelines.add(Number.parseInt(id)))
        })
        return selectedPipelines
    }

    render() {
        const nSteps = Object.keys(this.state.sliderMarks).length - 1;

        return <>
            <HierarchicalTree nodeHeight={BanditExplanationsComponent.NODE_HEIGHT}
                              nodeWidth={BanditExplanationsComponent.NODE_WIDTH}
                              data={this.state.root}
                              count={CollapsibleNodeActions.countNodes(this.state.root)}
                              render={this.renderNodes}/>
            <div style={{margin: '20px'}}>
                {/* Only display slider when actual data is already loaded*/}
                {nSteps > 0 && <Slider min={0} max={nSteps} marks={this.state.sliderMarks} defaultValue={nSteps}
                                       included={false} onAfterChange={this.changeTimestamp}/>}
            </div>
        </>
    }
}
