import * as cpc from "./model";
import * as d3 from "d3";
import {BO, Candidate, ConfigValue, Structure} from "../../model";

export namespace ParCord {


    import HyperParameter = BO.HyperParameter;
    import Condition = BO.Condition;
    import CategoricalHyperparameter = BO.CategoricalHyperparameter;
    import NumericalHyperparameter = BO.NumericalHyperparameter;

    export function guessMinimum(value: number): number {
        const pos = getPositionOfMostSignificantDecimal(value);
        return value - Math.pow(10, pos);
    }

    export function guessMaximum(value: number): number {
        const pos = getPositionOfMostSignificantDecimal(value);
        return value + Math.pow(10, pos);
    }

    function getPositionOfMostSignificantDecimal(number: number): number {
        let pos: number = 0;
        number = Math.abs(number);
        if (isInt(number)) {
            while (number >= 10) {
                number /= 10;
                pos++;
            }
        } else {
            number = number % 1;
            while (number < 1) {
                number *= 10;
                pos--;
            }
        }
        return pos;
    }

    export function isInt(n: any): boolean {
        return n % 1 === 0;
    }

    export function xScale(axes: Array<cpc.Axis>, range: [number, number]): d3.ScaleBand<string> {
        const weights = axes.map(a => a.getWidthWeight() - 1)
        const ids = [].concat(...axes.map((a, i) => [a.id, ...Array(...Array(weights[i])).map((_, j) => `_${a.id}_${j}_`)]))

        return d3.scaleBand(ids, range).padding(0.1)
    }

    export function yScale(choices: Array<cpc.Choice>, range: [number, number]): d3.ScaleBand<string> {
        const weights = choices.map(c => c.getHeightWeight() - 1)
        const ids = [].concat(...choices.map((c, i) => [c.value, ...Array(...Array(weights[i])).map((_, j) => `_${c.value}_${j}_`)]))

        return d3.scaleBand(ids, range)
    }

    export function parseRunhistory(perfAxis: cpc.PerformanceAxis,
                                    structures: Structure[],
                                    candidates: [Candidate, Structure][],
                                    explanation: BO.Explanation): cpc.Model {
        function parseHyperparameter(hp: HyperParameter, conditions: Condition[]): cpc.Axis {
            const id = hp.name
            if (hp instanceof NumericalHyperparameter) {
                const domain = new cpc.Domain(hp.lower, hp.upper, hp.log)
                return cpc.Axis.Numerical(id, hp.name, domain, explanation)
            } else {
                const choices = (hp as CategoricalHyperparameter).choices
                    .map(choice => new cpc.Choice(choice as ConfigValue, []))

                hp.subParameters.forEach(child => {
                    conditions.filter(con => con.parent === hp.name && con.child === child.name)[0].values
                        .forEach(v =>
                            choices.filter(c => c.value === v)
                                .forEach(c => c.axes.push(parseHyperparameter(child, conditions)))
                        )
                })
                return cpc.Axis.Categorical(id, hp.name, choices, explanation)
            }
        }

        function parseConfigSpace() {
            const components: Map<string, cpc.Choice>[] = []
            structures.forEach(structure => {
                structure.pipeline.steps.forEach((step, idx) => {
                    if (components.length === idx)
                        components.push(new Map<string, cpc.Choice>())

                    if (!components[idx].has(step.id)) {
                        const axes = structure.configspace.getHyperparameters(step.id)
                            .map((hp: HyperParameter) => parseHyperparameter(hp, structure.configspace.conditions))

                        const label = !Number.isNaN(Number.parseInt(step.name)) || !step.name ? step.label : undefined
                        components[idx].set(step.id, new cpc.Choice(step.name, axes, true, label))
                    }
                })
            })
            const axes = components.map((steps, idx) => {
                const name = steps.size === 1 ? steps.keys().next().value : `Component ${idx}`
                return cpc.Axis.Categorical(`${idx}`, name, [...steps.values()], explanation)
            })

            const lowerPerf = Math.min(...perfAxis.domain)
            const upperPerf = Math.max(...perfAxis.domain)
            axes.push(cpc.Axis.Numerical('__performance__', perfAxis.label,
                new cpc.Domain(lowerPerf, upperPerf, perfAxis.log)))

            return axes
        }

        const axes = parseConfigSpace()

        const lines = candidates.map(([candidate, structure]) => {
            const points = new Array<cpc.LinePoint>()
            structure.pipeline.steps.map((step, idx) => {
                points.push(new cpc.LinePoint(idx.toString(), step.name))

                candidate.subConfig(step, false)
                    .forEach((value: ConfigValue, key: string) => {
                        points.push(new cpc.LinePoint(key, value))
                    })
            })

            // Fill missing steps in pipeline and final performance measure
            axes.slice(structure.pipeline.steps.length).forEach(axis => {
                const value = axis.id === '__performance__' ? candidate.loss : undefined
                points.push(new cpc.LinePoint(axis.id, value))
            })
            return new cpc.Line(candidate.id, points)
        })

        return new cpc.Model(axes, lines)
    }
}
