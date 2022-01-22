import React from "react";
import {Candidate, Config, ConfigValue, Pipeline, PipelineStep, Structure} from "../../model";
import {Components, JupyterContext} from "../../util";
import {Typography} from "@material-ui/core";
import {OutputDescriptionData} from "../../dao";
import {LoadingIndicator} from "../../util/loading";
import {ErrorIndicator} from "../../util/error";
import {GraphEdge, GraphNode, HierarchicalTree} from "../tree_structure";
import {Dag} from "d3-dag";
import {ConfigurationTable} from "./configuration";
import isPipEnd = Components.isPipEnd;


export class StepWithConfig extends PipelineStep {

    constructor(public readonly id: string,
                public readonly clazz: string,
                public readonly parentIds: string[],
                public readonly config: Config) {
        super(id, clazz, parentIds);
    }

    static fromStep(step: PipelineStep, config: Config) {
        const copy = new StepWithConfig(step.id, step.clazz, [...step.parentIds], config)
        step.edgeLabels.forEach((v, k) => copy.edgeLabels.set(k, v))
        return copy
    }

    getLabel(parent: string): string {
        // parent id may have been changed to omit "transparent" steps like pipeline or column transformer.
        if (this.edgeLabels.size === 1)
            return this.edgeLabels.values().next().value
        return this.edgeLabels.get(parent)
    }
}

interface SingleComponentProps {
    step: StepWithConfig

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

interface StructureGraphProps {
    structure: Structure
    candidate: Candidate
    selectedComponent: string
    onComponentSelection?: (component: StepWithConfig) => void
}

interface StructureGraphState {
    loading: boolean
    outputs: OutputDescriptionData
    error: Error
}

export class PipelineStructureComponent extends React.Component<StructureGraphProps, StructureGraphState> {

    private static readonly NODE_HEIGHT = 26;
    private static readonly NODE_WIDTH = 100;

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: StructureGraphProps) {
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

    private toStepsWithConfig(candidate: Candidate, pipeline: Pipeline): StepWithConfig[] {
        const root = new StepWithConfig(Components.SOURCE, 'Source', [], new Map<string, ConfigValue>())
        const nodes = [root]
        pipeline.steps.forEach(step => {
            const subConfig = candidate.subConfig(step, true)
            const node = StepWithConfig.fromStep(step, subConfig)
            if (node.parentIds.length === 0)
                node.parentIds.push(root.id)

            nodes.push(node)
        })

        nodes.push(new StepWithConfig(
            Components.SINK,
            'Sink',
            pipeline.steps.slice(-1).map(step => step.id), // Pipeline can only have exactly 1 final step (the classifier)
            new Map<string, ConfigValue>())
        )
        return nodes
    }

    private onComponentSelection(step: StepWithConfig, e: React.MouseEvent): void {
        const {onComponentSelection} = this.props
        if (!!onComponentSelection) {
            onComponentSelection(step)
            e.stopPropagation()
        }
    }

    private renderNodes(root: Dag<StepWithConfig>): JSX.Element {
        const {selectedComponent} = this.props
        const {outputs, loading, error} = this.state

        const renderedNodes = root.descendants().map(node => {
            return (
                <GraphNode key={node.data.label}
                           node={node}
                           highlight={node.data.id === selectedComponent}
                           virtual={isPipEnd(node.data.id)}
                           nodeWidth={PipelineStructureComponent.NODE_WIDTH}
                           nodeHeight={PipelineStructureComponent.NODE_HEIGHT}
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
                       nodeWidth={isPipEnd(link.source.data.id) ? PipelineStructureComponent.NODE_HEIGHT : PipelineStructureComponent.NODE_WIDTH}
                       nodeHeight={PipelineStructureComponent.NODE_HEIGHT}/>
        )

        return (
            <>
                {renderedEdges}
                {renderedNodes}
            </>
        )
    }

    render() {
        const {structure, candidate} = this.props
        const data = this.toStepsWithConfig(candidate, structure.pipeline)

        return (
            <HierarchicalTree nodeHeight={PipelineStructureComponent.NODE_HEIGHT}
                              nodeWidth={PipelineStructureComponent.NODE_WIDTH}
                              data={data}
                              render={this.renderNodes}/>
        )
    }

}
