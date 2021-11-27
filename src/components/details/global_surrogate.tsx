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
import {GraphEdge, GraphNode, HierarchicalTree} from "../tree_structure";
import Slider from "rc-slider";
import {ErrorIndicator} from "../../util/error";
import {KeyValue} from "../../util/KeyValue";
import {Dag} from "d3-dag";
import {AdditionalFeatureWarning} from "../../util/warning";
import {JupyterButton} from "../../util/jupyter-button";
import {JupyterContext} from "../../util";
import {ID} from "../../jupyter";


interface GlobalSurrogateProps {
    model: DetailsModel
}

interface GlobalSurrogateState {
    pendingRequest: CancelablePromise<DecisionTreeResult>
    data: DecisionTreeResult
    maxLeafNodes: number
    error: Error
}


export class GlobalSurrogateComponent extends React.Component<GlobalSurrogateProps, GlobalSurrogateState> {

    static HELP = 'Approximates the pipeline using a global surrogate model. The surrogate model is a decision tree ' +
        'that is trained to approximate the predictions of a black-box model. By adjusting the maximum number of ' +
        'leaves in the decision tree, the fidelity of the approximation can be weighted against the simplicity of the ' +
        'explanation.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    private static readonly NODE_HEIGHT = 56;
    private static readonly NODE_WIDTH = 100;

    private readonly ticks = [2, 3, 5, 7, 10, 15, 25, 50, 100]

    constructor(props: GlobalSurrogateProps) {
        super(props);
        this.state = {pendingRequest: undefined, data: undefined, maxLeafNodes: undefined, error: undefined}

        this.onMaxLeavesChange = this.onMaxLeavesChange.bind(this)
        this.exportTree = this.exportTree.bind(this)
    }

    componentDidMount() {
        this.queryDT(this.state.maxLeafNodes)
    }

    componentDidUpdate(prevProps: Readonly<GlobalSurrogateProps>, prevState: Readonly<GlobalSurrogateState>, snapshot?: any) {
        if (prevState.maxLeafNodes !== this.state.maxLeafNodes)
            this.queryDT(this.state.maxLeafNodes)
        if (prevProps.model.component !== this.props.model.component)
            this.queryDT(undefined)
    }

    private queryDT(maxLeafNodes: number) {
        if (this.state.pendingRequest !== undefined) {
            // Request for data is currently still pending. Cancel previous request.
            this.state.pendingRequest.cancel()
        }

        const {candidate, meta, component} = this.props.model
        if (component === undefined)
            return

        const promise = requestGlobalSurrogate(candidate.id, meta.data_file, meta.model_dir, component, maxLeafNodes)
        this.setState({pendingRequest: promise, data: undefined, error: undefined})

        promise
            .then(data => {
                this.setState({data: data, pendingRequest: undefined, maxLeafNodes: data.max_leaf_nodes})
            })
            .catch(error => {
                if (!(error instanceof CanceledPromiseError)) {
                    console.error(`Failed to fetch DecisionTreeResult data.\n${error.name}: ${error.message}`)
                    this.setState({error: error, pendingRequest: undefined})
                } else {
                    console.log('Cancelled promise due to user request')
                }
            });
    }

    private renderNodes(root: Dag<DecisionTreeNode>): JSX.Element {
        const renderedNodes = root.descendants().map(node =>
            <GraphNode key={node.data.label}
                       node={node}
                       nodeWidth={GlobalSurrogateComponent.NODE_WIDTH}
                       nodeHeight={GlobalSurrogateComponent.NODE_HEIGHT}>
                <p title={node.data.label}>{node.data.label}</p>
            </GraphNode>
        )
        const renderedEdges = root.links().map(link =>
            <GraphEdge key={link.source.data.label + '-' + link.target.data.label}
                       link={link}
                       label={link.target.data.label === link.source.data.children[0].label}
                       nodeWidth={GlobalSurrogateComponent.NODE_WIDTH}
                       nodeHeight={GlobalSurrogateComponent.NODE_HEIGHT}/>
        )
        return (
            <>
                {renderedEdges}
                {renderedNodes}
            </>
        )
    }

    private onMaxLeavesChange(idx: number) {
        this.setState({maxLeafNodes: this.ticks[idx]})
    }

    private exportTree() {
        const {meta, candidate, component} = this.props.model
        const {maxLeafNodes} = this.state

        this.context.createCell(`
from xautoml.util import io_utils, pipeline_utils
import pandas as pd

${ID}_X, ${ID}_y, ${ID}_feature_labels = io_utils.load_input_data('${meta.data_file}', framework='${meta.framework}')
${ID}_pipeline = io_utils.load_pipeline('${meta.model_dir}', '${candidate.id}', framework='${meta.framework}')
${ID}_pipeline, ${ID}_X, ${ID}_feature_labels, _ = pipeline_utils.get_subpipeline(${ID}_pipeline, '${component}', ${ID}_X, ${ID}_y, ${ID}_feature_labels)

${ID}_dt = pipeline_utils.fit_decision_tree(pd.DataFrame(${ID}_X, columns=${ID}_feature_labels).convert_dtypes(), ${ID}_pipeline.predict(${ID}_X), max_leaf_nodes=${maxLeafNodes})
${ID}_dt
        `.trim())
    }

    render() {
        const {data, pendingRequest, error} = this.state

        const marks: any = {}
        this.ticks.forEach((v, idx) => marks[idx] = v)

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error &&
                <>
                    <LoadingIndicator loading={!!pendingRequest}/>

                    {data?.root.children.length === 0 &&
                    <p>Decision Tree approximation not available for the actual predictions.</p>
                    }

                    {data?.root.children.length > 0 &&
                    <>
                        <div style={{display: 'flex'}}>
                            <div style={{flexGrow: 1}}>
                                <div
                                    style={{display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
                                    <KeyValue key_={'Fidelity'} value={data.fidelity}/>
                                    <KeyValue key_={'Leave Nodes'} value={data.n_leaves}/>
                                </div>
                            </div>
                            <div style={{padding: '0 10px 1em', flexGrow: 2}}>
                                <span>Max. Leaf Nodes</span>
                                <Slider min={0} max={this.ticks.length - 1}
                                        defaultValue={this.ticks.indexOf(data.max_leaf_nodes)}
                                        step={null} marks={marks}
                                        onAfterChange={this.onMaxLeavesChange}/>
                            </div>
                            <div style={{flexGrow: 1, alignSelf: "center"}}>
                                <JupyterButton style={{float: "right"}} onClickHandler={this.exportTree}/>
                            </div>
                        </div>
                        {data.additional_features && <AdditionalFeatureWarning/>}
                        <HierarchicalTree nodeHeight={GlobalSurrogateComponent.NODE_HEIGHT}
                                          nodeWidth={GlobalSurrogateComponent.NODE_WIDTH}
                                          data={data.root}
                                          render={this.renderNodes}/>
                    </>
                    }
                </>}
            </>
        )
    }

}
