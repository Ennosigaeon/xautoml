import * as cpc from "./model";
import * as d3 from "d3";
import {Candidate, Config, ConfigValue, MetaInformation, Structure} from "../../model";

export namespace ParCord {


    import HyperParameter = Config.HyperParameter;
    import Condition = Config.Condition;
    import CategoricalHyperparameter = Config.CategoricalHyperparameter;
    import NumericalHyperparameter = Config.NumericalHyperparameter;

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
        const ids = [].concat(...choices.map((c, i) => [c.label, ...Array(...Array(weights[i])).map((_, j) => `_${c.label}_${j}_`)]))

        return d3.scaleBand(ids, range)
    }

    export function parseRunhistory(meta: MetaInformation,
                                    structures: Structure[],
                                    candidates: [Candidate, Structure][],
                                    explanation: Config.Explanation): cpc.Model {
        function getId(step: number, component: string, hp: string): string {
            const name = hp.split(':')
            return `${step}:${component}:${name[name.length - 1]}`
        }

        function parseHyperparameter(step: number, component: string, hp: HyperParameter, conditions: Condition[]): cpc.Axis {
            const id = getId(step, component, hp.name)
            if (hp instanceof NumericalHyperparameter) {
                const domain = new cpc.Domain(hp.lower, hp.upper, hp.log)
                return cpc.Axis.Numerical(id, hp.name, domain, explanation)
            } else {
                const choices = (hp as CategoricalHyperparameter).choices
                    .map(choice => new cpc.Choice(choice as ConfigValue, []))

                hp.subParameters.forEach(child => {
                    conditions.filter(con => con.parent === hp.name && con.child === child.name)[0].values
                        .forEach(v =>
                            choices.filter(c => c.label === v)
                                .forEach(c => c.axes.push(parseHyperparameter(step, component, child, conditions)))
                        )
                })
                return cpc.Axis.Categorical(id, hp.name, choices, explanation)
            }
        }

        function parseConfigSpace() {
            const components: Array<[Set<string>, Array<cpc.Choice>]> = []
            structures.forEach(structure => {
                structure.pipeline.steps.forEach((step, idx) => {
                    if (components.length === idx)
                        components.push([new Set<string>(), []])

                    if (!components[idx][0].has(step.label)) {
                        const axes = structure.configspace.getHyperparameters(step.id)
                            .map((hp: HyperParameter) => parseHyperparameter(idx, step.label, hp, structure.configspace.conditions))
                        components[idx][1].push(new cpc.Choice(step.label, axes))
                        components[idx][0].add(step.label)
                    }
                })
            })
            const axes = components.map(([_, choices], idx) => cpc.Axis.Categorical(`${idx}`, `Component ${idx}`, choices, explanation))

            const lowerPerf = Math.min(meta.worstPerformance, meta.bestPerformance)
            const upperPerf = Math.max(meta.worstPerformance, meta.bestPerformance)
            const padding = (upperPerf - lowerPerf) * 0.05
            axes.push(cpc.Axis.Numerical('__performance__', meta.metric,
                new cpc.Domain(lowerPerf - padding, upperPerf + padding, false)))
            return axes
        }

        const axes = parseConfigSpace()

        const lines = candidates.map(([candidate, structure]) => {
            const points = new Array<cpc.LinePoint>()
            structure.pipeline.steps.map((step, idx) => {
                points.push(new cpc.LinePoint(`${idx}`, step.label))

                candidate.subConfig(step, false)
                    .forEach((value: ConfigValue, key: string) => {
                        points.push(new cpc.LinePoint(getId(idx, step.label, key), value))
                    })
            })

            // Fill missing steps in pipeline and final performance measure
            axes.slice(structure.pipeline.steps.length).forEach(axis => {
                const value = axis.id === '__performance__' ? candidate.loss : undefined
                points.push(new cpc.LinePoint(`${axis.id}`, value))
            })
            return new cpc.Line(candidate.id, points)
        })

        return new cpc.Model(axes, lines)
    }
}
