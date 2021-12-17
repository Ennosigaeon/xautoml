import * as cpc from "./model";
import React from "react";
import * as d3 from "d3";
import {Candidate, CandidateId, Config, MetaInformation, Structure} from "../../model";
import {ParCord} from "./util";
import {PCChoice} from "./pc_choice";
import {PCLine} from "./pc_line";
import {RefableFlexibleSvg} from "../../util/flexible-svg";


interface PCProps {
    meta: MetaInformation
    structures: Structure[]
    candidates?: [Candidate, Structure][]
    explanation?: Config.Explanation
    selectedCandidates?: Set<CandidateId>
    onCandidateSelection?: (cid: Set<CandidateId>, show?: boolean) => void

    timestamp?: number
}

interface PCState {
    model: cpc.Model
    highlightedLines: Set<string>
    container: React.RefObject<any>
    filter: Map<cpc.Axis, cpc.Choice | [number, number]>
}

export class ParallelCoordinates extends React.Component<PCProps, PCState> {

    static HELP = 'Overview of the complete search space traversed by the Bayesian optimizer including selected ' +
        'configurations. Each axis represents a single tunable hyperparameter. Optionally, each axis can provide ' +
        'a visualization of the internal surrogate model with expected performances. For a better overview, related ' +
        'hyperparameters, e.g. all hyperparameters of a single component, can be collapsed. Each horizontal line ' +
        'represents a single selected configuration. Configurations can be selected via brushing numerical axes, ' +
        'hovering categorical values or clicking/hovering single lines.'

    private readonly NODE_HEIGHT = 55
    private readonly root: cpc.Choice;

    private svg: React.RefObject<SVGSVGElement> = React.createRef<SVGSVGElement>()

    static defaultProps = {
        candidates: (undefined as [Candidate, Structure][]),
        explanation: (undefined as Config.Explanation),
        selectedCandidates: new Set<CandidateId>(),
        onCandidateSelection: () => {
        }
    }

    constructor(props: PCProps) {
        super(props)

        const candidates: [Candidate, Structure][] = this.props.candidates !== undefined ?
            this.props.candidates : [].concat(...this.props.structures.map(s => s.configs.map(c => [c, s])))

        const model = ParCord.parseRunhistory(this.props.meta, this.props.structures, candidates, this.props.explanation)
        const filter = new Map<cpc.Axis, cpc.Choice | [number, number]>()
        this.state = {
            model: model,
            highlightedLines: this.props.selectedCandidates,
            container: undefined,
            filter: filter
        }

        // init root node
        this.root = new cpc.Choice('', this.state.model.axes, false);

        this.onCollapse = this.onCollapse.bind(this)
        this.onExpand = this.onExpand.bind(this)
        this.highlightLines = this.highlightLines.bind(this)
        this.updateContainer = this.updateContainer.bind(this)
        this.onSelectLine = this.onSelectLine.bind(this)
        this.onShowCandidate = this.onShowCandidate.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<PCProps>, prevState: Readonly<PCState>, snapshot?: any) {
        if (prevProps.selectedCandidates.size !== this.props.selectedCandidates.size)
            this.setState({highlightedLines: this.props.selectedCandidates})
    }

    private onCollapse(choice: cpc.Choice) {
        choice.collapse()
        this.setState({model: this.state.model})
    }

    private onExpand(choice: cpc.Choice) {
        choice.expand()
        this.setState({model: this.state.model})
    }

    private highlightLines(axis: cpc.Axis, filter: cpc.Choice | [number, number] | undefined) {
        if (axis === undefined)
            return
        else if (filter === undefined)
            this.state.filter.delete(axis)
        else
            this.state.filter.set(axis, filter)

        const highlights = this.calculateHighlightedLines(this.state.model.lines, this.state.filter)
        this.setState({highlightedLines: highlights, filter: this.state.filter})
        this.props.onCandidateSelection(highlights)
    }

    private calculateHighlightedLines(lines: cpc.Line[], filter: Map<cpc.Axis, cpc.Choice | [number, number]>) {
        const normal: cpc.Line[] = []
        const highlights: cpc.Line[] = []
        lines.forEach(l => {
            let matches: boolean = undefined
            filter.forEach((value, key) => matches = (matches || matches === undefined) && l.intersects(key, value));
            (matches !== undefined && matches) ? highlights.push(l) : normal.push(l)
        })
        return new Set(highlights.map(l => l.id))
    }

    private updateContainer(container: React.RefObject<HTMLDivElement>) {
        this.setState({container: container})
    }

    private onSelectLine(cid: CandidateId) {
        const selected = new Set(this.props.selectedCandidates)
        if (this.props.selectedCandidates.has(cid))
            selected.delete(cid)
        else
            selected.add(cid)
        this.props.onCandidateSelection(selected)
    }

    private onShowCandidate(cid: CandidateId) {
        this.props.onCandidateSelection(new Set<CandidateId>([cid]), true)
    }

    public render() {
        const {model, highlightedLines, container} = this.state
        const width = (container && container.current) ? container.current.clientWidth : 0

        // Estimate height based on maximum number of choices in all coordinates
        const maxNodes = Math.max(...this.root.axes.map(a => a.getHeightWeight()))
        const height = this.NODE_HEIGHT * maxNodes
        const yScale = d3.scaleBand([this.root.value.toString()], [0, height / this.root.getHeightWeight()])
        this.root.layout([0, width], yScale)

        return (
            <RefableFlexibleSvg height={height} onContainerChange={this.updateContainer} ref={this.svg}>
                <PCChoice choice={this.root} parent={undefined}
                          svg={model.lines.length > 1 ? this.svg : undefined} // Disable brushing when only when line present
                          onCollapse={this.onCollapse}
                          onExpand={this.onExpand}
                          onHighlight={this.highlightLines}/>
                {this.state.model.lines
                    .slice(0, this.props.timestamp + 1)
                    .map((line, idx) => <PCLine key={line.id} model={model} line={line}
                                                selected={idx == this.props.timestamp}
                                                highlight={highlightedLines.has(line.id)}
                                                onClick={this.onShowCandidate}
                                                onAlternativeClick={this.onSelectLine}/>)}
            </RefableFlexibleSvg>
        )
    }
}
