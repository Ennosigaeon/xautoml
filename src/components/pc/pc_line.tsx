import * as d3 from "d3";
import * as cpc from "./model";
import React from "react";
import {fixedPrec} from "../../util";
import {CandidateId} from "../../model";
import {Constants} from "./constants";
import memoizeOne from "memoize-one";

interface PCLineProps {
    line: cpc.Line
    selected: boolean
    highlight: boolean
    missing: boolean
    onClick?: (id: CandidateId) => void,
    onAlternativeClick?: (id: CandidateId) => void
}

interface PCLineStats {
    selected: boolean
}

interface Tooltip {
    x: number
    y: number
    text: number
}

export class PCLine extends React.Component<PCLineProps, PCLineStats> {

    static defaultProps = {
        onClick: () => {
        },
        onAlternativeClick: () => {
        }
    }

    static contextType = cpc.CPCContext;
    context: React.ContextType<typeof cpc.CPCContext>;

    constructor(props: PCLineProps) {
        super(props)
        this.state = {selected: false}

        this.onMouseEnter = this.onMouseEnter.bind(this)
        this.onMouseLeave = this.onMouseLeave.bind(this)
        this.onClick = this.onClick.bind(this)
    }

    private onMouseEnter() {
        this.setState(() => ({selected: true}));
    }

    private onMouseLeave() {
        this.setState(() => ({selected: false}));
    }

    private onClick(e: React.MouseEvent) {
        if (e.ctrlKey)
            this.props.onAlternativeClick(this.props.line.id)
        else
            this.props.onClick(this.props.line.id)
        e.stopPropagation()
    }

    private renderPath(_: number): [d3.Path, d3.Path, Array<Tooltip>] {
        const {line} = this.props
        const {model} = this.context

        const path = d3.path()
        const missingPath = d3.path()
        const tooltips: Array<Tooltip> = []

        let lastPosition: [number, number] = undefined
        let openEnd: [number, number] = undefined

        line.points.map(point => {
            const axis = model.getAxis(point.axis)
            if (axis === undefined) {
                // Should not happen. Maybe rendering different structures at once
                return
            }

            const layout = axis.getLayout()
            if (!layout)
                // Don't render axis that are not visible
                return

            const {x, width, yScale} = axis.getLayout()
            const xStart = x + width * 0.025
            const xEnd = xStart + width * 0.95

            if (point.value !== undefined) {
                let y
                const skipCenterX = !axis.isNumerical()

                if (axis.isNumerical()) {
                    y = (yScale as d3.ScaleContinuousNumeric<number, number>)(point.value as number)
                } else {
                    if (axis.choices.length === 0) {
                        // y = lastPosition[1]
                    } else {
                        const choice = axis.choices.filter(c => c.value == point.value).pop()
                        if (!choice.isCollapsed())
                            // Don't render axis that are expanded
                            return
                        y = choice.getLayout().centeredY()
                    }
                }

                // Close potential open parallel path
                if (openEnd !== undefined && openEnd[0] < x) {
                    path.lineTo(openEnd[0], lastPosition[1])
                    path.lineTo(xStart, y)

                    path.moveTo(...openEnd)
                    openEnd = undefined
                }

                if (lastPosition === undefined)
                    path.moveTo(xStart, y)
                else if (xStart < lastPosition[0]) {
                    openEnd = [lastPosition[0], lastPosition[1]]
                    path.moveTo(xStart, y)
                } else
                    path.lineTo(xStart, y)

                if (skipCenterX) {
                    const centeredX = axis.getLayout().centeredX()
                    path.lineTo(centeredX - Constants.CIRCLE_SIZE, y)
                    path.moveTo(centeredX + Constants.CIRCLE_SIZE, y)
                }
                path.lineTo(xEnd, y)

                lastPosition = [xEnd, y]
                if (axis.isNumerical())
                    tooltips.push({x: layout.centeredX(), y: y, text: fixedPrec(point.value as number)})
            } else {
                if (lastPosition === undefined)
                    return

                missingPath.moveTo(lastPosition[0], lastPosition[1])
                missingPath.lineTo(xStart + width * 0.95, lastPosition[1])
                path.moveTo(xEnd, lastPosition[1])
            }
        })
        return [path, missingPath, tooltips]
    }

    private memRenderPath = memoizeOne(this.renderPath)


    render() {
        const {missing} = this.props
        const [path, missingPath, tooltips] = this.memRenderPath(this.context.model.memState)
        const tooltipHeight = 20

        return (
            <g className={`${this.props.highlight ? 'pc-highlighted' : ''} ${this.state.selected || this.props.selected ? 'pc-selected' : ''}`}>
                {missing && <path className={'pc-line pc-missing-line'} d={missingPath.toString()}/>}
                {!missing &&
                    <>
                        <path className={'pc-line'} d={path.toString()}/>
                        <path className={'pc-fat-line'} d={path.toString()}
                              onMouseEnter={this.onMouseEnter}
                              onMouseLeave={this.onMouseLeave}
                              onClick={this.onClick}/>
                        {tooltips.map(t =>
                            <foreignObject x={t.x - 20} y={t.y - (tooltipHeight + 2)}
                                           width={100} height={tooltipHeight} style={{pointerEvents: 'none'}}>
                                <span className={'pc-tooltip'}>{t.text}</span>
                            </foreignObject>
                        )}
                    </>}
            </g>
        )
    };
}
