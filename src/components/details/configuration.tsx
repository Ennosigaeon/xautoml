import {BO, Candidate, CandidateId, ConfigOrigin, Explanations, Structure} from "../../model";
import {JupyterContext} from "../../util";
import React from "react";
import {ParallelCoordinates} from "../pc/parallel_corrdinates";
import {DetailsModel} from "./model";
import {ID} from "../../jupyter";
import {StructureSearchGraph} from "../search_space/structure_search_graph";
import {LoadingIndicator} from "../../util/loading";
import {WarningIndicator} from "../../util/warning";


interface SurrogateExplanationProps {
    model: DetailsModel
    explanation: BO.Explanation
    onExport: () => void
}

interface SurrogateExplanationState {
    explanation: BO.Explanation
    loading: boolean
}

class SMBOSurrogateCPC extends React.Component<SurrogateExplanationProps, SurrogateExplanationState> {

    static readonly HELP = 'The line highlighted in blue represents the the actual selected configuration. In case ' +
        'of a model-based selection of the configuration, other potential configurations, that are worse ' +
        'than the selected configuration according to the internal model, are also displayed.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: SurrogateExplanationProps) {
        super(props);
        this.state = {explanation: this.props.explanation, loading: this.props.explanation === undefined}
    }

    componentDidMount() {
        if (this.state.explanation === undefined)
            this.simulateExplanation()
    }

    private simulateExplanation() {
        const {model} = this.props

        this.setState({loading: true})
        this.context.requestSimulatedSurrogate(model.structure.cid, model.candidate.runtime.timestamp)
            .then(resp => {
                this.setState({explanation: resp, loading: false})
            })
            .catch(error => {
                console.error(`Failed to fetch simulated surrogate data.\n${error.name}: ${error.message}`)
                this.setState({explanation: undefined, loading: false})
            });
    }

    render() {
        const {model} = this.props
        const {explanation, loading} = this.state

        const candidates: [Candidate, Structure][] = explanation && explanation.candidates.length > 0 ?
            explanation.candidates.map(c => [c, model.structure]) : [[model.candidate, model.structure]]
        const loss = candidates.map(([c, _]) => c.loss)
        const domain = [Math.min(...loss), Math.max(...loss)] as [number, number]
        const perfAxis = domain[0] === domain[1] ? undefined : {label: explanation.metric, domain: domain, log: true}

        const selected = new Set<CandidateId>([loss.length > 1 ? loss.reduce((argMax, x, idx, array) => {
            return x > array[argMax] ? idx : argMax
        }, 0).toString() : model.candidate.id])

        return (
            <div className={'surrogate_explanation'}>
                <LoadingIndicator loading={loading}/>
                {!loading &&
                    <>
                        {(this.props.explanation === undefined && explanation !== undefined) &&
                            <WarningIndicator message={'The run history did not contain information about ' +
                                'the surrogate model. The surrogate state is only simulated via hyperparameter ' +
                                'importance and may differ significantly from the real surrogate model.'}/>
                        }
                        {(this.props.explanation === undefined && explanation === undefined) &&
                            <WarningIndicator message={'Failed to simulate surrogate model.'}/>
                        }
                        <ParallelCoordinates structures={[model.structure]}
                                             candidates={candidates}
                                             selectedCandidates={selected}
                                             explanation={explanation}
                                             showExplanations={true}
                                             expand={true}
                                             onExport={this.props.onExport}
                                             perfAxis={perfAxis}/>
                    </>
                }
            </div>

        );
    }
}


interface ConfigurationProps {
    model: DetailsModel

    structures: Structure[]
    explanations: Explanations
}

export class ConfigurationComponent extends React.Component<ConfigurationProps, any> {

    static readonly HELP = 'Contains details about the selected hyperparameter configuration. Displayed are the raw ' +
        'hyperparameters for each step in the pipeline and how this configuration was obtained. If the configuration ' +
        'was obtained some kind of guided search strategy, the reasoning of the internal AutoML optimizer are' +
        'visualized.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: ConfigurationProps) {
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
${ID}_hp = gcx().config('${id}')
${ID}_hp
        `.trim())
    }

    render() {
        const {explanations, model} = this.props
        const {candidate} = model

        return (
            <>
                <h4>Hyperparameters Optimization</h4>
                <SMBOSurrogateCPC model={model}
                                  onExport={this.exportConfiguration}
                                  explanation={explanations?.configs.get(candidate.id)}/>

                <hr/>
                <h4>Pipeline Structure Search</h4>
                <StructureSearchGraph timestamp={candidate.index}/>
            </>
        )
    }
}
