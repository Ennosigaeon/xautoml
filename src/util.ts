import React from "react";
import {Jupyter} from "./jupyter";
import {CandidateId} from "./model";

// For reasons, JupyterContext can not be declared in root.tsx and imported in dataset_details.tsx...
export const JupyterContext = React.createContext<Jupyter>(undefined)

export function catchReactWarnings() {
    // @ts-ignore
    console.oldError = console.error;
    console.error = (...args: any[]) => {
        const ignore = args.filter(e => typeof e == 'string')
            // DataGrid keeps on complaining that only 1 element can be selected programmatically in the MIT version. This is not true, therefore we simply ignore the warning
            .filter(m => m.indexOf('can only be of 1 item in DataGrid') != -1);
        if (ignore.length === 0) { // @ts-ignore
            return console.oldError(...args);
        }
    }
}

export function cidToSid(cid: CandidateId): string {
    return cid.substring(0, cid.indexOf(':', 4))
}


export function prettyPrint(value: string | number | boolean | Date, prec: number = 3): string {
    if (typeof value === 'number')
        return fixedPrec(value, prec).toFixed(prec)
    else if (value instanceof Date)
        return (value as Date).toLocaleString()
    else
        return String(value)
}

export function fixedPrec(number: number, prec: number = 3): number {
    return Math.round(number * Math.pow(10, prec)) / Math.pow(10, prec)
}

export function normalizeComponent(component: string): string {
    return component.split('.').pop()
        .replace('Classifier', '')
        .replace('Classification', '')
        .replace('Component', '')
}


export function areSetInputsEqual(
    newInputs: readonly Set<unknown>[],
    lastInputs: readonly Set<unknown>[],
): boolean {
    const a = newInputs[0]
    const b = lastInputs[0]

    return a.size === b.size && [...a].every(value => b.has(value))
}


export namespace Colors {
    export const DEFAULT: string = '#abe2fb'
    export const HIGHLIGHT: string = '#2196f3'


    export const EXTENDED_DISCRETE_COLOR_RANGE = [
        Colors.DEFAULT,
        '#DDB27C',
        '#88572C',
        '#FF991F',
        '#F15C17',
        '#223F9A',
        '#DA70BF',
        '#125C77',
        '#4DC19C',
        '#776E57',
        '#12939A',
        '#17B8BE',
        '#F6D18A',
        '#B7885E',
        '#FFCB99',
        '#F89570',
        '#829AE3',
        '#E79FD5',
        '#1E96BE',
        '#89DAC1',
        '#B3AD9E'
    ];

    export function getColor(idx: number): string {
        return EXTENDED_DISCRETE_COLOR_RANGE[idx % EXTENDED_DISCRETE_COLOR_RANGE.length]
    }
}
