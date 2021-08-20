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
import {Label, LimeResult} from "../handler";
import {Colors} from "../util";


interface LimeProps {
    result: LimeResult
}

interface LimeState {
    selectedLabel: Label
}

// TODO currently LIME always generates explanations for original dataset. Maybe better to actually use features after processing by selected component
export class LimeComponent extends React.Component<LimeProps, LimeState> {

    constructor(props: LimeProps) {
        super(props);
        this.state = {selectedLabel: props.result.label}

        this.onLabelClick = this.onLabelClick.bind(this)
    }

    private onLabelClick(point: any) {
        const label = point.x
        this.setState({selectedLabel: label})
    }

    render() {
        const {result} = this.props
        const {selectedLabel} = this.state

        const probs: any[] = []
        result.prob.forEach((p, label) => probs.push({x: label, y: p, color: +(label == selectedLabel)}))

        let maxLabelLength = 0
        const expl: any[] = result.expl.get(selectedLabel.toString())
            .map(([label, score]) => {
                maxLabelLength = Math.max(maxLabelLength, label.length * 7)
                return {x: score, y: label}
            })
            .reverse()

        // @ts-ignore
        const tickFormat: RVTickFormat = (tick: string) => tick == result.label ?
            <tspan fontSizeAdjust={1} fontWeight={'bold'}>{tick}</tspan> : tick

        return (
            <div className={'lime'} style={{height: '100%'}}>
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
            </div>
        )
    }
}
