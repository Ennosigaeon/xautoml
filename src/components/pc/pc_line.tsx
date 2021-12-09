import * as d3 from "d3";
import * as cpc from "./model";
import React from "react";
import {fixedPrec} from "../../util";
import {CandidateId} from "../../model";

interface PCLineProps {
    model: cpc.Model
    line: cpc.Line
    highlight: boolean
    onClick?: (id: CandidateId) => void
}

interface PCLineStats {
    highlight: boolean
}

interface Tooltip {
    x: number
    y: number
    text: number
}

export class PCLine extends React.Component<PCLineProps, PCLineStats> {

    static defaultProps = {
        onClick: () => {
        }
    }

    constructor(props: PCLineProps) {
        super(props)
        this.state = {highlight: false}

        this.onMouseEnter = this.onMouseEnter.bind(this)
        this.onMouseLeave = this.onMouseLeave.bind(this)
        this.onClick = this.onClick.bind(this)
    }

    private onMouseEnter() {
        this.setState(() => ({highlight: true}));
    }

    private onMouseLeave() {
        this.setState(() => ({highlight: false}));
    }

    private onClick(e: React.MouseEvent) {
        this.props.onClick(this.props.line.id)
        e.stopPropagation()
    }

    private renderPath(): [d3.Path, d3.Path, Array<Tooltip>] {
        const {line, model} = this.props

        const path = d3.path()
        const missingPath = d3.path()
        const tooltips: Array<Tooltip> = []

        let lastPosition: [number, number] = undefined

        line.points.map(point => {
            const axis = model.getAxis(point.axis)
            const layout = axis.getLayout()
            if (!layout)
                // Don't render axis that are not visible
                return

            const {x, width, yScale} = axis.getLayout()
            const xStart = x + width * 0.025
            const xEnd = xStart + width * 0.95

            if (point.value !== undefined) {
                let y
                if (axis.isNumerical()) {
                    y = (yScale as d3.ScaleContinuousNumeric<number, number>)(point.value as number)
                } else {
                    const choice = axis.choices.filter(c => c.label == point.value).pop()
                    if (!choice.isCollapsed())
                        // Don't render axis that are expanded
                        return
                    y = choice.getLayout().centeredY()
                }

                if (lastPosition === undefined)
                    path.moveTo(xStart, y)
                else
                    path.lineTo(xStart, y)
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


    render() {
        const [path, missingPath, tooltips] = this.renderPath()
        const tooltipHeight = 20

        return (
            <g className={this.state.highlight || this.props.highlight ? 'pc-highlighted' : ''}>
                <path className={'pc-line'} d={path.toString()}/>
                <path className={'pc-line pc-missing-line'} d={missingPath.toString()}/>

                <path className={'pc-fat-line'} d={path.toString()}
                      onMouseEnter={this.onMouseEnter}
                      onMouseLeave={this.onMouseLeave}
                      onClick={this.onClick}/>
                <path className={'pc-fat-line'} d={missingPath.toString()}
                      onMouseEnter={this.onMouseEnter}
                      onMouseLeave={this.onMouseLeave}/>
                {tooltips.map(t =>
                    <foreignObject x={t.x - 20} y={t.y - (tooltipHeight + 2)}
                                   width={100} height={tooltipHeight} style={{pointerEvents: 'none'}}>
                        <span className={'pc-tooltip'}>{t.text}</span>
                    </foreignObject>
                )}
            </g>
        )
    };
}
