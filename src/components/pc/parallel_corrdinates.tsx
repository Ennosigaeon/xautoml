import * as cpc from "./model";
import React from "react";
import * as d3 from "d3";
import {Runhistory} from "../../model";
import {ParCord} from "./util";
import {PCChoice} from "./pc_choice";
import {PCLine} from "./pc_line";
import {LoadingIndicator} from "../loading";


interface PCProps {
    runhistory: Runhistory
}

interface PCState {
    model: cpc.Model
    highlightedLines: Set<string>
    width: number
}

export class ParallelCoordinates extends React.Component<PCProps, PCState> {

    private readonly HEIGHT = 65
    private readonly root: cpc.Choice;
    private readonly container: React.RefObject<HTMLDivElement>;

    constructor(props: PCProps) {
        super(props)
        this.state = {
            model: ParCord.parseRunhistory(this.props.runhistory),
            highlightedLines: new Set<string>(),
            width: undefined
        }

        // init root node
        this.root = new cpc.Choice('', this.state.model.axes, false);
        this.container = React.createRef<HTMLDivElement>()

        this.onCollapse = this.onCollapse.bind(this)
        this.onExpand = this.onExpand.bind(this)
        this.highlightLines = this.highlightLines.bind(this)
    }

    componentDidMount() {
        if (this.container.current.clientWidth > 0)
            this.setDimensions()
        else
            // Jupyter renders all components before output containers are rendered.
            // Delay rendering to get the container width.
            window.setTimeout(() => this.setDimensions(), 1000)
    }

    private setDimensions() {
        const width = this.container.current.clientWidth
        this.setState({width: width === 0 ? 1000 : width})
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
        const {model, highlightedLines, width} = this.state
        if (!width) {
            // Render loading indicator while waiting for delayed re-rendering with correct container width
            return (
                <div ref={this.container} style={{width: '100%'}}>
                    <LoadingIndicator loading={true}/>
                </div>
            )
        }

        // Estimate height based on maximum number of components
        const height = this.HEIGHT * Math.max(...this.root.axes.map(a => a.choices.length))
        const yScale = d3.scaleBand([this.root.label.toString()], [0, height / this.root.getHeightWeight()])
        this.root.layout([0, width], yScale)

        return (
            <div className={'pc-container'} style={{paddingBottom: `${(height / width) * 100}%`}}>
                <svg className={'pc'} preserveAspectRatio={"xMinYMin meet"} viewBox={`0 0 ${width} ${height}`}>
                    <PCChoice choice={this.root} parent={undefined}
                              onCollapse={this.onCollapse}
                              onExpand={this.onExpand}
                              onChoiceHover={this.highlightLines}/>
                    {this.state.model.lines.map(line => {
                            return <PCLine key={line.id}
                                           model={model}
                                           line={line}
                                           highlight={highlightedLines.has(line.id)}/>
                        }
                    )}
                </svg>
            </div>
        )
    }
}
