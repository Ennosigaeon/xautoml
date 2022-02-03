import {CandidateId, BO, ConfigValue} from "../../model";
import {ParCord} from "./util";
import * as d3 from "d3";
import {Constants} from "./constants";
import {prettyPrint} from "../../util";
import React from "react";

export interface PerformanceAxis {
    domain: [number, number],
    label: string,
    log: boolean
}

export interface CPCContext {
    svg: React.RefObject<SVGSVGElement>
    showExplanations: boolean
    model: Model
    selectedAxis: Set<string>
}

export const CPCContext = React.createContext<CPCContext>(undefined);


export class Model {

    private axesMap: Map<string, Axis>
    private explanations_: BO.Explanation
    private memState_: number = Math.random()

    constructor(
        public readonly axes: Axis[][],
        public readonly lines: Line[]) {
        this.axesMap = new Map<string, Axis>()
        this.cacheAxes(axes)
    }

    getAxis(id: string): Axis {
        return this.axesMap.get(id)
    }

    set explanations(explanation: BO.Explanation) {
        this.explanations_ = explanation
    }

    getExplanations(axis: Axis) {
        return this.explanations_?.get(axis.name)
    }

    updateMemState() {
        this.memState_ = Math.random()
    }

    get memState() {
        return this.memState_
    }

    // noinspection JSMethodCanBeStatic
    private cacheAxes(columns: Axis[][]) {
        columns.forEach(column => {
            column.forEach(row => {
                this.axesMap.set(row.id, row)
                row.choices.forEach(c => this.cacheAxes(c.axes))
            })
        })
    }
}

export class Axis {

    public readonly domain: Domain
    public readonly choices: Array<Choice>

    private layout_: Layout

    private constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly label: string,
        public readonly type: Type,
        domain?: Domain,
        choices?: Choice[]) {
        if (this.isNumerical()) {
            if (domain === undefined)
                throw new Error('Domain has to be provided for a numerical axis')
            choices = new Array<Choice>()
        } else {
            if (choices === undefined)
                throw new Error('Choices has to be provided for a categorical axis')
            domain = new Domain(0, choices.length, false)
        }
        this.domain = domain
        this.choices = choices
    }

    static Numerical(id: string, name: string, domain: Domain): Axis {
        const tokens = name.split(':')
        return new Axis(id, name, tokens[tokens.length - 1], Type.NUMERICAL, domain)
    }

    static Categorical(id: string, name: string, choices: Array<Choice>): Axis {
        const tokens = (choices.length === 1 ? prettyPrint(choices[0].label) : name).split(':')
        return new Axis(id, name, tokens[tokens.length - 1], Type.CATEGORICAL, undefined, choices)
    }

    isNumerical(): boolean {
        return this.type == Type.NUMERICAL;
    }

    getWidthWeight(): number {
        return Math.max(1, ...this.choices.map(c => c.getWidthWeight()))
    }

    getHeightWeight(): number {
        if (this.isNumerical()) {
            return 3;
        } else {
            return Math.max(1, this.choices.map(c => c.getHeightWeight()).reduce((a, b) => a + b, 0))
        }
    }

    layout(xScale: d3.ScaleBand<string>, yRange: [number, number]) {
        const adjustedYRange: [number, number] = [
            yRange[0] + 1.5 * Constants.TEXT_HEIGHT,
            yRange[1] - 1.5 * Constants.TEXT_HEIGHT
        ]
        const yScale = this.isNumerical() ?
            this.domain.asScale(adjustedYRange) :
            ParCord.yScale(this.choices, adjustedYRange)

        const x = xScale(this.id)
        const y = yScale.range()[0]
        const width = this.getWidthWeight() * xScale.bandwidth()
        const height = yScale.range()[1] - yScale.range()[0]

        this.layout_ = new Layout(x, y, width, height, yScale)
        this.choices.forEach(c => c.layout([x, x + width], yScale as d3.ScaleBand<string>))
    }

    clearLayout() {
        this.layout_ = undefined
        this.choices.forEach(c => c.axes.forEach(column => column.forEach(row => row.clearLayout())))
    }

    getLayout(): Layout {
        return this.layout_
    }

    resetSelection(choice: Choice | undefined) {
        this.choices.filter(c => choice?.value !== c.value).forEach(c => c.resetSelected())
    }

}

export class Choice {

    private layout_: Layout
    private collapsed: boolean
    private selected: boolean

    constructor(
        public readonly value: ConfigValue,
        public readonly axes: Axis[][] = [],
        public readonly collapsible: boolean = true,
        public readonly label?: ConfigValue) {
        this.collapsed = collapsible
        if (!label)
            this.label = value
        this.selected = false
    }

