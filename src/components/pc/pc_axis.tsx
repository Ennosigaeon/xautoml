import * as d3 from "d3";
import * as cpc from "./model";
import React from "react";
import {PCChoice} from "./pc_choice";
import {ParCord} from "./util";

interface CPCAxisProps {
    axis: cpc.Axis
    parent: cpc.Choice

    onExpand: (choice: cpc.Choice) => void
    onCollapse: (choice: cpc.Choice) => void

    xScale: d3.ScaleBand<string>
    yRange: [number, number]
}

interface CPCAxisState {
    hover: boolean
}

export class PCAxis extends React.Component<CPCAxisProps, CPCAxisState> {

    static readonly TEXT_HEIGHT = 17

    constructor(props: CPCAxisProps) {
        super(props);
        this.state = {hover: false}

        this.collapse = this.collapse.bind(this)
    }

    private isNumerical(): boolean {
        return this.props.axis.type == cpc.Type.NUMERICAL;
    }

    private collapse(e: React.MouseEvent) {
        const {parent, onCollapse} = this.props

        if (!parent.isCollapsed()) {
            onCollapse(parent)
        }

        e.preventDefault()
        e.stopPropagation()
    }

    render() {
        const {axis, xScale, yRange, onExpand, onCollapse} = this.props

        const adjustedYRange: [number, number] = [yRange[0] + 1.5 * PCAxis.TEXT_HEIGHT, yRange[1] - 5]
        const yScale = axis.isNumerical() ? d3.scaleLinear(axis.domain.toD3(), adjustedYRange) : ParCord.yScale(axis.choices, adjustedYRange)

        const x = xScale(axis.id)
        const y = yScale.range()[0]
        const width = axis.getWidthWeight() * xScale.bandwidth()
        const height = yScale.range()[1] - yScale.range()[0]

        const path = d3.path();
        path.moveTo(x + width / 2, y);
        path.lineTo(x + width / 2, y + height);
        path.closePath();

        const choices = axis.choices.map(c => <PCChoice choice={c} parent={axis}
                                                        onExpand={onExpand}
                                                        onCollapse={onCollapse}
                                                        xRange={[x, x + width]}
                                                        yScale={yScale as d3.ScaleBand<string>}/>)

        return (
            <>
                <g id={`axis-${axis.id}`} className={'pc-axis'} onClick={this.collapse}>
                    <path d={path.toString()}/>
                    <text x={x + width / 2} y={yRange[0] + PCAxis.TEXT_HEIGHT} textAnchor={'middle'}>
                        {this.props.axis.label}
                    </text>
                    {choices}
                </g>
            </>
        )
    };
}

