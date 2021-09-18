import * as cpc from "./model";
import React from "react";
import {PCAxis} from "./pc_axis";
import {Constants} from "./constants";

interface CPCPChoiceProps {
    choice: cpc.Choice
    parent: cpc.Axis

    onExpand: (choice: cpc.Choice) => void
    onCollapse: (choice: cpc.Choice) => void
}

interface CPCChoiceState {
}

export class PCChoice extends React.Component<CPCPChoiceProps, CPCChoiceState> {

    constructor(props: CPCPChoiceProps) {
        super(props);

        this.expand = this.expand.bind(this)
        this.collapse = this.collapse.bind(this)
    }

    private expand(e: React.MouseEvent) {
        const {choice, onExpand} = this.props
        if (choice.isExpandable()) {
            onExpand(choice)
        }

        e.preventDefault()
        e.stopPropagation()
    }

    private collapse(e: React.MouseEvent) {
        const {choice, onCollapse} = this.props

        if (!choice.isCollapsed()) {
            onCollapse(choice)
        }

        e.preventDefault()
        e.stopPropagation()
    }

    render() {
        const {choice, onCollapse, onExpand} = this.props
        const {x, y, width, height} = choice.getLayout()
        const centeredX = choice.getLayout().centeredX()
        const centeredY = choice.getLayout().centeredY()

        return (
            <g id={`choice-${choice.id}`}
               className={`pc-choice ${choice.isExpandable() ? 'pc-choice-expandable' : ''}`}
               onClick={this.expand}>
                {choice.isCollapsed() && <circle cx={centeredX}
                                                 cy={centeredY}
                                                 r={Constants.CIRCLE_SIZE}/>}
                <text x={centeredX}
                      y={centeredY}
                      transform={`rotate(${Constants.TEXT_ROTATION}, ${centeredX}, ${centeredY})`}>{choice.label}</text>

                {!choice.isCollapsed() && <>
                    <rect x={x} y={y} width={width} height={height} onClick={this.collapse}/>
                    {choice.axes.map(a => <PCAxis key={a.id}
                                                  axis={a}
                                                  parent={choice}
                                                  onCollapse={onCollapse}
                                                  onExpand={onExpand}/>)}
                </>}
            </g>
        )
    }
}
