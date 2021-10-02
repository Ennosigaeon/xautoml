import React from 'react';
import {
    FlexibleXYPlot,
    HorizontalGridLines,
    LabelSeriesPoint,
    VerticalBarSeries,
    VerticalGridLines,
    XAxis,
    YAxis
} from 'react-vis';
import {FeatureImportance, requestFeatureImportance} from "../handler";
import {Candidate, MetaInformation} from "../model";
import {LoadingIndicator} from "./loading";


interface FeatureImportanceProps {
    candidate: Candidate
    component: string
    meta: MetaInformation
}

interface FeatureImportanceState {
    data: Map<string, FeatureImportance>
}


export class FeatureImportanceComponent extends React.Component<FeatureImportanceProps, FeatureImportanceState> {

    constructor(props: FeatureImportanceProps) {
        super(props);

        this.state = {data: new Map<string, FeatureImportance>()}
    }

    componentDidMount() {
        this.queryFeatureImportance()
    }

    componentDidUpdate(prevProps: Readonly<FeatureImportanceProps>, prevState: Readonly<FeatureImportanceState>, snapshot?: any) {
        if (prevProps.component !== this.props.component)
            this.queryFeatureImportance()
    }

    private queryFeatureImportance() {
        const {candidate, meta, component} = this.props
        if (!component || this.state.data.has(component))
            return

        const promise = requestFeatureImportance(candidate.id, meta.data_file, meta.model_dir, component)

        promise
            .then(data => this.setState((state) => ({data: state.data.set(component, data)})))
            .catch(reason => {
                // TODO handle error
                console.error(`Failed to fetch FeatureImportance data.\n${reason}`)
            });
    }

    render() {
        const {data} = this.state
        const {component} = this.props

        const bars: LabelSeriesPoint[] = []
        data.get(component)?.forEach((value, key) => {
            // @ts-ignore
            bars.push({x: key, y: value})
        })

        return (
            <div style={{height: '300px'}}>
                <LoadingIndicator loading={!data}/>
                {!!data &&
                <FlexibleXYPlot xType="ordinal" style={{paddingBottom: '50px'}}>
                    <VerticalGridLines/>
                    <HorizontalGridLines/>
                    <XAxis tickLabelAngle={315}/>
                    <YAxis/>
                    <VerticalBarSeries data={bars} barWidth={0.75}/>
                </FlexibleXYPlot>
                }
            </div>
        );
    }
}
