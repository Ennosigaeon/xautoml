import React from "react";
import {
    ChartLabel,
    FlexibleWidthXYPlot,
    HorizontalBarSeries,
    HorizontalGridLines,
    VerticalBarSeries,
    VerticalGridLines,
    XAxis,
    YAxis
} from "react-vis";
import {CancelablePromise, CanceledPromiseError, Label, LimeResult, requestLimeApproximation} from "../../handler";
import {Colors} from "../../util";
import {LoadingIndicator} from "../loading";
import {DetailsModel} from "./model";
import {ErrorIndicator} from "../../util/error";
import {CollapseComp} from "../../util/collapse";
import {AdditionalFeatureWarning} from "../../util/warning";


interface LimeProps {
    model: DetailsModel
}

interface LimeState {
    selectedLabel: Label
    pendingRequest: CancelablePromise<LimeResult>
    data: LimeResult
    error: Error
}

export class LimeComponent extends React.Component<LimeProps, LimeState> {

    static HELP = 'LIME, the acronym for local interpretable model-agnostic explanations, is a technique that ' +
        'approximates any black box machine learning model with a local, interpretable model to explain each ' +
        'individual prediction. The algorithm perturbs the original data points, feed them into the black box model, ' +
        'and then observe the corresponding outputs. The method then weighs those new data points as a function of ' +
        'their proximity to the original point. Ultimately, it fits a linear regression on the dataset with ' +
        'variations using those sample weights.'

    constructor(props: LimeProps) {
        super(props);
        this.state = {selectedLabel: undefined, pendingRequest: undefined, data: undefined, error: undefined}

        this.onLabelClick = this.onLabelClick.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<LimeProps>, prevState: Readonly<LimeState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component ||
            prevProps.model.selectedSample !== this.props.model.selectedSample)
            this.queryLime(this.props.model.selectedSample)
    }

    private queryLime(idx: number) {
        if (this.state.pendingRequest !== undefined) {
            // Request for data is currently still pending. Cancel previous request.
            this.state.pendingRequest.cancel()
        }

        const {candidate, meta, component} = this.props.model
        if (component === undefined || idx === undefined)
            return

        const promise = requestLimeApproximation(candidate.id, idx, meta.data_file, meta.model_dir, component)
        this.setState({pendingRequest: promise, data: undefined, selectedLabel: undefined, error: undefined})

        promise
            .then(data => this.setState({data: data, pendingRequest: undefined, selectedLabel: data.label}))
            .catch(error => {
                if (!(error instanceof CanceledPromiseError)) {
                    console.error(`Failed to fetch LimeResult data.\n${error.name}: ${error.message}`)
                    this.setState({error: error, pendingRequest: undefined})
                } else {
                    console.log('Cancelled promise due to user request')
                }
            });
    }

    private onLabelClick(point: any) {
        const label = point.x
        this.setState({selectedLabel: label})
    }

    render() {
        const {selectedSample} = this.props.model
        const {selectedLabel, data, pendingRequest, error} = this.state

        const probs: any[] = []
        data?.prob.forEach((p, label) => probs.push({x: label, y: p, color: +(label == selectedLabel)}))

        let maxLabelLength = 0
        const expl: any[] = data?.expl.get(selectedLabel.toString())
            ?.map(([label, score]) => {
                maxLabelLength = Math.max(maxLabelLength, label.length * 6)
                return {x: score, y: label}
            })
            .reverse()

        const nrExpl = data?.expl.get(selectedLabel.toString())?.length
        const labelHeight = 23

        return (
            <div className={'lime'} style={{height: '100%'}}>
                <h4>Local Approximation</h4>
                <ErrorIndicator error={error}/>
                {!error &&
                <>
                    <LoadingIndicator loading={!!pendingRequest}/>

                    {!pendingRequest && !selectedSample &&
                    <p>Select a data set sample to calculate a local model approximation (LIME).</p>
                    }

                    {data?.categorical_input &&
                    <ErrorIndicator error={{
                        name: "Calculation Failed",
                        message: 'Calculation of LIME failed, probably due to categorical input. If the selected data frame ' +
                            'contains any categorical features, please select a later stage in the pipeline after imputation ' +
                            'being applied. See the <a class="hyperlink" ' +
                            'href="https://marcotcr.github.io/lime/tutorials/Tutorial%20-%20continuous%20and%20categorical%20features.html">LIME ' +
                            'documentation</a> for more information.'
                    }}/>
                    }

                    {!data?.categorical_input && data?.expl.size === 0 &&
                    <p>LIME explanations are not available for the actual predictions.</p>
                    }

                    {data?.expl.size > 0 &&
                    <div style={{minWidth: "200px"}}>
                        {data.additional_features && <AdditionalFeatureWarning/>}
                        <CollapseComp showInitial={true}>
                            <h5>Predicted Class Probabilities</h5>
                            <>
                                <FlexibleWidthXYPlot
                                    xType="ordinal"
                                    height={200}
                                    colorRange={[Colors.DEFAULT, Colors.HIGHLIGHT]}
                                    style={{flexGrow: 1}}
                                >
                                    <VerticalGridLines/>
                                    <HorizontalGridLines/>
                                    <XAxis/>
                                    <YAxis/>
                                    <VerticalBarSeries
                                        barWidth={0.75}
                                        data={probs}
                                        onValueClick={this.onLabelClick}
                                    />
                                </FlexibleWidthXYPlot>
                                <p>Correct Class: {data.label}</p>
                            </>
                        </CollapseComp>

                        <CollapseComp showInitial={true}>
                            <h5>Explanations for Class {selectedLabel}</h5>
                            <FlexibleWidthXYPlot
                                yType="ordinal"
                                height={nrExpl * 30}
                                margin={{left: maxLabelLength, top: labelHeight}}
                            >
                                <VerticalGridLines/>
                                <HorizontalGridLines/>
                                <XAxis/>
                                <YAxis/>
                                <HorizontalBarSeries
                                    barWidth={0.75}
                                    data={expl}
                                    color={Colors.DEFAULT}
                                />

                                <ChartLabel
                                    text={`Not ${selectedLabel}`}
                                    includeMargin={false}
                                    xPercent={0}
                                    yPercent={(1.5 * labelHeight) / (nrExpl * 30)}
                                />
                                <ChartLabel
                                    text={selectedLabel.toString()}
                                    includeMargin={false}
                                    xPercent={0.9}
                                    yPercent={(1.5 * labelHeight) / (nrExpl * 30)}
                                />
                            </FlexibleWidthXYPlot>
                        </CollapseComp>
                    </div>
                    }
                </>}
            </div>
        )
    }
}
