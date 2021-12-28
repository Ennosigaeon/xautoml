import {Candidate, ConfigOrigin, Explanations, MetaInformation, Structure} from "../../model";
import {BanditExplanationsComponent} from "../search_space/bandit_explanation";
import {cidToSid, JupyterContext} from "../../util";
import {SurrogateExplanation} from "./surrogate_explanation";
import React from "react";
import {KeyValue} from "../../util/KeyValue";


interface ConfigOriginProps {
    candidate: Candidate
    structure: Structure
    meta: MetaInformation

    structures: Structure[]
    explanations: Explanations
}

export class ConfigOriginComp extends React.Component<ConfigOriginProps, any> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    private static getHelp(origin: ConfigOrigin): string {
        switch (origin) {
            case 'Default':
                return 'Fixed default configuration'
            case 'Hyperopt':
                return 'Configuration obtained by maximizing the surrogate posterior'
            case 'Initial design':
                return 'Fixed configuration provided via meta-learning'
            case 'Local Search':
                return 'Configuration obtained via local search around all-ready evaluated configuration maximizing the acquisition function'
            case 'Random Search':
                return 'Random selection of configuration'
            case 'Random Search (sorted)':
                return 'Configuration obtained via random search maximizing the acquisition function'
            case 'Sobol':
                return 'Quasi-random selection of configuration based on a Sobol sequence'
        }
    }

    render() {
        const {explanations, structures, candidate, structure, meta} = this.props

        return (
            <>
                <KeyValue key_={'Origin'} value={candidate.origin} help={ConfigOriginComp.getHelp(candidate.origin)}/>
                {explanations.structures &&
                    <BanditExplanationsComponent explanations={explanations.structures}
                                                 structures={structures}
                                                 timestamp={cidToSid(candidate.id)}/>
                }
                <SurrogateExplanation structure={structure} candidate={candidate}
                                      explanation={explanations.configs.get(candidate.id)}/>
            </>
        )
    }
}
