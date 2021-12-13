import * as cpc from "./model";
import React from "react";
import {PCAxis} from "./pc_axis";
import {Constants} from "./constants";
import {prettyPrint} from "../../util";

interface CPCPChoiceProps {
    choice: cpc.Choice
    parent: cpc.Axis

    svg: React.RefObject<SVGSVGElement>

    onExpand: (choice: cpc.Choice) => void
    onCollapse: (choice: cpc.Choice) => void
    onHighlight: (axis: cpc.Axis, selection: cpc.Choice | [number, number]) => void
}

export class PCChoice extends React.Component<CPCPChoiceProps, {}> {

    constructor(props: CPCPChoiceProps) {
        super(props);

        this.expand = this.expand.bind(this)
        this.collapse = this.collapse.bind(this)
        this.highlightLines = this.highlightLines.bind(this)
        this.hideHighlightLines = this.hideHighlightLines.bind(this)
    }

    private expand(e: React.MouseEvent) {
        const {choice, onExpand} = this.props
        if (choice.isExpandable())
            onExpand(choice)

        e.preventDefault()
        e.stopPropagation()
    }

    private collapse(e: React.MouseEvent) {
        const {choice, onCollapse, onHighlight} = this.props

        if (!choice.isCollapsed()) {
            onCollapse(choice)
            onHighlight(this.props.parent, undefined)
        }

        e.preventDefault()
        e.stopPropagation()
    }

    private highlightLines() {
        this.props.onHighlight(this.props.parent, this.props.choice)
    }

    private hideHighlightLines() {
        this.props.onHighlight(this.props.parent, undefined)
    }

    render() {
        const {choice, parent, onCollapse, onExpand, onHighlight, svg} = this.props
        const {x, y, width, height} = choice.getLayout()
        const centeredX = choice.getLayout().centeredX()
        const centeredY = choice.getLayout().centeredY()

        return (
            <g className={`pc-choice ${choice.isExpandable() ? 'pc-choice-expandable' : ''}`}
               onClick={this.expand}
               onMouseOver={this.highlightLines}
               onMouseOut={this.hideHighlightLines}>
                {choice.isCollapsed() && <circle cx={centeredX}
                                                 cy={centeredY}
                                                 r={Constants.CIRCLE_SIZE}/>}
                <text x={centeredX}
                      y={centeredY}
                      transform={`rotate(${Constants.TEXT_ROTATION}, ${centeredX}, ${centeredY})`}>{prettyPrint(choice.label)}</text>

                {!choice.isCollapsed() && <>
                    {parent && <rect x={x} y={y} width={width} height={height} onClick={this.collapse}
                                     className={'pc-border'}/>}
                    {choice.axes.map(a => <PCAxis key={a.id}
                                                  axis={a}
                                                  parent={choice}
                                                  svg={svg}
                                                  onCollapse={onCollapse}
                                                  onExpand={onExpand}
                                                  onHighlight={onHighlight}/>)}
                </>}
            </g>
        )
    }
}
