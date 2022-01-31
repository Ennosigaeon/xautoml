import React from "react";
import {CandidateId, PipelineStep} from "../../model";
import 'rc-slider/assets/index.css';
import {Components, JupyterContext} from "../../util";
import {GraphEdge, GraphNode, HierarchicalTree} from "../../util/tree_structure";
import {Dag, DagNode} from "d3-dag";
import {PipelineHistory} from "../../dao";
import {LoadingIndicator} from "../../util/loading";
import {ErrorIndicator} from "../../util/error";
import SOURCE = Components.SOURCE;


const NODE_HEIGHT = 36;
const NODE_WIDTH = 130;

interface SingleNodeProps {
    node: DagNode<PipelineStep>
    selected: boolean
    highlight: boolean

    onSelectNode: (node: PipelineStep) => void
}

interface SingleNodeState {
    show: boolean
}

class SingleNode extends React.Component<SingleNodeProps, SingleNodeState> {

    constructor(props: SingleNodeProps) {
        super(props);
        this.state = {show: false}

        this.toggleShow = this.toggleShow.bind(this)
    }

    private toggleShow(_: any, e: React.MouseEvent) {
        this.setState((state) => ({show: !state.show}))
        e.stopPropagation()
    }

    render() {
        const {node, selected, highlight} = this.props

        const data = node.data

        return (
            <GraphNode key={data.id}
                       node={node}
                       className={`structure-graph_node ${selected ? 'selected ' : ''}` +
                           `${highlight ? 'highlight ' : ''}` +
                           `${data.splitter ? 'hierarchical-tree_node-content-splitter ' : ''}` +
                           `${data.merger ? 'hierarchical-tree_node-content-merger ' : ''}`}
                       nodeWidth={NODE_WIDTH}
                       virtual={data.label === SOURCE}
                       nodeHeight={NODE_HEIGHT}
                       onClick={this.props.onSelectNode}
                       onAlternativeClick={this.toggleShow}>
                <div>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                        <div style={{flexGrow: 1}}>
                            <p>{data.label !== SOURCE && data.label.substring(0, 20)}</p>
                        </div>
                    </div>
                </div>
            </GraphNode>
        )
    }
}

interface StructureSearchGraphProps {
    timestamp: number

    selectedCandidates?: Set<CandidateId>;
    hideUnselectedCandidates?: boolean
    onCandidateSelection?: (cid: Set<CandidateId>) => void;
}

interface StructureSearchGraphState {
    data: PipelineHistory
    error: Error
}

export class StructureSearchGraph extends React.Component<StructureSearchGraphProps, StructureSearchGraphState> {

    static readonly HELP = "Visualizes the underlying search procedure for pipeline structures. Highlighted in " +
        "light-blue is the latest selected pipeline. You can select pipelines by clicking on any node."

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    static defaultProps = {
        selectedCandidates: new Set<CandidateId>(),
        hideUnselectedCandidates: false,
        onCandidateSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: StructureSearchGraphProps) {
        super(props);
        this.state = {data: undefined, error: undefined}

        this.renderTree = this.renderTree.bind(this)
        this.selectNode = this.selectNode.bind(this)
    }

    componentDidMount() {
        this.context.requestPipelineHistory()
            .then(data => this.setState({data: data}))
            .catch(error => {
                console.error(`Failed to fetch pipeline history.\n${error.name}: ${error.message}`);
                this.setState({error: error})
            })
    }

    private selectNode(node: PipelineStep) {
        const candidates: CandidateId[] = node.cids
        const intersection = candidates.filter(c => this.props.selectedCandidates.has(c));

        if (intersection.length === candidates.length) {
            const tmp = Array.from(this.props.selectedCandidates.values()).filter(v => !candidates.includes(v));
            this.props.onCandidateSelection(new Set(tmp));
        } else {
            const tmp = [...this.props.selectedCandidates, ...candidates];
            this.props.onCandidateSelection(new Set(tmp));
        }
    }

    private renderTree(root: Dag<PipelineStep>): JSX.Element {
        const {selectedCandidates} = this.props
        const currentSteps = new Set(this.state.data.individual[this.props.timestamp].map(s => s.id))

        const renderedNodes = root.descendants().map(node => {
            const highlight = currentSteps.has(node.data.id)
            const selected = node.data.isSelected(selectedCandidates)

            return <SingleNode key={node.data.id} node={node} highlight={highlight} selected={selected}
                               onSelectNode={this.selectNode}/>
        })
        const renderedEdges = root.links()
            .map(link => {
                const key = link.source.data.id + '-' + link.target.data.id

                const label = link.target.data.getLabel(link.source.data.id)
                const highlight = (currentSteps.has(link.source.data.id) && currentSteps.has(link.target.data.id)) ||
                    (link.source.data.isSelected(selectedCandidates) && link.target.data.isSelected(selectedCandidates))

                let startOffset = 0
                if (link.source.data.splitter && link.source.children().length > 1) {
                    const idx = link.source.children()
                        .sort((a, b) => a.x - b.x)
                        .findIndex(v => v.data.id === link.target.data.id)
                    startOffset = idx === 0 ? -NODE_HEIGHT / 8 : NODE_HEIGHT / 8
                }

                return (
                    <>
                        {(!this.props.hideUnselectedCandidates || highlight) &&
                            <GraphEdge key={key}
                                       link={link}
                                       label={label}
                                       startOffset={startOffset}
                                       nodeWidth={link.source.data.label === SOURCE ? NODE_HEIGHT : NODE_WIDTH}
                                       nodeHeight={NODE_HEIGHT}
                                       highlight={highlight}/>
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

    render() {
        const {timestamp} = this.props
        const {data, error} = this.state

        return (
            <>
                <LoadingIndicator loading={data === undefined && error === undefined}/>
                <ErrorIndicator error={error}/>
                {data !== undefined && <HierarchicalTree nodeHeight={NODE_HEIGHT}
                                                         nodeWidth={NODE_WIDTH}
                                                         data={data.merged[timestamp]}
                                                         count={data.merged[timestamp].length}
                                                         render={this.renderTree}/>
                }
            </>
        )
    }
}
