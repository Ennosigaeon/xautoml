import * as cpc from "./model";
import {PARENT_MARKER} from "./model";
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

    export function xScale(columns: cpc.Axis[][], range: [number, number]): d3.ScaleBand<string>[] {
        const maxRows = Math.max(...columns.map(row => row.length))

        const scales = []
        for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
            const axes = columns.map(rows => rows[Math.min(rows.length - 1, rowIdx)])

            const weights = axes.map(a => a.getWidthWeight() - 1)
            const ids = [].concat(...axes.map((a, i) => [a.id, ...Array(...Array(weights[i])).map((_, j) => `_${a.id}_${j}_`)]))

            const scale = d3.scaleBand(ids, range).padding(0.1)
            scales.push(scale)
        }
        return scales
    }

    export function yScale(choices: cpc.Choice[], range: [number, number]): d3.ScaleBand<string> {
        const weights = choices.map(c => c.getHeightWeight() - 1)
        const ids = [].concat(...choices.map((c, i) => [c.value, ...Array(...Array(weights[i])).map((_, j) => `_${c.value}_${j}_`)]))

        return d3.scaleBand(ids, range)
    }

    class ParallelAxes {

        public readonly choices: Map<string, cpc.Choice>

        constructor(public readonly commonStepName: string, public readonly otherPaths: string[]) {
            this.choices = new Map<string, cpc.Choice>()
        }

        has(step: string) {
            return this.choices.has(step)
        }
    }

    export function parseConfigSpace(structures: Structure[], perfAxis: cpc.PerformanceAxis): cpc.Axis[][] {
        // TODO: clean-up this mess...

        function parseHyperparameter(hp: HyperParameter, conditions: Condition[], stepId: string): cpc.Axis {
            const id = hp.name
            if (hp instanceof NumericalHyperparameter)
                return cpc.Axis.Numerical(`${stepId}::${id}`, hp.name, new cpc.Domain(hp.lower, hp.upper, hp.log))
            else {
                const choices = (hp as CategoricalHyperparameter).choices
                    .map(choice => new cpc.Choice(choice as ConfigValue, []))

                hp.subParameters.forEach(child => {
                    conditions.filter(con => con.parent === hp.name && con.child === child.name)[0].values
                        .forEach(v =>
                            choices.filter(c => c.value === v)
                                .forEach(c => c.axes.push([parseHyperparameter(child, conditions, stepId)]))
                        )
                })
                return cpc.Axis.Categorical(`${stepId}::${id}`, hp.name, choices)
            }
        }

        const nameToIndex = new Map<string, number>()
        const comp: Map<string, ParallelAxes>[] = []

        structures.forEach(structure => {
            structure.pipeline.slice(1).forEach(step => {
                const idx = Math.max(-1, ...step.parentIds.map(pid => nameToIndex.get(pid))
                    .filter(pid => pid !== undefined)) + 1
                nameToIndex.set(step.id, idx)

                if (comp.length === idx)
                    comp.push(new Map<string, ParallelAxes>())

                const commonStepName = step.step_name
                if (!comp[idx].has(commonStepName))
                    comp[idx].set(commonStepName, new ParallelAxes(commonStepName, step.parallel_paths.length === 0 ? [step.step_name] : step.parallel_paths))

                if (!comp[idx].get(commonStepName).has(step.id)) {
                    const axes_ = structure.configspace.getHyperparameters(step.config_prefix)
                        .map(hp => [parseHyperparameter(hp, structure.configspace.conditions, step.id)])
                    const axes = axes_.length === 0 ? [[]] : axes_

                    const label = !Number.isNaN(Number.parseInt(step.label)) || !step.label ? step.label : undefined
                    const parAxes = comp[idx].get(commonStepName)
                    parAxes.choices.set(step.id, new cpc.Choice(step.label, axes, true, label))
                }
            })
        })

        const columns = comp.map((steps, idx) => {
            const parallelAxes: cpc.Axis[] = []
            const addedAxes = new Set<string>()

            steps.forEach(parAxes => {
                // TODO longer path has to be the first one. Ensure this!
                parAxes.otherPaths.forEach(pathId => {
                    if (addedAxes.has(pathId))
                        return

                    let key
                    if (steps.has(pathId))
                        key = pathId
                    else
                        key = Array.from(steps.keys()).filter(k => k.startsWith(pathId)).pop()

                    const values = key !== undefined && steps.has(key) ? Array.from(steps.get(key).choices.values()) : []
                    const name = key !== undefined ? key : pathId

                    addedAxes.add(pathId)
                    parallelAxes.push(cpc.Axis.Categorical(`${idx}.${name}`, name, values))
                })
            })
            return parallelAxes
        })

        if (perfAxis !== undefined) {
            const lowerPerf = Math.min(...perfAxis.domain)
            const upperPerf = Math.max(...perfAxis.domain)
            columns.push([
                cpc.Axis.Numerical('__performance__', perfAxis.label, new cpc.Domain(lowerPerf, upperPerf, perfAxis.log))
            ])
        }

        return columns.map(rows => {
            return rows.map(axis => {
                if (axis.isNumerical())
                    return axis
                if (axis.choices.length <= 1)
                    return axis
                return cpc.Axis.Categorical(`${axis.id}.${PARENT_MARKER}`, axis.name, [new cpc.Choice(axis.name, [[axis]], true, axis.label)])
            })
        })
    }

    export function parseCandidates(candidates: [Candidate, Structure][], axes: cpc.Axis[][]): cpc.Line[] {
        const nameToIndex = new Map<string, number>()
        candidates.forEach(([_, structure]) => {
            structure.pipeline.slice(1).forEach(step => {
                const idx = Math.max(-1, ...step.parentIds.map(pid => nameToIndex.get(pid))
                    .filter(pid => pid !== undefined)) + 1
                nameToIndex.set(step.id, idx)
            })
        })

        // noinspection UnnecessaryLocalVariableJS
        const lines = candidates.map(([candidate, structure]) => {
            const points = new Array<cpc.LinePoint>()
            structure.pipeline.slice(1).map(step => {
                const commonStepName = step.step_name
                points.push(new cpc.LinePoint(`${nameToIndex.get(step.id)}.${commonStepName}.${PARENT_MARKER}`, commonStepName))
                points.push(new cpc.LinePoint(`${nameToIndex.get(step.id)}.${commonStepName}`, step.label))

                candidate.subConfig(step, false)
                    .forEach((value: ConfigValue, name: string) => {
                        points.push(new cpc.LinePoint(`${step.id}::${name}`, value))
                    })
            })

            // Fill missing steps in pipeline and final performance measure
            // noinspection UnnecessaryLocalVariableJS
            const lastStep = structure.pipeline[structure.pipeline.length - 1].id
            axes.slice(nameToIndex.get(lastStep) + 1).forEach((axes: cpc.Axis[]) => {
                axes.forEach(axis => {
                    const value = axis.id === '__performance__' ? candidate.loss : undefined
                    points.push(new cpc.LinePoint(axis.id, value))
                })
            })

            return new cpc.Line(candidate.id, points, candidate.runtime ? candidate.runtime.timestamp : 0)
        }).sort((a, b) => a.timestamp - b.timestamp)
        return lines
    }
}
