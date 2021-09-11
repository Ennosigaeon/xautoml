import {ConfigValue} from "../../model";
import {fixedPrec} from "../../util";
import {ParCord} from "./util";

export class Model {
    constructor(
        public readonly id: string,
        public readonly label: string,
        public readonly axes: Array<Axis>,
        public readonly lines: Array<Line>) {
    }
}

// TODO linear and logarithmic axis
export class Axis {

    public readonly domain: Domain
    public readonly choices: Array<Choice>

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
            domain = new Domain(0, choices.length)
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

}

export class Choice {

    private collapsed: boolean

    constructor(
        public readonly id: string,
        public readonly label: string,
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
}

export class Domain {
    public readonly min: number;
    public readonly max: number;

    constructor(min: number, max: number) {
        if (min == max) {
            min = ParCord.guessMinimum(min)
            max = ParCord.guessMaximum(max)
        }

        this.min = fixedPrec(min)
        this.max = fixedPrec(max)
    }

    normalize(value: number): number {
        const norm = (this.max - value) / (this.max - this.min)
        return Math.max(this.min, Math.min(this.max, norm))
    }

    toD3(): [number, number] {
        return [this.min, this.max]
    }

}

export class Line {
    constructor(public readonly id: string, public readonly points: Array<LinePoint>) {
    }
}

export class LinePoint {
    constructor(
        public readonly axis: string,
        public readonly value: ConfigValue,
        public readonly children: Array<LinePoint>
    ) {
    }
}

export enum Type {
    CATEGORICAL,
    NUMERICAL
}
