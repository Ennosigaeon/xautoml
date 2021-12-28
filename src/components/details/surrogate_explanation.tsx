import {ParallelCoordinates} from "../pc/parallel_corrdinates";
import React from "react";
import {BO, Candidate, CandidateId, Structure} from "../../model";
import {LoadingIndicator} from "../../util/loading";
import {WarningIndicator} from "../../util/warning";
import {JupyterContext} from "../../util";


interface SurrogateExplanationProps {
    structure: Structure
    candidate: Candidate
    explanation: BO.Explanation
}

interface SurrogateExplanationState {
    explanation: BO.Explanation
    loading: boolean
}

export class SurrogateExplanation extends React.Component<SurrogateExplanationProps, SurrogateExplanationState> {

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
        const {candidate, structure} = this.props

        this.setState({loading: true})
        this.context.requestSimulatedSurrogate(structure.cid, candidate.runtime.timestamp)
            .then(resp => {
                this.setState({explanation: resp, loading: false})
            })
            .catch(error => {
                console.error(`Failed to fetch simulated surrogate data.\n${error.name}: ${error.message}`)
                this.setState({explanation: undefined, loading: false})
            });
    }

    render() {
        const {structure, candidate} = this.props
        const {explanation, loading} = this.state

        const candidates: [Candidate, Structure][] = explanation && explanation.candidates.length > 0 ?
            explanation.candidates.map(c => [c, structure]) : [[candidate, structure]]
        const label = explanation ? explanation.metric : 'Performance'
        const loss = candidates.map(([c, _]) => c.loss)


        const selected = new Set<CandidateId>([explanation ? loss.reduce((argMax, x, idx, array) => {
            return x > array[argMax] ? idx : argMax
        }, 0).toString() : candidate.id])

        return (
            <div className={'surrogate_explanation'}>
                <LoadingIndicator loading={loading}/>
                {!loading &&
                    <>
                        {(this.props.explanation === undefined && explanation !== undefined) &&
                            <WarningIndicator message={'The run history did not contain information about ' +
                                'the surrogate model. The surrogate state is only ' +
                                'simulated via hyperparameter importance and may differ ' +
                                'significantly from the real surrogate model.'}/>
                        }
                        {(this.props.explanation === undefined && explanation === undefined) &&
                            <WarningIndicator message={'Failed to simulate surrogate model.'}/>
                        }
                        <ParallelCoordinates structures={[structure]}
                                             candidates={candidates}
                                             selectedCandidates={selected}
                                             explanation={explanation}
                                             perfAxis={{
                                                 label: label, domain: [Math.min(...loss), Math.max(...loss)], log: true
                                             }}/>
                    </>
                }
            </div>

        );
    }
}
