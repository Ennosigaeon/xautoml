import * as d3 from "d3";
import {linkHorizontal, linkVertical} from "d3";
import * as cpc from "./model";
import {Layout} from "./model";
import React from "react";
import {PCChoice} from "./pc_choice";
import {Colors, prettyPrint} from "../../util";
import {Constants} from "./constants";
import {BrushEvent, SVGBrush} from "./brush";
import {v4 as uuidv4} from "uuid";


interface DiscretePerfEstProps {
    xScale: d3.ScaleContinuousNumeric<number, number>
    choices: cpc.Choice[]
    perfEstimate: [number, number][]
}

class DiscretePerfEstimates extends React.Component<DiscretePerfEstProps, {}> {

    renderSingle(layout: Layout, scale: d3.ScaleContinuousNumeric<number, number>, performance: [number, number]) {
        const {y, height} = layout
        const centeredX = layout.centeredX()

        const perf = performance === undefined ? [0, scale.domain()[0]] : performance
        return (
            <rect key={perf[0]} className={'pc-importance'} fill={Colors.DEFAULT}
                  x={centeredX} y={y + height * 0.1} width={scale(perf[1])} height={height * 0.8}/>
        )
    }

    render() {
        const {xScale, choices, perfEstimate} = this.props
        if (perfEstimate === undefined)
            return <></>

        return (
            <>
                {choices.filter(c => c.isCollapsed())
                    .map((c, i) => this.renderSingle(c.getLayout(), xScale, this.props.perfEstimate[i]))}
            </>
        )
    }
}

interface ContinuousPerfEstProps {
    xScale: d3.ScaleContinuousNumeric<number, number>
    yScale: d3.ScaleContinuousNumeric<number, number>
    layout: Layout
    perfEstimate: [number, number][]
}

class ContinuousPerfEstimate extends React.Component<ContinuousPerfEstProps, {}> {

    render() {
        const {xScale, yScale, layout, perfEstimate} = this.props
        const centeredX = layout.centeredX()
        if (perfEstimate === undefined)
            return <></>

        const line = d3.area()
            .curve(d3.curveCardinal)
            .x0(() => centeredX)
            .x1(d => centeredX + xScale(d[1]))
            .y(d => yScale(d[0]))

        return (
            <path className={'pc-importance'} d={line(perfEstimate)} fill={Colors.DEFAULT}/>
        )
    }
}


interface AxisProps {
    direction: 'x' | 'y'
    layout: Layout
    xScale: d3.ScaleContinuousNumeric<number, number>
    showTicks: boolean
}

class Axis extends React.Component<AxisProps, {}> {

    private tickPath(x: number, y: number): d3.Path {
        const path = d3.path()
        if (this.props.direction == 'y') {
            path.moveTo(x - 0.8 * Constants.TICK_LENGTH, y)
        } else {
            path.moveTo(x, y + 0.8 * Constants.TICK_LENGTH)
        }
        path.lineTo(x, y)
        path.closePath()
        return path
    }

    private ticks(scale: d3.ScaleContinuousNumeric<number, number>, tickCount: number) {
        const range = scale.range()
        return [...Array(tickCount)].map((_, i) => {
            const v = range[0] + i * (range[1] - range[0]) / (tickCount - 1)
            return {value: scale.invert(v), pos: v}
        })
    }

    renderYAxis() {
        const {y, height, yScale} = this.props.layout
        const centeredX = this.props.layout.centeredX()
        const yTicks = this.props.showTicks ? this.ticks((yScale as d3.ScaleContinuousNumeric<number, number>), 4) : []

        return (
            <>
                <path d={linkVertical().x(d => d[0]).y(d => d[1])({
                    source: [centeredX, y],
                    target: [centeredX, y + height]
                })}/>
                {yTicks.map(v =>
                    <>
                        <path d={this.tickPath(centeredX, v.pos).toString()}/>
                        <text x={centeredX - Constants.TICK_LENGTH}
                              y={v.pos}
                              className={'pc-axis-tick pc-axis-y-tick'}>
                            {prettyPrint(v.value)}
                        </text>
                    </>
                )}
            </>
        )
    }

