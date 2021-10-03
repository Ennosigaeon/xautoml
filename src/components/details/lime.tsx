import React from "react";
import {
    ChartLabel,
    FlexibleHeightXYPlot,
    HorizontalBarSeries,
    HorizontalGridLines,
    RVTickFormat,
    VerticalBarSeries,
    VerticalGridLines,
    XAxis,
    YAxis
} from "react-vis";
import {CancelablePromise, CanceledPromiseError, Label, LimeResult, requestLimeApproximation} from "../../handler";
import {Colors} from "../../util";
import {LoadingIndicator} from "../loading";
import {DetailsModel} from "./model";


interface LimeProps {
    model: DetailsModel
}

interface LimeState {
    selectedLabel: Label
    pendingRequest: CancelablePromise<LimeResult>
    data: LimeResult
}

export class LimeComponent extends React.Component<LimeProps, LimeState> {

    constructor(props: LimeProps) {
        super(props);
        this.state = {selectedLabel: undefined, pendingRequest: undefined, data: undefined}

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
        this.setState({pendingRequest: promise, data: undefined, selectedLabel: undefined})

        promise
            .then(data => this.setState({data: data, pendingRequest: undefined, selectedLabel: data.label}))
            .catch(reason => {
                if (!(reason instanceof CanceledPromiseError)) {
                    // TODO handle error
                    console.error(`Failed to fetch LimeResult data.\n${reason}`)
                    this.setState({pendingRequest: undefined})
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
        const {selectedLabel, data, pendingRequest} = this.state

        const probs: any[] = []
        data?.prob.forEach((p, label) => probs.push({x: label, y: p, color: +(label == selectedLabel)}))

        let maxLabelLength = 0
        const expl: any[] = data?.expl.get(selectedLabel.toString())
            ?.map(([label, score]) => {
                maxLabelLength = Math.max(maxLabelLength, label.length * 7)
                return {x: score, y: label}
            })
            .reverse()

        // @ts-ignore
        const tickFormat: RVTickFormat = (tick: string) => tick == data.label ?
            <tspan fontSizeAdjust={1} fontWeight={'bold'}>{tick}</tspan> : tick

        return (
            <div className={'lime'} style={{height: '100%'}}>
                <h4>Local Approximation</h4>
                <LoadingIndicator loading={!!pendingRequest}/>

                {!pendingRequest && !selectedSample &&
                <p>Select a data set sample to calculate a local model approximation (LIME).</p>
                }

                {data?.expl.size === 0 &&
                <p>LIME explanations are not available for the actual predictions.</p>
                }

                {data?.expl.size > 0 &&
                <>
                    <div style={{height: '33%', display: 'flex', flexDirection: 'column'}}>
                        <h5>Predicted Class Probabilities</h5>
                        <FlexibleHeightXYPlot
                            xType="ordinal"
                            width={300}
                            colorRange={[Colors.DEFAULT, Colors.HIGHLIGHT]}
                            style={{flexGrow: 1}}
                        >
                            <VerticalGridLines/>
                            <HorizontalGridLines/>
                            <XAxis tickFormat={tickFormat}/>
                            <YAxis/>
                            <VerticalBarSeries
                                barWidth={0.75}
                                data={probs}
                                onValueClick={this.onLabelClick}
                            />
                        </FlexibleHeightXYPlot>
                    </div>

                    <hr/>

                    <div style={{height: '50%', display: 'flex', flexDirection: 'column'}}>
                        <h5>Explanations for Class {selectedLabel}</h5>
                        <FlexibleHeightXYPlot
                            yType="ordinal"
                            width={300}
                            margin={{left: maxLabelLength, top: 20}}
                            style={{flexGrow: 1}}
                        >
                            <VerticalGridLines/>
                            <HorizontalGridLines/>
                            <XAxis/>
                            <YAxis/>
                            <HorizontalBarSeries
                                barWidth={0.75}
                                data={expl}
                            />

                            <ChartLabel
                                text={`Not ${selectedLabel}`}
                                includeMargin={false}
                                xPercent={-0.33}
                                yPercent={0.05}
                            />
                            <ChartLabel
                                text={selectedLabel.toString()}
                                includeMargin={false}
                                xPercent={0.9}
                                yPercent={0.05}
                            />
                        </FlexibleHeightXYPlot>
                    </div>
                </>
                }
            </div>
        )
    }
}
