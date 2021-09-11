import * as cpc from "./model";
import * as d3 from "d3";

export namespace ParCord {
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

        return d3.scaleBand(ids, range).padding(0.01)
    }

    export function yScale(choices: Array<cpc.Choice>, range: [number, number]): d3.ScaleBand<string> {
        const weights = choices.map(c => c.getHeightWeight() - 1)
        const ids = [].concat(...choices.map((c, i) => [c.id, ...Array(...Array(weights[i])).map((_, j) => `_${c.id}_${j}_`)]))

        return d3.scaleBand(ids, range)
    }
}
