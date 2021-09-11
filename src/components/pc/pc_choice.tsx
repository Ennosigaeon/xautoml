import * as cpc from "./model";
import React from "react";
import * as d3 from "d3";
import {PCAxis} from "./pc_axis";
import {ParCord} from "./util";

interface CPCPChoiceProps {
    choice: cpc.Choice
    parent: cpc.Axis

    onExpand: (choice: cpc.Choice) => void
    onCollapse: (choice: cpc.Choice) => void

    xRange: [number, number]
    yScale: d3.ScaleBand<string>
}

interface CPCChoiceState {
}

export class PCChoice extends React.Component<CPCPChoiceProps, CPCChoiceState> {

    constructor(props: CPCPChoiceProps) {
        super(props);

        this.expand = this.expand.bind(this)
    }

    private expand(e: React.MouseEvent) {
        const {choice, onExpand} = this.props
        if (choice.isExpandable()) {
            onExpand(choice)
        }

        e.preventDefault()
        e.stopPropagation()
    }

    render() {
        const {choice, xRange, yScale, onCollapse, onExpand} = this.props
        const xScale = ParCord.xScale(choice.axes, xRange)

        const x = xRange[0]
        const width = xRange[1] - xRange[0]

        const y = yScale(choice.id)
        const height = choice.getHeightWeight() * yScale.bandwidth()

        return (
            <g id={`choice-${choice.id}`} onClick={this.expand}>
                {choice.isCollapsed() &&
                <circle className={'choice'} fill={'none'} stroke={'black'} strokeWidth={'1px'}
                        cx={x + width / 2} cy={y + height / 2} r={12}/>}
                <text x={x + width / 2} y={y + height / 2} textAnchor={'middle'} dominantBaseline={'middle'}
                      fontSize={'11px'}>
                    {choice.label}
                </text>
                {!choice.isCollapsed() && choice.axes.map(a => <PCAxis key={a.id}
                                                                       axis={a}
                                                                       parent={choice}
                                                                       onCollapse={onCollapse}
                                                                       onExpand={onExpand}
                                                                       xScale={xScale}
                                                                       yRange={[y, y + height]}/>)}
            </g>
        )
    }
}
