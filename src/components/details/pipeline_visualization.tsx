import React from "react";
import {Candidate, Pipeline, PipelineStep} from "../../model";
import {Components, JupyterContext} from "../../util";
import {OutputDescriptionData} from "../../dao";
import {GraphEdge, GraphNode, HierarchicalTree} from "../../util/tree_structure";
import {Dag} from "d3-dag";
import isPipEnd = Components.isPipEnd;

interface SingleComponentProps {
    step: PipelineStep

    error: Error
    loading: boolean
    output: string

    onHover: () => void
}

class SingleComponent extends React.Component<SingleComponentProps, any> {

    render() {
        // const {step, error, loading, output, onHover} = this.props
        //
        // const tooltipContent = <>
        //     <Typography color="inherit" component={'h4'}>Configuration</Typography>
        //     <ConfigurationTable config={step.config} twoColumns={true}/>
        //     <Typography color="inherit" component={'h4'}>Output</Typography>
        //
        //     <ErrorIndicator error={error}/>
        //     {!error &&
        //         <>
        //             <LoadingIndicator loading={loading}/>
        //             {!loading && (output ?
        //                 <div style={{overflowX: "auto", marginBottom: 0}}
        //                      dangerouslySetInnerHTML={{__html: output}}/> : <div>Missing</div>)
        //             }
        //         </>
        //     }
        // </>

        return (
            // <Tooltip placement={'top'}
            //          classes={{tooltip: 'structure-graph_tooltip jp-RenderedHTMLCommon'}}
            //          title={tooltipContent}
            //          enterDelay={500}
            //          enterNextDelay={500}
            //          leaveDelay={500}
            //          interactive={true}
            //          onOpen={onHover}>
            <>
                {Components.isPipEnd(this.props.step.id) ?
                    <p className={'structure-graph_end-node'}/> :
                    <p>{this.props.step.label}</p>
                }
            </>
            // </Tooltip>
        )
    }
}

interface PipelineVisualizationProps {
    structure: Pipeline
    candidate: Candidate
    selectedComponent: string
    onComponentSelection?: (component: PipelineStep) => void
}

interface PipelineVisualizationState {
    loading: boolean
    outputs: OutputDescriptionData
    error: Error
}

export class PipelineVisualizationComponent extends React.Component<PipelineVisualizationProps, PipelineVisualizationState> {

    private static readonly NODE_HEIGHT = 26;
    private static readonly NODE_WIDTH = 100;

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: PipelineVisualizationProps) {
        super(props);
        this.state = {loading: false, outputs: new Map<string, string>(), error: undefined}

        this.fetchOutputs = this.fetchOutputs.bind(this)
        this.renderNodes = this.renderNodes.bind(this)
        this.onComponentSelection = this.onComponentSelection.bind(this)
    }

    fetchOutputs() {
        if (this.state.loading)
            // Loading already in progress
            return
        if (this.state.outputs.size > 0)
            // Outputs already cached
            return

        this.setState({loading: true})
        this.context.requestOutputDescription(this.props.candidate.id)
            .then(data => this.setState({outputs: data, loading: false}))
            .catch(error => {
                console.error(`Failed to fetch output data.\n${error.name}: ${error.message}`);
                this.setState({error: error})
            });
    }

    private onComponentSelection(step: PipelineStep, e: React.MouseEvent): void {
        const {onComponentSelection} = this.props
        if (!!onComponentSelection) {
            onComponentSelection(step)
            e.stopPropagation()
        }
    }

    private renderNodes(root: Dag<PipelineStep>): JSX.Element {
        const {selectedComponent} = this.props
        const {outputs, loading, error} = this.state

        const renderedNodes = root.descendants().map(node => {
            return (
                <GraphNode key={node.data.label}
                           node={node}
                           highlight={node.data.step_name === selectedComponent || node.data.id === selectedComponent}
                           virtual={isPipEnd(node.data.id)}
                           nodeWidth={PipelineVisualizationComponent.NODE_WIDTH}
                           nodeHeight={PipelineVisualizationComponent.NODE_HEIGHT}
                           className={'structure-graph_node'}
                           onClick={this.onComponentSelection}>
                    <SingleComponent step={node.data}
                                     error={error}
                                     loading={loading}
                                     output={outputs.get(node.data.id)}
                                     onHover={this.fetchOutputs}/>
                </GraphNode>
            )
        })

        const renderedEdges = root.links().map(link =>
            <GraphEdge key={link.source.data.label + '-' + link.target.data.label}
                       link={link}
                       label={link.target.data.getLabel(link.source.data.id)}
                       nodeWidth={isPipEnd(link.source.data.id) ? PipelineVisualizationComponent.NODE_HEIGHT : PipelineVisualizationComponent.NODE_WIDTH}
                       nodeHeight={PipelineVisualizationComponent.NODE_HEIGHT}/>
        )

        return (
            <>
                {renderedEdges}
                {renderedNodes}
            </>
        )
    }

    render() {
        return (
            <HierarchicalTree nodeHeight={PipelineVisualizationComponent.NODE_HEIGHT}
                              nodeWidth={PipelineVisualizationComponent.NODE_WIDTH}
                              data={this.props.structure}
                              render={this.renderNodes}/>
        )
    }

}

