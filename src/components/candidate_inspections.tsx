import React from "react";
import {Candidate, Explanations, MetaInformation, PipelineStep, Structure} from "../model";
import {Colors, Components, JupyterContext} from "../util";
import {TwoColumnLayout} from "../util/layout";
import {LocalSurrogateComponent} from "./details/local_surrogate";
import {FeatureImportanceComponent} from "./details/feature_importance";
import {RawDataset} from "../util/raw_dataset";
import {ComparisonType, DetailsModel} from "./details/model";
import {GlobalSurrogateComponent} from "./details/global_surrogate";
import {CollapseComp} from "../util/collapse";
import {PerformanceDetailsComponent} from "./details/performance_details";
import {HPImportanceComp} from "./details/hp_importance";
import {ConfigurationComponent} from "./details/configuration";
import {PipelineVisualizationComponent} from "./details/pipeline_visualization";
import {Box, Button, Tab, Tabs} from "@material-ui/core";
import {TabContext} from "@material-ui/lab";
import {DivInTabs, TabPanel} from "../util/tabpanel";
import {JupyterButton} from "../util/jupyter-button";
import {ID} from "../jupyter";
import {IMimeBundle} from "@jupyterlab/nbformat";
import {GoDeploymentComponent} from "./usu_iap/deployment-dialog";


class DomainInsightsProps {
    model: DetailsModel
    meta: MetaInformation
    include: string[]

    onComparisonRequest: (type: ComparisonType) => void
    onSampleClick: (idx: number) => void
}

export class DomainInsights extends React.Component<DomainInsightsProps> {
    render() {
        const {model, meta,} = this.props
        const include = (!this.props.include) ? ['performance', 'raw-dataset', 'feature-importance', 'global-surrogate'] : this.props.include

        return (
            <>
                {include.includes('performance') &&
                    <CollapseComp name={'performance'} showInitial={include.length === 1}
                                  help={PerformanceDetailsComponent.HELP}
                                  onComparisonRequest={() => this.props.onComparisonRequest('performance')}>
                        <h3>Performance Details</h3>
                        <PerformanceDetailsComponent model={model} meta={meta}/>
                    </CollapseComp>
                }

                {include.includes('raw-dataset') &&
                    <CollapseComp name={'raw-dataset'} showInitial={include.length === 1} help={RawDataset.HELP}>
                        <h3>Data Set Preview</h3>
                        <TwoColumnLayout widthRight={'25%'}>
                            <RawDataset model={model} onSampleClick={this.props.onSampleClick}/>
                            <LocalSurrogateComponent model={model} orientation={'vertical'}
                                                     onComparisonRequest={this.props.onComparisonRequest}/>
                        </TwoColumnLayout>
                    </CollapseComp>
                }

                {include.includes('feature-importance') &&
                    <CollapseComp name={'feature-importance'} showInitial={false}
                                  help={FeatureImportanceComponent.HELP}
                                  onComparisonRequest={() => this.props.onComparisonRequest('feature_importance')}>
                        <h3>Feature Importance</h3>
                        <FeatureImportanceComponent model={model}/>
                    </CollapseComp>
                }

                {include.includes('global-surrogate') &&
                    <CollapseComp name={'global-surrogate'} showInitial={false} help={GlobalSurrogateComponent.HELP}
                                  onComparisonRequest={() => this.props.onComparisonRequest('global_surrogate')}>
                        <h3>Global Surrogate</h3>
                        <GlobalSurrogateComponent model={model}/>
                    </CollapseComp>
                }
            </>
        )
    }
}

class MLInsightsProps {
    model: DetailsModel
    meta: MetaInformation
    structures: Structure[]
    explanations: Explanations
    include: string[]

    onComparisonRequest: (type: ComparisonType) => void
}

export class MLInsights extends React.Component<MLInsightsProps> {

    render() {
        const {model, meta, structures, explanations,} = this.props
        const include = (!this.props.include) ? ['config-origin', 'hp-importance'] : this.props.include

        return (
            <>
                {include.includes('config-origin') &&
                    <CollapseComp name={'config-origin'} showInitial={include.length === 1}
                                  help={ConfigurationComponent.HELP}
                                  onComparisonRequest={() => this.props.onComparisonRequest('configuration')}>
                        <h3>Model Details</h3>
                        <ConfigurationComponent model={model} structures={structures} explanations={explanations}/>
                    </CollapseComp>
                }

                {include.includes('hp-importance') &&
                    <CollapseComp name={'hp-importance'} showInitial={include.length === 1} help={HPImportanceComp.HELP}
                                  onComparisonRequest={() => this.props.onComparisonRequest('hp_importance')}>
                        <h3>Hyperparameter Importance</h3>
                        <HPImportanceComp model={model} metric={meta.metric}/>
                    </CollapseComp>
                }
            </>
        )
    }
}

interface CandidateInspectionsProps {
    candidate: Candidate
    structure: Structure
    meta: MetaInformation

    structures: Structure[]
    explanations: Explanations

    renderDomain: boolean
    renderML: boolean
    include: string[]

    iapEnabled: boolean
    onComparisonRequest: (type: ComparisonType, selectedRow: number) => void
}

interface CandidateInspectionsState {
    selectedSample: number
    componentId: string
    componentLabel: string
    openTab: string
}

