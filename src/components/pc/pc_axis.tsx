import * as d3 from "d3";
import {linkHorizontal, linkVertical} from "d3";
import * as cpc from "./model";
import React from "react";
import {PCChoice} from "./pc_choice";
import {prettyPrint} from "../../util";
import {Constants} from "./constants";
import {v4 as uuidv4} from "uuid";

interface CPCAxisProps {
    axis: cpc.Axis
    parent: cpc.Choice

    onExpand: (choice: cpc.Choice) => void
    onCollapse: (choice: cpc.Choice) => void
    onChoiceHover: (axis: cpc.Axis, choice: cpc.Choice) => void
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
        const {axis, onExpand, onCollapse, onChoiceHover} = this.props
        const {x, y, width, height, yScale} = axis.getLayout()
        const centeredX = axis.getLayout().centeredX()

        const choices = axis.choices.map(c => <PCChoice choice={c} parent={axis}
                                                        onExpand={onExpand}
                                                        onCollapse={onCollapse}
                                                        onChoiceHover={onChoiceHover}/>)

        const range = yScale.range()
        const ticks = this.isNumerical() ?
            [...Array(Constants.TICK_COUNT)].map((_, i) => {
                const v = range[0] + i * (range[1] - range[0]) / (Constants.TICK_COUNT - 1)
                return {
                    value: (yScale as d3.ScaleContinuousNumeric<number, number>).invert(v),
                    pos: v
                }
            }) : []
        const id = `path-${uuidv4()}`

        return (
            <>
                <g id={`axis-${axis.id}`} className={'pc-axis'} onClick={this.collapse}>
                    <path d={linkVertical().x(d => d[0]).y(d => d[1])({
                        source: [centeredX, y],
                        target: [centeredX, y + height]
                    })}/>

                    {ticks.map(v =>
                        <>
                            <path d={PCAxis.tickPath(centeredX, v.pos).toString()}/>
                            <text x={centeredX - Constants.TICK_LENGTH}
                                  y={v.pos}
                                  className={'pc-axis-tick'}>
                                {prettyPrint(v.value)}
                            </text>
                        </>
                    )}

                    <text>
                        <path id={id} d={
                            linkHorizontal().x(d => d[0]).y(d => d[1])({
                                source: [x, y - 0.5 * Constants.TEXT_HEIGHT],
                                target: [x + width, y - 0.5 * Constants.TEXT_HEIGHT]
                            })}/>
                        <textPath xlinkHref={`#${id}`} startOffset={'50%'} textAnchor={'middle'}>
                            {axis.label}
                            <title>{axis.label}</title>
                        </textPath>
                    </text>

                    {choices}
                </g>
            </>
        )
    };
}

