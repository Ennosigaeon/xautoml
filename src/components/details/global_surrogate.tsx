import React from "react";
import {DetailsModel} from "./model";
import {
    CancelablePromise,
    CanceledPromiseError,
    DecisionTreeNode,
    DecisionTreeResult,
    requestGlobalSurrogate
} from "../../handler";
import {LoadingIndicator} from "../loading";
import * as d3 from "d3";
import {CollapsiblePointNode, GraphEdge, GraphNode, HierarchicalTree} from "../tree_structure";
import {fixedPrec} from "../../util";
import Slider from "rc-slider";


const NODE_HEIGHT = 45;
const NODE_WIDTH = 100;

interface GlobalSurrogateProps {
    model: DetailsModel
}

interface GlobalSurrogateState {
    pendingRequest: CancelablePromise<DecisionTreeResult>
    data: DecisionTreeResult
    maxLeaves: number
}


export class GlobalSurrogateComponent extends React.Component<GlobalSurrogateProps, GlobalSurrogateState> {

    private readonly ticks = [2, 3, 5, 7, 10, 15, 25, 50, 100]

    constructor(props: GlobalSurrogateProps) {
        super(props);
        this.state = {pendingRequest: undefined, data: undefined, maxLeaves: 10}

        this.onMaxLeavesChange = this.onMaxLeavesChange.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<GlobalSurrogateProps>, prevState: Readonly<GlobalSurrogateState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component ||
            prevState.maxLeaves !== this.state.maxLeaves)
            this.queryDT()
    }

    private queryDT() {
        if (this.state.pendingRequest !== undefined) {
            // Request for data is currently still pending. Cancel previous request.
            this.state.pendingRequest.cancel()
        }

        const {candidate, meta, component} = this.props.model
        if (component === undefined)
            return

        const promise = requestGlobalSurrogate(candidate.id, meta.data_file, meta.model_dir, component, this.state.maxLeaves)
        this.setState({pendingRequest: promise, data: undefined})

        promise
            .then(data => {
                this.setState({data: data, pendingRequest: undefined})
            })
            .catch(reason => {
                if (!(reason instanceof CanceledPromiseError)) {
                    // TODO handle error
                    console.error(`Failed to fetch DecisionTreeResult data.\n${reason}`)
                    this.setState({pendingRequest: undefined})
                } else {
                    console.log('Cancelled promise due to user request')
                }
            });
    }

    private renderNodes(root: CollapsiblePointNode<DecisionTreeNode>): JSX.Element {
        const renderedEdges: JSX.Element[] = []
        const renderedNodes: JSX.Element[] = []

        root.descendants().forEach(node => {
            renderedNodes.push(
                <GraphNode key={node.data.label} node={node} nodeWidth={NODE_WIDTH} nodeHeight={NODE_HEIGHT}>
                    <p>{node.data.label}</p>
                </GraphNode>
            )

            renderedEdges.push(
                <GraphEdge key={node.data.label} node={node} nodeWidth={NODE_WIDTH} nodeHeight={NODE_HEIGHT}/>
            )
        })

        return (
            <>
                {renderedEdges}
                {renderedNodes}
            </>
        )
    }

    onMaxLeavesChange(idx: number) {
        this.setState({maxLeaves: this.ticks[idx]})
    }

    render() {
        const {data, pendingRequest, maxLeaves} = this.state

        const marks: any = {}
        this.ticks.forEach((v, idx) => marks[idx] = v)

        return (
            <>
                <div style={{display: 'flex'}}>
                    <div style={{flexGrow: 1}}>
                        <h4>Global Approximation</h4>
                    </div>
                    <div style={{padding: '10px', flexGrow: 2}}>
                        <span>Max. Leaf Nodes</span>
                        <Slider min={0} max={this.ticks.length - 1}
                                defaultValue={this.ticks.indexOf(maxLeaves)}
                                step={null} marks={marks}
                                onAfterChange={this.onMaxLeavesChange}/>
                    </div>
                </div>
                <LoadingIndicator loading={!!pendingRequest}/>

                {data?.root.children.length === 0 &&
                <p>Decision Tree approximation not available for the actual predictions.</p>
                }

                {data?.root.children.length > 0 &&
                <>
                    <p><strong>Fidelity:</strong> {fixedPrec(data.fidelity)}</p>
                    <p><strong>Leave Nodes:</strong> {data.n_leaves}</p>
                    <HierarchicalTree nodeHeight={NODE_HEIGHT}
                                      nodeWidth={NODE_WIDTH}
                                      data={d3.hierarchy(data.root, d => d.children)}
                                      render={this.renderNodes}/>
                </>

                }
            </>
        )
    }

}
