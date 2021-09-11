import * as d3 from "d3";
import * as cpc from "./model";
import React from "react";
import {PCChoice} from "./pc_choice";
import {ParCord} from "./util";

interface CPCAxisProps {
    axis: cpc.Axis

    xScale: d3.ScaleBand<string>
    yRange: [number, number]
}

export class PCAxis extends React.Component<CPCAxisProps, {}> {

    static readonly PADDING = 10

    private readonly yScale: d3.ScalePoint<string> | d3.ScaleLinear<number, any>

    constructor(props: CPCAxisProps) {
        super(props);

        const {axis, yRange} = this.props
        const adjustedYRange: [number, number] = [yRange[0], yRange[1] - 2 * PCAxis.PADDING]

        this.yScale = axis.isNumerical() ? d3.scaleLinear(axis.domain.toD3(), adjustedYRange) : ParCord.yScale(axis.choices, adjustedYRange)
    }

    isNumerical(): boolean {
        return this.props.axis.type == cpc.Type.NUMERICAL;
    }

    isCategorical(): boolean {
        return this.props.axis.type == cpc.Type.CATEGORICAL;
    }

    render() {
        const {axis, xScale} = this.props

        const x = xScale(axis.id)
        const y = this.yScale.range()[0]
        const width = axis.getWidthWeight() * xScale.bandwidth()
        const height = this.yScale.range()[1] - this.yScale.range()[0]

        const path = d3.path();
        path.moveTo(x + width / 2, y + 20);
        path.lineTo(x + width / 2, y + height);
        path.closePath();

        const choices = axis.choices.map(c => <PCChoice choice={c} parent={axis}
                                                        xRange={[x, x + width]}
                                                        yScale={this.yScale as d3.ScaleBand<string>}/>)

        return (
            <>
                <g id={`axis-${axis.id}`} transform={`translate(0, ${PCAxis.PADDING})`}>
                    <rect className={'axis_container'} x={x} y={y} width={width} height={height}
                          style={{fill: 'none', stroke: 'black', strokeWidth: '1px'}}/>
                    <path d={path.toString()} stroke={'red'} strokeWidth={'1px'}/>
                    <text className={'axis_label'} x={x + width / 2} y={y + 15}
                          textAnchor={'middle'}>{this.props.axis.label}</text>
                    {choices}
                </g>
            </>
        )
    };
}

