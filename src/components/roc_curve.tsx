import React from "react";
import {CandidateId, MetaInformation} from "../model";
import {requestRocCurve} from "../handler";
import {
    DiscreteColorLegend,
    HorizontalGridLines,
    LineSeries,
    makeHeightFlexible, makeWidthFlexible,
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
    loading: boolean
    data: any
}

export class RocCurve extends React.Component<RocCurveProps, RocCurveState> {

    constructor(props: RocCurveProps) {
        super(props)

        this.state = {loading: false, data: undefined}
    }

    componentDidUpdate(prevProps: Readonly<RocCurveProps>, prevState: Readonly<RocCurveState>, snapshot?: any) {
        if (prevProps.selectedCandidates !== this.props.selectedCandidates) {
            // TODO fetch only new curves
            // TODO remove odl curves without recalculation
            if (this.props.selectedCandidates.length > 0) {
                this.setState({loading: true})
                requestRocCurve(this.props.selectedCandidates, this.props.meta.data_file, this.props.meta.model_dir)
                    .then(data => {
                        this.setState({data: data})
                        console.log(data);
                    })
                    .catch(reason => {
                        console.error(`Failed to fetch Roc Curve data.\n${reason}`);
                    });
            } else {
                this.setState({data: undefined})
            }
        }
    }

    render() {
        if (!!this.state.data) {
            const labels: string[] = []
            const data: any[] = []
            Object.entries<any>(this.state.data).map(s => {
                labels.push(s[0])
                data.push(s[1])
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
        } else if (this.state.loading)
            return <LoadingIndicator loading={this.state.loading}/>
        else
            return <p>No Configuration selected</p>
    }
}