    renderXAxis() {
        const {x, y, width, height} = this.props.layout
        const centeredX = this.props.layout.centeredX()
        const xTicks = this.ticks(this.props.xScale, 3)

        return (
            <>
                <path d={linkHorizontal().x(d => d[0]).y(d => d[1])({
                    source: [centeredX, y + height],
                    target: [x + width, y + height]
                })}/>
                {xTicks.map(v =>
                    <>
                        <path d={this.tickPath(centeredX + v.pos, y + height).toString()}/>
                        <text x={centeredX + v.pos}
                              y={y + height + Constants.TICK_LENGTH}
                              className={'pc-axis-tick pc-axis-x-tick'}>
                            {prettyPrint(v.value, 2)}
                            <title>{prettyPrint(v.value, 5)}</title>
                        </text>
                    </>
                )}
            </>
        )
    }

    render() {
        if (this.props.direction === 'x')
            return this.renderXAxis()
        else
            return this.renderYAxis()
    }

}

interface CPCAxisProps {
    axis: cpc.Axis
    parent: cpc.Choice

    onExpand: (choice: cpc.Choice) => void
    onCollapse: (choice: cpc.Choice) => void
    onHighlight: (axis: cpc.Axis, selection: cpc.Choice | [number, number]) => void
    onClick: (axis: cpc.Axis) => void
}

interface CPCAxisState {
    hover: boolean
}

export class PCAxis extends React.Component<CPCAxisProps, CPCAxisState> {

    private static readonly STEP_AXIS = /^\d+\..+/;

    static contextType = cpc.CPCContext;
    context: React.ContextType<typeof cpc.CPCContext>;

    constructor(props: CPCAxisProps) {
        super(props);
        this.state = {hover: false}

        this.collapse = this.collapse.bind(this)
        this.onBrushEnd = this.onBrushEnd.bind(this)
    }

    private isNumerical(): boolean {
        return this.props.axis.type == cpc.Type.NUMERICAL;
    }

    private collapse(e: React.MouseEvent) {
        const {parent, onCollapse} = this.props

        if (!parent.isCollapsed())
            onCollapse(parent)

        e.preventDefault()
        e.stopPropagation()
    }

    private onBrushEnd(event: BrushEvent) {
        this.props.onHighlight(this.props.axis, event.selection)
    }

    render() {
        const {axis, onExpand, onCollapse, onHighlight, onClick} = this.props
        const {x, y, width, yScale} = axis.getLayout()
        const explanation = this.context.model.getExplanations(axis)

        const xScale = axis.getLayout().perfEstScale(explanation)

        const choices = axis.choices.map(c => <PCChoice choice={c} parent={axis}
                                                        onExpand={onExpand}
                                                        onCollapse={onCollapse}
                                                        onHighlight={onHighlight}
                                                        onAxisSelection={onClick}/>)

        const id = `path-${uuidv4()}`
        const selectableTitle = (axis.isNumerical() || (choices.length > 1 && !PCAxis.STEP_AXIS.test(axis.id))) &&
            axis.id !== '__performance__'

        if (!axis.isNumerical() && choices.length === 0)
            return <></>

        return (
            <g className={'pc-axis'} onClick={this.collapse}>
                <Axis direction={'y'} layout={axis.getLayout()} showTicks={this.isNumerical()} xScale={xScale}/>
                {(this.context.showExplanations && explanation) && <>
                    <Axis direction={'x'} layout={axis.getLayout()} showTicks={true} xScale={xScale}/>
                    {this.isNumerical() ?
                        <ContinuousPerfEstimate xScale={xScale}
                                                yScale={(yScale as d3.ScaleContinuousNumeric<number, number>)}
                                                layout={axis.getLayout()}
                                                perfEstimate={explanation}/> :
                        <DiscretePerfEstimates xScale={xScale} choices={axis.choices}
                                               perfEstimate={explanation}/>}
                </>}

                {this.isNumerical() && <SVGBrush svg={this.context.svg}
                                                 layout={axis.getLayout()}
                                                 onBrushEnd={this.onBrushEnd}
                />}

                <text
                    className={`${selectableTitle ? 'pc-axis-label' : ''} ${this.context.selectedAxis.has(axis.id) ? 'selected' : ''}`}
                    onClick={(e) => {
                        if (selectableTitle)
                            onClick(axis)
                        e.stopPropagation()
                    }}>
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
        )
    };
}

