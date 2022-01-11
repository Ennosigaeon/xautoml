import {ConfigOrigin, Explanations, Structure} from "../../model";
import {MCTSExplanationsComponent} from "../search_space/mcts_explanation";
import {cidToSid, JupyterContext} from "../../util";
import {SurrogateExplanation} from "./surrogate_explanation";
import React from "react";
import {KeyValue} from "../../util/KeyValue";
import {ConfigurationComp} from "./configuration";
import {CollapseComp} from "../../util/collapse";
import {ParallelCoordinates} from "../pc/parallel_corrdinates";
import {DetailsModel} from "./model";


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

    private static getHelp(origin: ConfigOrigin): string {
        switch (origin) {
            case 'Default':
                return 'Default configuration as specified in the component declaration.'
            case 'Hyperopt':
                return 'The configuration is obtained by optimizing an internal model of the performance of ' +
                    'potential configurations. More specifically, the selected configuration maximizes the posterior ' +
                    'in a Bayesian optimization. '
            case 'Initial design':
                return 'This fixed configuration is selected based on some initial design. This initial design ' +
                    'could, for example, be a set of configurations obtained via via meta-learning that performed ' +
                    'well on a variety of data sets in the past.'
            case 'Random Search':
                return 'The configuration was selected at random.'
            case 'Local Search':
                return 'Configuration obtained via local search around all-ready evaluated configuration maximizing the acquisition function'
            case 'Random Search (sorted)':
                return 'Configuration obtained via random search maximizing the acquisition function'
            case 'Sobol':
                return 'Quasi-random selection of configuration based on a Sobol sequence'
        }
    }

    render() {
        const {explanations, structures, model} = this.props
        const {candidate, structure} = model

        return (
            <>
                <KeyValue key_={'Origin'} value={candidate.origin} help={ConfigOriginComp.getHelp(candidate.origin)}/>
                <ConfigurationComp candidate={candidate} structure={structure}/>

                {(explanations.structures || explanations.configs) && <hr/>}
                {explanations.structures &&
                    <CollapseComp name={'config-origin-reinforcement'} showInitial={true}
                                  help={MCTSExplanationsComponent.HELP + '\n\n' + 'Highlighted in blue is the actual ' +
                                      'selected pipeline structure.'}>
                        <h4>Structure Search</h4>
                        <MCTSExplanationsComponent explanations={explanations.structures}
                                                   structures={structures}
                                                   timestamp={cidToSid(candidate.id)}/>
                    </CollapseComp>
                }
                {explanations.configs &&
                    <CollapseComp name={'config-origin-bo'} showInitial={true}
                                  help={ParallelCoordinates.HELP + '\n\n' + SurrogateExplanation.HELP}>
                        <h4>Hyperparameter Optimization</h4>
                        <SurrogateExplanation model={model}
                                              explanation={explanations.configs.get(candidate.id)}/>
                    </CollapseComp>
                }
            </>
        )
    }
}
