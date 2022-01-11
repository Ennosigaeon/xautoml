import {ParallelCoordinates} from "../pc/parallel_corrdinates";
import React from "react";
import {BO, Candidate, CandidateId, Structure} from "../../model";
import {LoadingIndicator} from "../../util/loading";
import {WarningIndicator} from "../../util/warning";
import {JupyterContext} from "../../util";
import {DetailsModel} from "./model";


interface SurrogateExplanationProps {
    model: DetailsModel
    explanation: BO.Explanation
}

interface SurrogateExplanationState {
    explanation: BO.Explanation
    loading: boolean
}

export class SurrogateExplanation extends React.Component<SurrogateExplanationProps, SurrogateExplanationState> {

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
        const label = explanation ? explanation.metric : 'Performance'
        const loss = candidates.map(([c, _]) => c.loss)


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
                                             perfAxis={{
                                                 label: label, domain: [Math.min(...loss), Math.max(...loss)], log: true
                                             }}/>
                    </>
                }
            </div>

        );
    }
}
