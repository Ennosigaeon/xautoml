import React from "react";
import {CandidateId, MetaInformation} from "../model";
import {CancelablePromise, CanceledPromiseError, requestRocCurve, RocCurveData} from "../handler";
import {LoadingIndicator} from "./loading";
import {ErrorIndicator} from "../util/error";
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis} from "recharts";
import {Colors} from "../util";


interface RocCurveProps {
    selectedCandidates: Set<CandidateId>
    meta: MetaInformation

    height: number
}

interface RocCurveState {
    data: Map<string, any[]>
    pendingCount: number
    pendingRequest: CancelablePromise<RocCurveData>
    error: Error
}

export class RocCurve extends React.Component<RocCurveProps, RocCurveState> {

    static HELP = 'Displays the ROC curve for all selected candidates.\n\n' +
        'A ROC curve is a graphical plot that illustrates the diagnostic ability of a binary classifier system as ' +
        'its discrimination threshold is varied. The ROC curve is created by plotting the true positive rate (TPR) ' +
        'against the false positive rate (FPR) at various threshold settings.'

    constructor(props: RocCurveProps) {
        super(props)

        this.state = {
            data: new Map<string, any[]>(),
            pendingRequest: undefined,
            error: undefined,
            pendingCount: 0
        }
    }

    componentDidMount() {
        if (this.props.selectedCandidates.size > 0)
            this.queryROCCurve(Array.from(this.props.selectedCandidates))
    }

    componentDidUpdate(prevProps: Readonly<RocCurveProps>, prevState: Readonly<RocCurveState>, snapshot?: any) {
        if (prevProps.selectedCandidates.size !== this.props.selectedCandidates.size) {
            let newCandidates: CandidateId[]
            if (this.state.pendingRequest === undefined) {
                // Remove previously selected candidates
                const superfluousCandidates = Array.from(prevProps.selectedCandidates).filter(c => !this.props.selectedCandidates.has(c))
                const currentCandidates = this.state.data
                const currentKeys = Array.from(currentCandidates.keys())
                superfluousCandidates.forEach(c => {
                    currentKeys.filter(k => k.startsWith(c)).forEach(k => currentCandidates.delete(k))
                })
                this.setState({data: currentCandidates})
                newCandidates = Array.from(this.props.selectedCandidates).filter(c => !prevProps.selectedCandidates.has(c))

                if (currentCandidates.size === 0)
                    this.setState({error: undefined})
            } else {
                // Request for data is currently still pending. Erase complete state and load everything from scratch to
                // prevent incoherent states
                this.state.pendingRequest.cancel()
                this.setState({data: new Map<string, any[]>(), pendingRequest: undefined})
                newCandidates = Array.from(this.props.selectedCandidates)
            }

            // Fetch new selected candidates
            if (newCandidates.length > 0) {
                this.queryROCCurve(newCandidates)
            }
        }
    }

    private queryROCCurve(candidates: CandidateId[]) {
        const promise = requestRocCurve(candidates, this.props.meta.data_file, this.props.meta.model_dir)
        this.setState({pendingRequest: promise, error: undefined, pendingCount: candidates.length})

        promise
            .then(data => {
                const currentCandidates = this.state.data
                data.forEach((v, k) => currentCandidates.set(k, v))
                this.setState({data: currentCandidates, pendingRequest: undefined})
            })
            .catch(error => {
                if (!(error instanceof CanceledPromiseError)) {
                    console.error(`Failed to fetch Roc Curve data.\n${error.name}: ${error.message}`)
                    this.setState({error: error, pendingRequest: undefined})
                } else {
                    console.log('Cancelled promise due to user request')
                }
            });
    }

    render() {
        const {data, pendingRequest, pendingCount, error} = this.state

        let content: JSX.Element
        if (pendingRequest !== undefined && pendingCount > 2)
            content = <LoadingIndicator loading={true}/>
        else if (data.size > 0) {
            const labels: string[] = []
            const data: any[] = []
            this.state.data.forEach((v, k) => {
                labels.push(k)
                data.push(v)
            })

            content = (
                <div style={{height: this.props.height}}>
                    <ResponsiveContainer>
                        <LineChart>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey="x" label={{value: 'False Positive Rate', dy: 10}} type={'number'}
                                   domain={[0, 1]}/>
                            <YAxis label={{value: 'True Positive Rate', angle: -90, dx: -15}}/>
                            {data.length <= 12 && <Legend/>}
                            {data.map((s, idx) => <Line key={labels[idx]} name={labels[idx]} data={s} dataKey={'y'}
                                                        stroke={Colors.getColor(idx)}/>)}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )
        } else
            content = <p>No Configuration selected</p>

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error && content}
            </>
        )
    }
}
