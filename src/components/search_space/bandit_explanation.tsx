import React from "react";
import * as d3 from "d3";
import {CandidateId, Pipeline, RF, Structure} from "../../model";
import 'rc-slider/assets/index.css';
import {areSetInputsEqual, cidToSid, normalizeComponent, prettyPrint} from "../../util";
import AddIcon from "@material-ui/icons/Add";
import RemoveIcon from "@material-ui/icons/Remove";
import {GraphEdge, GraphNode, HierarchicalTree} from "../tree_structure";
import {Dag, DagNode} from "d3-dag";
import memoizeOne from "memoize-one";
import {KeyValue} from "../../util/KeyValue";
import {Collapse, IconButton} from "@material-ui/core";


interface CollapsibleNode {
    data?: RF.PolicyExplanations;
    children?: this[];
    _children?: this[];
    isExpandable?: boolean;
    parent?: this;
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
                if (details.isUnvisited() && !details.selected)
                    hidden.push(child);
                else
                    visible.push(child);
            })

        node._children = hidden
        node.isExpandable = hidden.length > 0
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

const NODE_HEIGHT = 70;
const NODE_WIDTH = 190;

interface SingleNodeProps {
    node: DagNode<CollapsibleNode>
    timestamp: string
    selected: boolean

    onToggleNode: (node: CollapsibleNode) => void
    onSelectNode: (node: CollapsibleNode) => void
}

interface SingleNodeState {
    show: boolean
}

class SingleNode extends React.Component<SingleNodeProps, SingleNodeState> {

    constructor(props: SingleNodeProps) {
        super(props);
        this.state = {show: false}

        this.toggleShow = this.toggleShow.bind(this)
        this.clickIcon = this.clickIcon.bind(this)
    }

    private toggleShow(_: any, e: React.MouseEvent) {
        this.setState((state) => ({show: !state.show}))
        e.stopPropagation()
    }

    private clickIcon(e: React.MouseEvent) {
        this.props.onToggleNode(this.props.node.data)
        e.stopPropagation()
    }

    render() {
        const {node, selected} = this.props

        const data = node.data.data
        const details = data.getDetails(this.props.timestamp)

        return (
            <GraphNode key={data.id}
                       node={node}
                       className={`bandit-explanation ${details.selected ? 'highlight' : ''} ${selected ? 'selected' : ''} ${details.isFailure() ? 'failure' : 'expandable'}`}
                       nodeWidth={NODE_WIDTH}
                       nodeHeight={NODE_HEIGHT}
                       onClick={this.toggleShow}
                       onAlternativeClick={this.props.onSelectNode}>
                <div>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                        <div style={{flexGrow: 1}}>
                            <h3 style={{lineHeight: '25px'}}>
                                {normalizeComponent(data.label)}: {details.isFailure() ? details.failure_message : prettyPrint(details.score)}
                            </h3>
                        </div>
                        {node.data.isExpandable &&
                            <IconButton style={{flexShrink: 1, maxHeight: '24px', padding: '0'}} size='small'
                                        onClick={this.clickIcon}>
                                {node.data._children?.length > 0 ? <AddIcon/> : <RemoveIcon/>}
                            </IconButton>
                        }
                    </div>

                    {!details.isFailure() &&
                        <Collapse in={this.state.show}>
                            <div className={'bandit-explanation_node-details'} style={{marginTop: "-5px"}}>
                                <KeyValue key_={'Id'} value={data.id} tight={true}/>

                                {Array.from(details.policy.keys()).map(k =>
                                    <KeyValue key={k} key_={k} value={details.policy.get(k)} tight={true}
                                              prec={2}/>
                                )}
                            </div>
                        </Collapse>
                    }
                </div>
            </GraphNode>
        )
    }
}

interface BanditExplanationsProps {
    explanations: RF.PolicyExplanations;
    structures: Structure[];

    selectedCandidates?: Set<CandidateId>;
    hideUnselectedCandidates?: boolean
    onCandidateSelection?: (cid: Set<CandidateId>) => void;

    timestamp: string
}

interface BanditExplanationsState {
    root: CollapsibleNode
    timestamp: string
}

export class BanditExplanationsComponent extends React.Component<BanditExplanationsProps, BanditExplanationsState> {

