import * as cpc from "./model";
import React from "react";
import * as d3 from "d3";
import {PCAxis} from "./pc_axis";
import {ParCord} from "./util";

interface CPCPChoiceProps {
    choice: cpc.Choice
    parent: cpc.Axis

    xRange: [number, number]
    yScale: d3.ScaleBand<string>
}

interface CPCChoiceState {
}

export class PCChoice extends React.Component<CPCPChoiceProps, CPCChoiceState> {

    constructor(props: CPCPChoiceProps) {
        super(props);
    }

    // toggleCollapsed(): void {
    //     const collapseOthersOnChoiceExpand = false
    //
    //     if (collapseOthersOnChoiceExpand) {
    //         // collect choices in branch to root
    //         let branch: Array<CPCChoice> = new Array<CPCChoice>();
    //         branch.push(this);
    //         let parent: CPCNode = this.getParent();
    //         while (parent != null) {
    //             if (parent instanceof CPCChoice) {
    //                 branch.push(<CPCChoice>parent);
    //             }
    //             parent = parent.getParent();
    //         }
    //         // collapse all others
    //         for (let choice of this.cpc.getChoices()) {
    //             if (!branch.includes(choice)) {
    //                 choice.collapse();
    //             }
    //         }
    //
    //     }
    //     // toggle current
    //     this.collapsed = !this.collapsed;
    // };

    render() {
        const {choice, xRange, yScale} = this.props
        const xScale = ParCord.xScale(choice.axes, xRange)

        const x = xRange[0]
        const width = xRange[1] - xRange[0]

        const y = yScale(choice.id)
        const height = choice.getHeightWeight() * yScale.bandwidth()

        return (
            <g id={`choice-${choice.id}`}>
                {/*<rect x={x} width={width} y={y} height={height}*/}
                {/*      style={{fill: 'none', stroke: 'blue', strokeWidth: '1px'}}/>*/}
                {choice.isCollapsed() &&
                <circle className={'choice'} fill={'none'} stroke={'black'} strokeWidth={'1px'}
                        cx={x + width / 2} cy={y + height / 2} r={12}/>}
                <text x={x + width / 2} y={y + height / 2} textAnchor={'middle'} dominantBaseline={'middle'}
                      fontSize={'11px'}>
                    {choice.label}
                </text>
                {!choice.isCollapsed() && choice.axes.map(a => <PCAxis key={a.id}
                                                                       axis={a}
                                                                       xScale={xScale}
                                                                       yRange={[y, y + height]}/>)}
            </g>
        )
    }
}
