import * as cpc from "./model";
import {PCChoice} from "./pc_choice";
import React from "react";
import {SampleData} from "./SampleDataset";
import * as d3 from "d3";


interface CPCState {
    model: cpc.Model
}

export class ParallelCoordinates extends React.Component<{}, CPCState> {

    private readonly root: cpc.Choice;

    constructor(props: {}) {
        super(props)
        this.state = {model: SampleData.createModel()}

        // init root node
        this.root = new cpc.Choice(this.state.model.id, this.state.model.label, this.state.model.axes, false);

        this.onCollapse = this.onCollapse.bind(this)
        this.onExpand = this.onExpand.bind(this)
    }

    private onCollapse(choice: cpc.Choice) {
        choice.setCollapsed(true)
        this.setState({model: this.state.model})
    }

    private onExpand(choice: cpc.Choice) {
        choice.setCollapsed(false)
        this.setState({model: this.state.model})
    }

    public render() {
        // const lines = this.props.data.lines.map(l => <CPCLine cpc={this} line={l}/>)
        const width = 1000
        const height = 500
        const yScale = d3.scaleBand([this.root.id], [0, height / this.root.getHeightWeight()])

        return (
            <svg className={'_cpc'} width={`${width}px`} height={`${height}px`}>
                <PCChoice choice={this.root} parent={undefined}
                          onCollapse={this.onCollapse}
                          onExpand={this.onExpand}
                          xRange={[0, width]} yScale={yScale}/>
            </svg>
        )
    }
}
