import React from "react";
import {DetailsModel} from "./model";
import {DecisionTreeNode, DecisionTreeResult, GlobalSurrogateResult} from "../../dao";
import {LoadingIndicator} from "../../util/loading";
import {GraphEdge, GraphNode, HierarchicalTree} from "../../util/tree_structure";
import Slider from "rc-slider";
import {ErrorIndicator} from "../../util/error";
import {KeyValue} from "../../util/KeyValue";
import {Dag} from "d3-dag";
import {CommonWarnings} from "../../util/warning";
import {JupyterButton} from "../../util/jupyter-button";
import {Colors, JupyterContext, prettyPrint} from "../../util";
import {ID} from "../../jupyter";


interface GlobalSurrogateProps {
    model: DetailsModel

    dtIndex?: number
    onDTIndexChange?: (dtIndex: number) => void
}

interface GlobalSurrogateState {
    loading: boolean
    data: GlobalSurrogateResult
    dt: DecisionTreeResult
    error: Error
}


export class GlobalSurrogateComponent extends React.Component<GlobalSurrogateProps, GlobalSurrogateState> {

    static readonly HELP = 'Approximates the pipeline using a global surrogate model. The surrogate model is a ' +
        'decision tree that is trained to approximate the predictions of a black-box model. By adjusting the maximum ' +
        'number of leaves in the decision tree, the fidelity of the surrogate can be weighted against the ' +
        'simplicity of the explanation.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    private static readonly NODE_HEIGHT = 56;
    private static readonly NODE_WIDTH = 100;

    private readonly ticks = [2, 3, 5, 7, 10, 15, 25, 50, 100]

    constructor(props: GlobalSurrogateProps) {
        super(props);
        this.state = {loading: true, data: undefined, dt: undefined, error: undefined}

        this.onMaxLeavesChange = this.onMaxLeavesChange.bind(this)
        this.exportTree = this.exportTree.bind(this)
        this.renderNodes = this.renderNodes.bind(this)
    }

    componentDidMount() {
        this.queryDT()
    }

    componentDidUpdate(prevProps: Readonly<GlobalSurrogateProps>, prevState: Readonly<GlobalSurrogateState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component)
            this.queryDT()

        if (prevProps.dtIndex !== this.props.dtIndex) {
            const dt = this.state.data.candidates[this.props.dtIndex]
            this.setState({dt: dt})
        }
    }

    private queryDT() {
        const {candidate, component} = this.props.model
        if (component === undefined)
            return

        const promise = this.context.requestGlobalSurrogate(candidate.id, component)
        this.setState({loading: true})

        promise
            .then(data => {
                const idx = this.props.dtIndex !== undefined ? this.props.dtIndex : data.best
                const dt = data.candidates[idx]
                this.setState({data: data, dt: dt, loading: false})
            })
            .catch(error => {
                console.error(`Failed to fetch DecisionTreeResult data.\n${error.name}: ${error.message}`)
                this.setState({error: error, loading: false})
            });
    }

    private renderNodes(root: Dag<DecisionTreeNode>): JSX.Element {
        const {additional_features} = this.state.data

        const renderedNodes = root.descendants().map(node =>
            <GraphNode node={node}
                       className={`global-surrogate_node ${
                           additional_features.filter(a => node.data.label.startsWith(a))
                               .length > 0 ? 'global-surrogate_additional-feature' : ''}`}
                       nodeWidth={GlobalSurrogateComponent.NODE_WIDTH}
                       nodeHeight={GlobalSurrogateComponent.NODE_HEIGHT}>
                <p title={node.data.label}>{node.data.label}</p>
                <KeyValue key_={'Impurity'} value={node.data.impurity}/>
            </GraphNode>
        )
        const renderedEdges = root.links().map(link => {
                const edgeLabel = link.source.data.child_labels[
                    link.source.data.children.map(l => `${l.label}-${l.impurity}`)
                        .indexOf(`${link.target.data.label}-${link.target.data.impurity}`)
                    ]
                return <GraphEdge link={link} label={edgeLabel}
                                  nodeWidth={GlobalSurrogateComponent.NODE_WIDTH}
                                  nodeHeight={GlobalSurrogateComponent.NODE_HEIGHT}/>
            }
        )
        return (
            <>
                {renderedEdges}
                {renderedNodes}
            </>
        )
    }

    private onMaxLeavesChange(idx: number) {
        this.setState({dt: this.state.data.candidates[idx]})
        if (this.props.onDTIndexChange !== undefined)
            this.props.onDTIndexChange(idx)
    }

    private exportTree() {
        const {candidate, component} = this.props.model
        const {dt} = this.state

        this.context.createCell(`
${ID}_dt = gcx().global_surrogate('${candidate.id}', '${component}', ${dt.max_leaf_nodes})
${ID}_dt
        `.trim())
    }

    render() {
        const {data, dt, loading, error} = this.state

        const marks: any = {}
        this.ticks.forEach((v, idx) => marks[idx] = v)

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error && <>
                    {data === undefined && <LoadingIndicator loading={true}/>}

                    {dt?.root && <>
                        <div style={{display: 'flex'}}>
                            <div style={{flexGrow: 1}}>
                                <div style={{
                                    display: "flex", flexDirection: "column", justifyContent: "space-between"
                                }}>
                                    <KeyValue key_={'Fidelity'} value={
                                        <div style={{
                                            backgroundColor: Colors.DEFAULT,
                                            borderRadius: '5px',
                                            marginLeft: '10px',
                                            padding: '1px',
                                            height: '16px',
                                            width: '200px',
                                            display: 'inline-block'
                                        }}>
                                            <div
                                                style={{
                                                    width: `${dt.fidelity * 100}%`,
                                                    height: '100%',
                                                    backgroundColor: dt.fidelity < 0.9 ? 'red' : Colors.HIGHLIGHT,
                                                    textAlign: 'center'
                                                }}>{prettyPrint(dt.fidelity)}</div>
                                        </div>
                                    }
                                              help={'Measure how good the surrogate represents the real model. ' +
                                                  'A value of 1 means that the surrogate perfectly resembles the ' +
                                                  'model, a value below 0.9 indicates that the model is no good ' +
                                                  'surrogate and the number of nodes should be increased.'}/>
                                    <KeyValue key_={'Leave Nodes'} value={dt.n_leaves}/>
                                </div>
                            </div>
                            <div style={{padding: '0 10px 1em', flexGrow: 2}}>
                                <span>Max. Leaf Nodes</span>
                                <Slider min={0} max={this.ticks.length - 1}
                                        defaultValue={this.ticks.indexOf(dt.max_leaf_nodes)}
                                        step={null} marks={marks}
                                        onChange={this.onMaxLeavesChange}/>
                            </div>
                            <div style={{flexGrow: 1, alignSelf: "center"}}>
                                <JupyterButton style={{float: "right"}} onClick={this.exportTree}/>
                            </div>
                        </div>
                        {loading ? <LoadingIndicator loading={loading}/> :
                            <>
                                <CommonWarnings additionalFeatures={data.additional_features.length > 0}/>
                                <HierarchicalTree nodeHeight={GlobalSurrogateComponent.NODE_HEIGHT}
                                                  nodeWidth={GlobalSurrogateComponent.NODE_WIDTH}
                                                  data={dt.root}
                                                  count={dt.max_leaf_nodes} // Force recalculation of tree
                                                  render={this.renderNodes}/>
                            </>
                        }
                    </>
                    }
                </>}
            </>
        )
    }

}
