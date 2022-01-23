import {ConfigOrigin, Explanations, Structure} from "../../model";
import {JupyterContext} from "../../util";
import {SurrogateExplanation} from "./surrogate_explanation";
import React from "react";
import {KeyValue} from "../../util/KeyValue";
import {ConfigurationComp} from "./configuration";
import {CollapseComp} from "../../util/collapse";
import {ParallelCoordinates} from "../pc/parallel_corrdinates";
import {DetailsModel} from "./model";
import {JupyterButton} from "../../util/jupyter-button";
import {ID} from "../../jupyter";
import {StructureSearchGraph} from "../search_space/structure_search";


interface ConfigOriginProps {
    model: DetailsModel

    structures: Structure[]
    explanations: Explanations
}

export class ConfigOriginComp extends React.Component<ConfigOriginProps, any> {

    static readonly HELP = 'Contains details about the selected hyperparameter configuration. Displayed are the raw ' +
        'hyperparameters for each step in the pipeline and how this configuration was obtained. If the configuration ' +
        'was obtained some kind of guided search strategy, the reasoning of the internal AutoML optimizer are' +
        'visualized.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: ConfigOriginProps) {
        super(props);

        this.exportConfiguration = this.exportConfiguration.bind(this)
    }

    private static getHelp(origin: ConfigOrigin): string {
        switch (origin) {
            case 'Default':
                return 'Default hyperparameters as specified in the component declaration.'
            case 'Hyperopt':
                return 'The candidate is obtained by optimizing an internal model of the performance of ' +
                    'potential candidates. More specifically, the selected candidate maximizes the posterior ' +
                    'in a Bayesian optimization. '
            case 'Initial design':
                return 'This fixed candidate is selected based on some initial design. This initial design ' +
                    'could, for example, be a set of configurations obtained via via meta-learning that performed ' +
                    'well on a variety of data sets in the past.'
            case 'Random Search':
                return 'The candidate was selected at random.'
            case 'Local Search':
                return 'Candidate obtained via local search around all-ready evaluated candidates maximizing the acquisition function'
            case 'Random Search (sorted)':
                return 'Candidate obtained via random search maximizing the acquisition function'
            case 'Sobol':
                return 'Quasi-random selection of configuration based on a Sobol sequence'
        }
    }

    private exportConfiguration() {
        const {id} = this.props.model.candidate
        this.context.createCell(`
${ID}_hp = XAutoMLManager.get_active().get_config('${id}')
${ID}_hp
        `.trim())
    }

    render() {
        const {explanations, model} = this.props
        const {candidate, structure} = model

        return (
            <>
                <div style={{display: 'flex', justifyContent: "space-between"}}>
                    <KeyValue key_={'Origin'} value={candidate.origin}
                              help={ConfigOriginComp.getHelp(candidate.origin)}/>
                    <JupyterButton onClick={this.exportConfiguration}/>
                </div>
                <ConfigurationComp candidate={candidate} structure={structure}/>

                <hr/>
                <CollapseComp name={'config-origin-reinforcement'} showInitial={true}
                              help={StructureSearchGraph.HELP + '\n\n' +
                                  'Highlighted in blue is the actual selected pipeline structure.'}>
                    <h4>Pipeline Structure Search</h4>
                    <StructureSearchGraph timestamp={candidate.index}/>
                </CollapseComp>

                <CollapseComp name={'config-origin-bo'} showInitial={true}
                              help={ParallelCoordinates.HELP + '\n\n' + SurrogateExplanation.HELP}>
                    <h4>Hyperparameter Optimization</h4>
                    <SurrogateExplanation model={model}
                                          explanation={explanations?.configs.get(candidate.id)}/>
                </CollapseComp>
            </>
        )
    }
}