export class CandidateInspections extends React.Component<CandidateInspectionsProps, CandidateInspectionsState> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: CandidateInspectionsProps, context: React.ContextType<typeof JupyterContext>) {
        super(props, context);
        this.state = {
            selectedSample: undefined,
            componentId: Components.SOURCE,
            componentLabel: Components.SOURCE,
            openTab: this.context?.collapsedState.get<string>('candidate-inspection') || '1'
        }

        this.context?.collapsedState.setIfNotPresent<string>('candidate-inspection', this.state.openTab)

        this.handleSampleSelection = this.handleSampleSelection.bind(this)
        this.onComparisonRequest = this.onComparisonRequest.bind(this)
        this.openComponent = this.openComponent.bind(this)
        this.switchTab = this.switchTab.bind(this)
        this.openCandidateInJupyter = this.openCandidateInJupyter.bind(this)
        this.onDeploy = this.onDeploy.bind(this)
    }

    private openComponent(step: PipelineStep) {
        // quick and dirty fix for dswizard to select pipeline steps.
        // TODO clean-up the pipeline id, step_name, label mess
        if (this.props.meta.framework === 'dswizard')
            this.setState({componentId: step.id, componentLabel: step.label})
        else
            this.setState({componentId: step.step_name, componentLabel: step.label})
    }

    private handleSampleSelection(idx: number) {
        this.setState({selectedSample: idx})
    }

    private onComparisonRequest(type: ComparisonType) {
        this.props.onComparisonRequest(type, this.state.selectedSample)
    }

    private switchTab(_: any, selectedTab: string) {
        this.setState({openTab: selectedTab})
        this.context?.collapsedState.set<string>('candidate-inspection', selectedTab)
    }

    private openCandidateInJupyter(e: React.MouseEvent) {
        this.context.createCell(`
${ID}_X, ${ID}_y, ${ID}_pipeline = gcx().pipeline('${this.props.candidate.id}')
${ID}_pipeline
        `.trim())
        e.stopPropagation()
    }

    private onDeploy(e: React.MouseEvent) {
        this.context.executeCode<IMimeBundle>(`
from xautoml.gui import export
export('${this.props.candidate.id}')
        `)
        new GoDeploymentComponent('', this.context.fileBrowserFactory.createFileBrowser('usu_iap')).open()

        e.stopPropagation()
    }

    private renderAll(model: DetailsModel) {
        const {meta, structures, explanations} = this.props
        return (
            <TabContext value={this.state.openTab}>
                <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                    <Tabs value={this.state.openTab} onChange={this.switchTab} TabIndicatorProps={{
                        style: {backgroundColor: Colors.HIGHLIGHT}
                    }}>
                        <Tab label="Domain Insights" value={'1'}/>
                        <Tab label="Machine Learning Insights" value={'2'}/>

                        <DivInTabs style={{marginLeft: 'auto'}}>
                            <JupyterButton onClick={this.openCandidateInJupyter}
                                           active={this.context.canCreateCell()}/>
                        </DivInTabs>
                        {this.props.iapEnabled && <DivInTabs>
                            <Button onClick={this.onDeploy} style={{margin: '0 10px'}}>Deploy</Button>
                        </DivInTabs>
                        }

                    </Tabs>
                </Box>

                <h3>Insights for <i>
                    {Components.isPipEnd(model.component) ? `${model.component === Components.SOURCE ? 'Beginning' : 'End'} of the Pipeline` : `${model.algorithm} (${model.component})`}
                </i>
                </h3>
                <p>
                    Select any step in the pipeline to calculate the analysis in the following views for the
                    output generated by the selected pipeline step.
                </p>

                <Box marginTop={2} marginBottom={2}>
                    <PipelineVisualizationComponent structure={model.structure.pipeline}
                                                    candidate={model.candidate}
                                                    selectedComponent={model.component}
                                                    onComponentSelection={this.openComponent}/>
                </Box>

                <TabPanel value={'1'}>
                    <DomainInsights model={model} meta={meta} onComparisonRequest={this.onComparisonRequest}
                                    onSampleClick={this.handleSampleSelection} include={undefined}/>
                </TabPanel>

                <TabPanel value={'2'}>
                    <MLInsights model={model} meta={meta} structures={structures} explanations={explanations}
                                onComparisonRequest={this.onComparisonRequest} include={undefined}/>
                </TabPanel>
            </TabContext>
        )
    }

    render() {
        const {candidate, structure, meta, structures, explanations, renderDomain, renderML, include} = this.props
        const {selectedSample, componentId, componentLabel} = this.state

        const model = new DetailsModel(structure, candidate, componentId, componentLabel, selectedSample)

        return (
            <>
                {(renderDomain && renderML) && this.renderAll(model)}
                {(renderDomain && !renderML) &&
                    <DomainInsights model={model} meta={meta} onComparisonRequest={this.onComparisonRequest}
                                    onSampleClick={this.handleSampleSelection} include={include}/>
                }
                {(!renderDomain && renderML) &&
                    <MLInsights model={model} meta={meta} structures={structures} explanations={explanations}
                                onComparisonRequest={this.onComparisonRequest} include={include}/>
                }
                {(!renderDomain && !renderML) &&
                    <PipelineVisualizationComponent structure={model.structure.pipeline}
                                                    candidate={model.candidate}
                                                    selectedComponent={model.component}
                                                    onComponentSelection={this.openComponent}/>}
            </>
        )
    }
}
