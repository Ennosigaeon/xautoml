import * as d3 from "d3";
import * as cpc from "./model";
import React from "react";
import {PCChoice} from "./pc_choice";
import {ParCord} from "./util";
import {fixedPrec} from "../../util";

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

    private static tickPath(x: number, y: number): d3.Path {
        const path = d3.path()
        path.moveTo(x - 8, y)
        path.lineTo(x, y)
        path.closePath()
        return path
    }

    render() {
        const {axis, xScale, yRange, onExpand, onCollapse} = this.props

        const adjustedYRange: [number, number] = [yRange[0] + 1.5 * PCAxis.TEXT_HEIGHT, yRange[1] - 0.5 * PCAxis.TEXT_HEIGHT]
        const yScale = axis.isNumerical() ? d3.scaleLinear(axis.domain.toD3(), adjustedYRange) : ParCord.yScale(axis.choices, adjustedYRange)

        const x = xScale(axis.id)
        const y = yScale.range()[0]
        const width = axis.getWidthWeight() * xScale.bandwidth()
        const height = yScale.range()[1] - yScale.range()[0]
        const centerX = x + width / 2

        const path = d3.path();
        path.moveTo(centerX, y);
        path.lineTo(centerX, y + height);
        path.closePath();

        const choices = axis.choices.map(c => <PCChoice choice={c} parent={axis}
                                                        onExpand={onExpand}
                                                        onCollapse={onCollapse}
                                                        xRange={[x, x + width]}
                                                        yScale={yScale as d3.ScaleBand<string>}/>)

        const tickCount = 4
        const ticks = this.isNumerical() ?
            [...Array(tickCount)].map((_, i) => {
                const v = axis.domain.min + i * (axis.domain.max - axis.domain.min) / (tickCount - 1)
                return {
                    value: v,
                    pos: (yScale as d3.ScaleLinear<number, number>)(v)
                }
            }) : []

        return (
            <>
                <g id={`axis-${axis.id}`} className={'pc-axis'} onClick={this.collapse}>
                    <path d={path.toString()}/>

                    {ticks.map(v =>
                        <>
                            <path d={PCAxis.tickPath(centerX, v.pos).toString()}/>
                            <text x={centerX - 10} y={v.pos} className={'pc-axis-tick'}>{fixedPrec(v.value)}</text>
                        </>
                    )}

                    <text x={centerX} y={yRange[0] + PCAxis.TEXT_HEIGHT} textAnchor={'middle'}>
                        {this.props.axis.label}
                    </text>
                    {choices}
                </g>
            </>
        )
    };
}

