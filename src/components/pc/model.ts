import {ConfigValue} from "../../model";
import {ParCord} from "./util";
import * as d3 from "d3";
import {Constants} from "./constants";

export class Model {

    private axesMap: Map<string, Axis>

    constructor(
        public readonly axes: Array<Axis>,
        public readonly lines: Array<Line>) {
        this.axesMap = new Map<string, Axis>()
        this.cacheAxes(axes)
    }

    getAxis(id: string): Axis {
        return this.axesMap.get(id)
    }

    private cacheAxes(axes: Array<Axis>) {
        axes.forEach(a => {
            this.axesMap.set(a.id, a)
            a.choices.forEach(c => this.cacheAxes(c.axes))
        })
    }
}

export class Axis {

    public readonly domain: Domain
    public readonly choices: Array<Choice>

    private layout_: Layout

    constructor(
        public readonly id: string,
        public readonly label: string,
        public readonly type: Type,
        domain?: Domain,
        choices?: Array<Choice>) {
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

    static Numerical(id: string, label: string, domain: Domain): Axis {
        return new Axis(id, label, Type.NUMERICAL, domain)
    }

    static Categorical(id: string, label: string, choices: Array<Choice>): Axis {
        return new Axis(id, label, Type.CATEGORICAL, undefined, choices)
    }

    isNumerical(): boolean {
        return this.type == Type.NUMERICAL;
    }

    getWidthWeight(): number {
        return Math.max(1, ...this.choices.map(c => c.getWidthWeight()))
    }

    getHeightWeight(): number {
        if (this.isNumerical()) {
            return 5;
        } else {
            return this.choices.map(c => c.getHeightWeight()).reduce((a, b) => a + b)
        }
    }

    layout(xScale: d3.ScaleBand<string>, yRange: [number, number]) {
        const adjustedYRange: [number, number] = [
            yRange[0] + 1.5 * Constants.TEXT_HEIGHT,
            yRange[1] - 0.5 * Constants.TEXT_HEIGHT
        ]
        const yScale = this.isNumerical() ?
            this.domain.asScale(adjustedYRange) :
            ParCord.yScale(this.choices, adjustedYRange)

        const x = xScale(this.id)
        const y = yScale.range()[0]
        const width = this.getWidthWeight() * xScale.bandwidth()
        const height = yScale.range()[1] - yScale.range()[0]

        this.layout_ = new Layout(x, y, width, height, xScale, yScale)
        this.choices.forEach(c => c.layout([x, x + width], yScale as d3.ScaleBand<string>))
    }

    clearLayout() {
        this.layout_ = undefined
        this.choices.forEach(c => c.axes.forEach(a => a.clearLayout()))
    }

    getLayout(): Layout {
        return this.layout_
    }

}

export class Choice {

    private layout_: Layout
    private collapsed: boolean

    constructor(
        public readonly label: ConfigValue,
        public readonly axes: Array<Axis> = new Array<Axis>(),
        public readonly collapsible: boolean = true) {
        this.collapsed = collapsible
    }

    setCollapsed(collapsed: boolean) {
        if (this.collapsible) {
            this.collapsed = collapsed
        }
    }

    isCollapsed() {
        return this.collapsed
    }

    isExpandable() {
        return this.collapsed && this.axes.length > 0
    }

    getWidthWeight(): number {
        if (this.collapsed || this.axes.length === 0) {
            return 1
        } else {
            return this.axes.map(a => a.getWidthWeight()).reduce((a, b) => a + b)
        }
    }

    getHeightWeight(): number {
        if (this.collapsed || this.axes.length === 0) {
            return 1
        } else {
            return Math.max(1, ...this.axes.map(a => a.getHeightWeight()))
        }
    }

    public layout(xRange: [number, number], yScale: d3.ScaleBand<string>) {
        const xScale = ParCord.xScale(this.axes, xRange)

        const x = xRange[0]
        const width = xRange[1] - xRange[0]

        const y = yScale(this.label.toString())
        const height = this.getHeightWeight() * yScale.bandwidth()
        this.layout_ = new Layout(x, y, width, height, xScale, yScale)

        if (!this.isCollapsed()) {
            this.axes.forEach(a => a.layout(xScale, [y, y + height]))
        } else {
            this.axes.forEach(a => a.clearLayout())
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

        if (this.log)
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
                public readonly xScale: d3.ScaleBand<string>,
                public readonly yScale: Scale) {
    }

    centeredX() {
        return this.x + this.width / 2
    }

    centeredY() {
        return this.y + this.height / 2
    }
}

export class Line {

    private choices: Set<string>

    constructor(public readonly id: string, public readonly points: Array<LinePoint>) {
        this.choices = new Set<string>()
        points
            .filter(p => typeof p.value === 'string' || typeof p.value === 'boolean')
            .map(p => this.choices.add(`${p.axis}_${p.value}`))
    }

    intersects(axis: Axis, choice: Choice): boolean {
        return this.choices.has(`${axis.id}_${choice.label}`)
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