    static HELP = "Visualizes the search procedure of a Monte-Carlo tree search. Each node contains the current " +
        "reward computed by MCTS. Additional details how the score is computed is available via reward decomposition."

    static defaultProps = {
        selectedCandidates: new Set<CandidateId>(),
        hideUnselectedCandidates: false,
        onCandidateSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: BanditExplanationsProps) {
        super(props);

        // Create implicit copy of hierarchical data to prevent accidental modifications of children
        const root = d3.hierarchy(this.props.explanations, d => d.children)
        this.state = {root: root, timestamp: this.props.timestamp}

        CollapsibleNodeActions.collapseNode(this.state.root, this.props.timestamp, true)

        this.renderTree = this.renderTree.bind(this)
        this.selectNode = this.selectNode.bind(this)
        this.toggleNode = this.toggleNode.bind(this)
        this.getSelectedNodes = this.getSelectedNodes.bind(this)
    }

    static getDerivedStateFromProps(props: BanditExplanationsProps, state: BanditExplanationsState) {
        if (props.timestamp !== state.timestamp) {
            const root: CollapsibleNode = d3.hierarchy(props.explanations, d => d.children);
            CollapsibleNodeActions.collapseNode(root, props.timestamp, true)

            return {root: root, timestamp: props.timestamp}
        }
        return null
    }

    private selectNode(node: CollapsibleNode) {
        let nodesOnPath = []
        let current = node
        while (current) {
            nodesOnPath.push(current)
            current = current.parent
        }

        let structures = this.props.structures
        nodesOnPath.reverse()
            .slice(1) // Remove root node
            .map((node, idx) => {
                structures = structures.filter(structure => {
                    if (structure.pipeline.steps.length <= idx)
                        return false
                    return structure.pipeline.steps[idx].label === node.data.label
                })
            })

        const candidates: CandidateId[] = []
        structures
            .map(structure => structure.configs)
            .forEach(configs => configs.forEach(config => candidates.push(config.id)))

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
            CollapsibleNodeActions.collapseNode(node, this.props.timestamp)
        } else {
            CollapsibleNodeActions.expandNode(node)
        }

        this.setState({root: this.state.root});
    }

    renderNode(node: DagNode<CollapsibleNode>): JSX.Element {
        const data = node.data.data
        const selected = this.selectedNodes(this.props.selectedCandidates).has(data.id)

        return (
            <>
                {(!this.props.hideUnselectedCandidates || selected) &&
                    <SingleNode node={node} timestamp={this.props.timestamp} selected={selected}
                                onSelectNode={this.selectNode} onToggleNode={this.toggleNode}/>
                }
            </>
        )
    }

    private renderTree(root: Dag<CollapsibleNode>): JSX.Element {
        const renderedNodes = root.descendants().map(node => this.renderNode(node))
        const renderedEdges = root.links()
            .map(link => {
                const key = link.source.data.data.id + '-' + link.target.data.data.id

                const data = link.target.data.data
                const details = data.getDetails(this.props.timestamp)
                const highlight = this.selectedNodes(this.props.selectedCandidates).has(data.id)

                return (
                    <>
                        {(!this.props.hideUnselectedCandidates || highlight) &&
                            <GraphEdge key={key}
                                       link={link}
                                       nodeWidth={NODE_WIDTH}
                                       nodeHeight={NODE_HEIGHT}
                                       highlight={details.selected || highlight}/>
                        }
                    </>
                )
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
        const pipelines = new Map<CandidateId, Pipeline>(this.props.structures.map(s => [s.cid, s.pipeline]))
        const selectedNodes = new Set()


        selectedCandidates.forEach(cid => {
            const sid = cidToSid(cid)
            const root = this.state.root

            selectedNodes.add(root.data.id)

            let currentNode = root
            pipelines
                .get(sid).steps
                .forEach(step => currentNode.children
                    .filter(n => n.data.label === step.label)
                    .forEach(n => {
                        selectedNodes.add(n.data.id)
                        currentNode = n
                    })
                )
        })

        return selectedNodes
    }

    render() {
        return (
            <HierarchicalTree nodeHeight={NODE_HEIGHT}
                              nodeWidth={NODE_WIDTH}
                              data={this.state.root}
                              count={CollapsibleNodeActions.countNodes(this.state.root)}
                              render={this.renderTree}/>
        )
    }
}
