import {ParallelCoordinates} from "../pc/parallel_corrdinates";
import React from "react";
import {Candidate, CandidateId, Config, MetaInformation, Structure} from "../../model";
import {ErrorIndicator} from "../../util/error";
import {LoadingIndicator} from "../../util/loading";
import {WarningIndicator} from "../../util/warning";
import {JupyterContext} from "../../util";


interface SurrogateExplanationProps {
    meta: MetaInformation
    structure: Structure
    candidate: Candidate
    explanation: Config.Explanation
}

interface SurrogateExplanationState {
    error: Error
    explanation: Config.Explanation
}

export class SurrogateExplanation extends React.Component<SurrogateExplanationProps, SurrogateExplanationState> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: SurrogateExplanationProps) {
        super(props);
        this.state = {explanation: this.props.explanation, error: undefined}
    }

    componentDidMount() {
        if (this.state.explanation === undefined)
            this.simulateExplanation()
    }

    private simulateExplanation() {
        const {candidate, structure} = this.props

        this.context.requestSimulatedSurrogate(structure.cid, candidate.runtime.timestamp)
            .then(resp => {
                this.setState({explanation: resp})
            })
            .catch(error => {
                console.error(`Failed to fetch simulated surrogate data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });
    }

    render() {
        const {meta, structure, candidate} = this.props
        const {explanation, error} = this.state

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error &&
                    <>
                        <LoadingIndicator loading={explanation === undefined}/>
                        {explanation !== undefined &&
                            <>
                                {this.props.explanation === undefined &&
                                    <WarningIndicator message={'The run history did not contain information about ' +
                                                          'the surrogate model. The surrogate state is only ' +
                                                          'simulated via hyperparameter importance and may differ ' +
                                                          'significantly from the real surrogate model.'}/>
                                }
                                <ParallelCoordinates meta={meta} structures={[structure]}
                                                     candidates={[[candidate, structure]]}
                                                     selectedCandidates={new Set<CandidateId>([candidate.id])}
                                                     explanation={explanation}/>
                            </>
                        }
                    </>}
            </>

        );
    }
}
