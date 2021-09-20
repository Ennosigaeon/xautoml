import * as cpc from "./model";
import {PCChoice} from "./pc_choice";
import React from "react";
import {SampleData} from "./SampleDataset";
import * as d3 from "d3";
import {PCLine} from "./pc_line";


interface PCState {
    model: cpc.Model
    highlightedLines: Set<string>
}

export class ParallelCoordinates extends React.Component<{}, PCState> {

    private readonly root: cpc.Choice;

    constructor(props: {}) {
        super(props)
        this.state = {model: SampleData.createModel(), highlightedLines: new Set<string>()}

        // init root node
        this.root = new cpc.Choice(this.state.model.id, this.state.model.label, this.state.model.axes, false);

        this.onCollapse = this.onCollapse.bind(this)
        this.onExpand = this.onExpand.bind(this)
        this.highlightLines = this.highlightLines.bind(this)
    }

    private onCollapse(choice: cpc.Choice) {
        choice.setCollapsed(true)
        this.setState({model: this.state.model})
    }

    private onExpand(choice: cpc.Choice) {
        choice.setCollapsed(false)
        this.setState({model: this.state.model})
    }

    private highlightLines(axis: cpc.Axis, choice: cpc.Choice) {
        const highlights = !!axis && !!choice ? this.state.model.lines
            .filter(l => l.intersects(axis, choice))
            .map(l => l.id) : []
        this.setState({highlightedLines: new Set<string>(highlights)})
    }

    public render() {
        const width = 1000
        const height = 500
        const yScale = d3.scaleBand([this.root.id], [0, height / this.root.getHeightWeight()])
        this.root.layout([0, width], yScale)

        const {model, highlightedLines} = this.state

        return (
            <svg className={'pc'} width={`${width}px`} height={`${height}px`}>
                <PCChoice choice={this.root} parent={undefined}
                          onCollapse={this.onCollapse}
                          onExpand={this.onExpand}
                          onChoiceHover={this.highlightLines}/>
                {this.state.model.lines.map(line => {
                        return < PCLine key={line.id}
                                        model={model}
                                        line={line}
                                        highlight={highlightedLines.has(line.id)}/>
                    }
                )}
            </svg>
        )
    }
}