    collapse() {
        if (this.collapsible && !this.collapsed) {
            this.collapsed = true
            this.axes.forEach(column => column.forEach(row => row.choices.forEach(c => c.collapse())))
        }
    }

    expand() {
        if (this.isExpandable())
            this.collapsed = false
    }

    isCollapsed() {
        return this.collapsed
    }

    isExpandable() {
        return this.collapsed && Math.max(...this.axes.map(a => a.length)) === 1 && this.axes[0].length > 0
    }

    toggleSelected() {
        this.selected = !this.selected
        return this.selected
    }

    getSelected() {
        return this.selected ? this : undefined
    }

    resetSelected() {
        this.selected = false
    }

    getWidthWeight(): number {
        if (this.collapsed || this.axes.length === 0) {
            return 1
        } else {
            return this.axes.map(column => Math.max(...column.map(row => row.getWidthWeight()))).reduce((a, b) => a + b)
        }
    }

    getHeightWeight(): number {
        if (this.collapsed || this.axes.length === 0) {
            return 1
        } else {
            // noinspection UnnecessaryLocalVariableJS
            const columns = this.axes
            return Math.max(1,
                ...columns.map(column => column.map(row => row.getHeightWeight()).reduce((a, b) => a + b) + column.length))
        }
    }

    public layout(xRange: [number, number], yScale: d3.ScaleBand<string>) {
        const xScales = ParCord.xScale(this.axes, xRange)

        const x = xRange[0]
        const width = xRange[1] - xRange[0]

        const y = yScale(this.value.toString())
        const height = this.getHeightWeight() * yScale.bandwidth()
        this.layout_ = new Layout(x, y, width, height, yScale)
        const columns = this.axes

        if (!this.isCollapsed()) {
            columns.forEach(column => {
                const cumHeight = column.map(r => r.getHeightWeight()).reduce((a, b) => a + b, 0)
                let start = y
                column.forEach((row, rowIdx) => {
                    const fracHeight = height * (row.getHeightWeight() / cumHeight)
                    row.layout(xScales[rowIdx], [start, start + fracHeight])
                    start += fracHeight
                })
            })
        } else {
            columns.forEach(column => column.forEach(row => row.clearLayout()))
        }
    }

    getLayout(): Layout {
        return this.layout_
    }
}

export class Domain {
    public readonly min: number;
    public readonly max: number;

    constructor(min: number, max: number, public readonly log: boolean) {
        if (min == max) {
            min = ParCord.guessMinimum(min)
            max = ParCord.guessMaximum(max)
        }

        this.min = min
        this.max = max
    }

    asScale(range: [number, number]): d3.ScaleContinuousNumeric<any, any> {
        const domain = [this.max, this.min]

        if (this.log && this.min > 0 && this.max > 0)
            return d3.scaleLog(domain, range)
        else
            return d3.scaleLinear(domain, range)
    }

}

export class Layout {
    constructor(public readonly x: number,
                public readonly y: number,
                public readonly width: number,
                public readonly height: number,
                public readonly yScale: Scale) {
    }

    centeredX() {
        return this.x + this.width / 2
    }

    centeredY() {
        return this.y + this.height / 2
    }

    perfEstScale(domain: [number, number][] = [[0, 1]]): d3.ScaleLinear<number, number> {
        const max = Math.max(...domain.map(([_, v]) => v))
        return d3.scaleLinear([0, max * 1.1], [0, this.width / 2])
    }
}

export class Line {

    private choices: Set<string>
    private pointMap: Map<string, ConfigValue>

    constructor(public readonly id: CandidateId, public readonly points: Array<LinePoint>, public readonly timestamp: number) {
        this.choices = new Set<string>()
        points
            .filter(p => typeof p.value === 'string' || typeof p.value === 'boolean')
            .map(p => this.choices.add(`${p.axis}_${p.value}`))

        this.pointMap = new Map<string, ConfigValue>(
            points.map(p => [p.axis, p.value])
        )
    }

    intersects(axis: Axis, filter: Choice | [number, number]): boolean {
        if (filter instanceof Choice)
            return this.choices.has(`${axis.id}_${filter.value}`)
        else {
            const value = this.pointMap.get(axis.id) as number
            return filter[0] <= value && value <= filter[1]
        }
    }
}

export class LinePoint {
    constructor(
        public readonly axis: string,
        public readonly value: ConfigValue) {
    }
}

export enum Type {
    CATEGORICAL,
    NUMERICAL
}

export type Scale = d3.ScaleContinuousNumeric<number, number> | d3.ScaleBand<string>

export const PARENT_MARKER = '__parent__'
