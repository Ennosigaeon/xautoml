import React from "react";
import {CandidateId, MetaInformation} from "../model";
import {CancelablePromise, CanceledPromiseError, requestRocCurve, RocCurveData} from "../handler";
import {
    DiscreteColorLegend,
    HorizontalGridLines,
    LineSeries,
    LineSeriesPoint,
    makeHeightFlexible,
    makeWidthFlexible,
    VerticalGridLines,
    XAxis,
    XYPlot,
    YAxis
} from "react-vis";
import 'react-vis/dist/style.css'
import {LoadingIndicator} from "./loading";


interface RocCurveProps {
    selectedCandidates: CandidateId[]
    meta: MetaInformation
}

interface RocCurveState {
    data: Map<string, LineSeriesPoint[]>
    pendingRequest: CancelablePromise<RocCurveData>
}

export class RocCurve extends React.Component<RocCurveProps, RocCurveState> {

    constructor(props: RocCurveProps) {
        super(props)

        this.state = {data: new Map<string, LineSeriesPoint[]>(), pendingRequest: undefined}
    }

    componentDidUpdate(prevProps: Readonly<RocCurveProps>, prevState: Readonly<RocCurveState>, snapshot?: any) {
        if (prevProps.selectedCandidates !== this.props.selectedCandidates) {
            let newCandidates: CandidateId[]
            if (this.state.pendingRequest === undefined) {
                // Remove previously selected candidates
                const superfluousCandidates = prevProps.selectedCandidates.filter(c => this.props.selectedCandidates.indexOf(c) === -1)
                const currentCandidates = this.state.data
                const currentKeys = Array.from(currentCandidates.keys())
                superfluousCandidates.forEach(c => {
                    currentKeys.filter(k => k.startsWith(c)).forEach(k => currentCandidates.delete(k))
                })
                this.setState({data: currentCandidates})
                newCandidates = this.props.selectedCandidates.filter(c => prevProps.selectedCandidates.indexOf(c) === -1)
            } else {
                // Request for data is currently still pending. Erase complete state and load everything from scratch to
                // prevent incoherent states
                this.state.pendingRequest.cancel()
                this.setState({data: new Map<string, LineSeriesPoint[]>(), pendingRequest: undefined})
                newCandidates = this.props.selectedCandidates
            }

            // Fetch new selected candidates
            if (newCandidates.length > 0) {
                const promise = requestRocCurve(newCandidates, this.props.meta.data_file, this.props.meta.model_dir)
                this.setState({pendingRequest: promise})

                promise
                    .then(data => {
                        const currentCandidates = this.state.data
                        data.forEach((v, k) => currentCandidates.set(k, v))
                        this.setState({data: currentCandidates, pendingRequest: undefined})
                    })
                    .catch(reason => {
                        if (!(reason instanceof CanceledPromiseError)) {
                            // TODO handle error
                            console.error(`Failed to fetch Roc Curve data.\n${reason}`)
                            this.setState({pendingRequest: undefined})
                        } else {
                            console.log('Cancelled promise due to user request')
                        }
                    });
            }
        }
    }

    render() {
        if (this.state.data.size > 0) {
            const labels: string[] = []
            const data: any[] = []
            this.state.data.forEach((v, k) => {
                labels.push(k)
                data.push(v)
            })

            // @ts-ignore
            const legend = <DiscreteColorLegend style={{position: 'absolute', right: '10px', bottom: '55px'}}
                                                items={labels}/>

            const FlexibleXYPlot = makeHeightFlexible(makeWidthFlexible(XYPlot))
            return (
                <FlexibleXYPlot>
                    <HorizontalGridLines/>
                    <VerticalGridLines/>
                    <XAxis title="False Positive Rate"/>
                    <YAxis title="True Positive Rate"/>

                    {data.map((s, idx) => <LineSeries key={labels[idx]} data={s}/>)}
                    {labels.length < 15 && legend}
                </FlexibleXYPlot>
            )
        } else if (this.state.pendingRequest !== undefined)
            return <LoadingIndicator loading={true}/>
        else
            return <p>No Configuration selected</p>
    }
}
