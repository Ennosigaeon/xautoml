import {ParallelCoordinates} from "./pc/parallel_corrdinates";
import React from "react";
import {Candidate, Config, MetaInformation, Structure} from "../model";
import {requestSimulatedSurrogate} from "../handler";
import {ErrorIndicator} from "../util/error";
import {LoadingIndicator} from "./loading";
import {WarningIndicator} from "../util/warning";


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

    constructor(props: SurrogateExplanationProps) {
        super(props);
        this.state = {explanation: this.props.explanation, error: undefined}

        if (this.state.explanation === undefined)
            this.simulateExplanation()
    }

    private simulateExplanation() {
        const {candidate, structure} = this.props

        const cs = structure.configspace
        const relevantConfigs = structure.configs.filter(c => c.runtime.timestamp < candidate.runtime.timestamp)

        const configs = relevantConfigs.map(c => {
            const obj: any = {}
            c.config.forEach((v, k) => obj[k] = v)
            return obj
        })
        const loss = relevantConfigs.map(c => c.loss)


        requestSimulatedSurrogate(cs, configs, loss)
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
                                    <WarningIndicator title={'Simulated Surrogate'}
                                                      message={'The run history did not contain information about ' +
                                                          'the surrogate model. The surrogate state is only ' +
                                                          'simulated via hyperparameter importance and may differ ' +
                                                          'significantly from the real surrogate model.'}/>
                                }
                                <ParallelCoordinates meta={meta} structures={[structure]}
                                                     candidates={[[candidate, structure]]}
                                                     explanation={explanation}/>
                            </>
                        }
                    </>}
            </>

        );
    }
}
