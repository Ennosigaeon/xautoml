import React from 'react';
import {
    FlexibleWidthXYPlot,
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
import {ErrorIndicator} from "../../util/error";
import {Colors} from "../../util";
import {AdditionalFeatureWarning} from "../../util/warning";


interface FeatureImportanceProps {
    model: DetailsModel
    height: number
}

interface FeatureImportanceState {
    data: Map<string, FeatureImportance>
    error: Error
}

export class FeatureImportanceComponent extends React.Component<FeatureImportanceProps, FeatureImportanceState> {

    static HELP = 'The permutation feature importance is defined to be the decrease in a model score when a single ' +
        'feature value is randomly shuffled. This procedure breaks the relationship between the feature and the ' +
        'target, thus the drop in the model score is indicative of how much the model depends on the feature.'

    constructor(props: FeatureImportanceProps) {
        super(props);

        this.state = {data: new Map<string, FeatureImportance>(), error: undefined}
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

        this.setState({error: undefined})
        const promise = requestFeatureImportance(candidate.id, meta.data_file, meta.model_dir, component)

        promise
            .then(data => this.setState((state) => ({data: state.data.set(component, data)})))
            .catch(error => {
                console.error(`Failed to fetch FeatureImportance data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });
    }

    render() {
        const {data, error} = this.state
        const {component} = this.props.model

        const bars: LabelSeriesPoint[] = []
        let maxLabelLength = 35
        data.get(component)?.data.forEach((value, key) => {
            // @ts-ignore
            bars.push({x: key, y: value})
            maxLabelLength = Math.max(maxLabelLength, key.length * 5)
        })

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error &&
                <>
                    <LoadingIndicator loading={bars.length === 0}/>
                    {bars.length > 0 &&
                    <>
                        {data.get(component).additional_features && <AdditionalFeatureWarning/>}
                        <FlexibleWidthXYPlot height={this.props.height} xType="ordinal"
                                             margin={{bottom: maxLabelLength}}>
                            <VerticalGridLines/>
                            <HorizontalGridLines/>
                            <XAxis tickLabelAngle={330}/>
                            <YAxis/>
                            <VerticalBarSeries data={bars} barWidth={0.75} color={Colors.DEFAULT}/>
                        </FlexibleWidthXYPlot>
                    </>
                    }
                </>
                }
            </>
        );
    }
}
