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
import {FeatureImportance, requestFeatureImportance} from "../../handler";
import {LoadingIndicator} from "../loading";
import {DetailsModel} from "./model";


interface FeatureImportanceProps {
    model: DetailsModel
    height: number
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
        if (prevProps.model.component !== this.props.model.component)
            this.queryFeatureImportance()
    }

    private queryFeatureImportance() {
        const {candidate, meta, component} = this.props.model
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
        const {component} = this.props.model

        const bars: LabelSeriesPoint[] = []
        let maxLabelLength = 0
        data.get(component)?.forEach((value, key) => {
            // @ts-ignore
            bars.push({x: key, y: value})
            maxLabelLength = Math.max(maxLabelLength, key.length * 5)
        })

        return (
            <>
                <h4>Feature Importance</h4>
                <LoadingIndicator loading={bars.length === 0}/>
                {bars.length > 0 &&
                <div style={{height: `${this.props.height}px`}}>
                    <FlexibleXYPlot xType="ordinal" margin={{bottom: maxLabelLength}}>
                        <VerticalGridLines/>
                        <HorizontalGridLines/>
                        <XAxis tickLabelAngle={330}/>
                        <YAxis/>
                        <VerticalBarSeries data={bars} barWidth={0.75}/>
                    </FlexibleXYPlot>
                </div>
                }
            </>
        );
    }
}