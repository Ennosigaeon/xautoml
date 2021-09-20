import * as d3 from "d3";
import * as cpc from "./model";
import React from "react";
import {fixedPrec} from "../../util";

interface PCLineProps {
    model: cpc.Model
    line: cpc.Line
    highlight: boolean
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

    constructor(props: PCLineProps) {
        super(props)
        this.state = {highlight: false}

        this.toggleHighlight = this.toggleHighlight.bind(this)
    }

    private toggleHighlight() {
        this.setState(state => ({
            highlight: !state.highlight
        }));
    }

    private renderPath(): [d3.Path, Array<Tooltip>] {
        const {line, model} = this.props

        const path = d3.path()
        const tooltips: Array<Tooltip> = []

        let first = true

        line.points.map(point => {
            const axis = model.getAxis(point.axis)
            const layout = axis.getLayout()
            if (!layout)
                // Don't render axis that are not visible
                return

            const {x, width, yScale} = axis.getLayout()
            const shiftedX = x + width * 0.025

            let y
            if (axis.isNumerical()) {
                y = (yScale as d3.ScaleLinear<number, number>)(point.value as number)
            } else {
                const choice = axis.choices.filter(c => c.id == point.value).pop()
                if (!choice.isCollapsed())
                    // Don't render axis that are expanded
                    return
                y = choice.getLayout().centeredY()
            }

            if (first) {
                path.moveTo(shiftedX, y)
                first = false
            } else
                path.lineTo(shiftedX, y)
            path.lineTo(shiftedX + width * 0.95, y)

            if (axis.isNumerical()) {
                tooltips.push({x: layout.centeredX(), y: y, text: fixedPrec(point.value as number)})
            }
        })
        return [path, tooltips]
    }


    render() {
        const [path, tooltips] = this.renderPath()
        const tooltipHeight = 17
        const tooltipOffset = 2

        return (<g className={this.state.highlight || this.props.highlight ? 'pc-highlighted' : ''}>
                <path className={'pc-line'} d={path.toString()}
                      onMouseEnter={this.toggleHighlight}
                      onMouseLeave={this.toggleHighlight}/>
                {tooltips.map(t =>
                    <>
                        <foreignObject x={t.x + tooltipOffset}
                                       y={t.y - (tooltipHeight + tooltipOffset)}
                                       width={100}
                                       height={tooltipHeight}
                                       style={{pointerEvents: 'none'}}>
                            <span className={'pc-tooltip'}>{t.text}</span>
                        </foreignObject>
                    </>
                )}
            </g>
        )
    };
}
