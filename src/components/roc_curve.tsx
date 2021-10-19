import React from "react";
import {CandidateId, MetaInformation} from "../model";
import {CancelablePromise, CanceledPromiseError, requestRocCurve, RocCurveData} from "../handler";
import {
    DiscreteColorLegend,
    FlexibleWidthXYPlot,
    HorizontalGridLines,
    LineSeries,
    LineSeriesPoint,
    VerticalGridLines,
    XAxis,
    YAxis
} from "react-vis";
import 'react-vis/dist/style.css'
import {LoadingIndicator} from "./loading";
import {ErrorIndicator} from "../util/error";


interface RocCurveProps {
    selectedCandidates: Set<CandidateId>
    meta: MetaInformation
}

interface RocCurveState {
    data: Map<string, LineSeriesPoint[]>
    pendingRequest: CancelablePromise<RocCurveData>
    error: Error
}

export class RocCurve extends React.Component<RocCurveProps, RocCurveState> {

    constructor(props: RocCurveProps) {
        super(props)

        this.state = {data: new Map<string, LineSeriesPoint[]>(), pendingRequest: undefined, error: undefined}
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
                this.setState({data: new Map<string, LineSeriesPoint[]>(), pendingRequest: undefined})
                newCandidates = Array.from(this.props.selectedCandidates)
            }

            // Fetch new selected candidates
            if (newCandidates.length > 0) {
                const promise = requestRocCurve(newCandidates, this.props.meta.data_file, this.props.meta.model_dir)
                this.setState({pendingRequest: promise, error: undefined})

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
        }
    }

    render() {
        const {data, pendingRequest, error} = this.state

        let content: JSX.Element
        if (data.size > 0) {
            const labels: string[] = []
            const data: any[] = []
            this.state.data.forEach((v, k) => {
                labels.push(k)
                data.push(v)
            })

            // @ts-ignore
            const legend = <DiscreteColorLegend style={{position: 'absolute', right: '10px', bottom: '55px'}}
                                                items={labels}/>

            content = (
                <FlexibleWidthXYPlot height={300}>
                    <HorizontalGridLines/>
                    <VerticalGridLines/>
                    <XAxis title="False Positive Rate"/>
                    <YAxis title="True Positive Rate"/>

                    {data.map((s, idx) => <LineSeries key={labels[idx]} data={s}/>)}
                    {labels.length < 15 && legend}
                </FlexibleWidthXYPlot>
            )
        } else if (pendingRequest !== undefined)
            content = <LoadingIndicator loading={true}/>
        else
            content = <p>No Configuration selected</p>

        return (
            <>
                <h4>ROC Curve</h4>
                <ErrorIndicator error={error}/>
                {!error && content}
            </>
        )
    }
}
