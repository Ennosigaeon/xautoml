import * as d3 from "d3";
import * as cpc from "./model";
import React from "react";
import {PCChoice} from "./pc_choice";
import {fixedPrec} from "../../util";
import {Constants} from "./constants";

interface CPCAxisProps {
    axis: cpc.Axis
    parent: cpc.Choice

    onExpand: (choice: cpc.Choice) => void
    onCollapse: (choice: cpc.Choice) => void
}

interface CPCAxisState {
    hover: boolean
}

export class PCAxis extends React.Component<CPCAxisProps, CPCAxisState> {

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
        path.moveTo(x - 0.8 * Constants.TICK_LENGTH, y)
        path.lineTo(x, y)
        path.closePath()
        return path
    }

    render() {
        const {axis, onExpand, onCollapse} = this.props
        const {y, height, yScale} = axis.getLayout()
        const centeredX = axis.getLayout().centeredX()

        const path = d3.path();
        path.moveTo(centeredX, y);
        path.lineTo(centeredX, y + height);
        path.closePath();

        const choices = axis.choices.map(c => <PCChoice choice={c} parent={axis}
                                                        onExpand={onExpand}
                                                        onCollapse={onCollapse}/>)

        const ticks = this.isNumerical() ?
            [...Array(Constants.TICK_COUNT)].map((_, i) => {
                const v = axis.domain.min + i * (axis.domain.max - axis.domain.min) / (Constants.TICK_COUNT - 1)
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
                            <path d={PCAxis.tickPath(centeredX, v.pos).toString()}/>
                            <text x={centeredX - Constants.TICK_LENGTH}
                                  y={v.pos}
                                  className={'pc-axis-tick'}>
                                {fixedPrec(v.value)}
                            </text>
                        </>
                    )}

                    <text x={centeredX} y={y - 0.5 * Constants.TEXT_HEIGHT} textAnchor={'middle'}>{axis.label}</text>
                    {choices}
                </g>
            </>
        )
    };
}

