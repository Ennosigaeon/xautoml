import React from "react";
import {Jupyter} from "./jupyter";
import {CandidateId} from "./model";

export type Primitive = string | number | boolean | Date | undefined

// For reasons, JupyterContext can not be declared in root.tsx and imported in dataset_details.tsx...
export const JupyterContext = React.createContext<Jupyter>(undefined)

export function cidToSid(cid: CandidateId): string {
    return cid.substring(0, cid.indexOf(':', 4))
}

const floatRegex = /^-?\d+(?:[.,]\d*?)?$/;

export function prettyPrint(value: Primitive, prec: number = 3): string {
    if (value === undefined || value === null)
        return 'None'
    else if (typeof value === 'number')
        return fixedPrec(value, prec).toString()
    else if (value instanceof Date)
        return (value as Date).toLocaleString()
    else if (typeof value === 'string') {
        const num = parseFloat(value)
        if (floatRegex.test(value) && !isNaN(num))
            return fixedPrec(num, prec).toString()
        else
            return value
    } else
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


export function maxLabelLength(labels: string[]) {
    return Math.max(...labels.map(d => d
        .replace('data_preprocessor:feature_type:numerical_transformer:', '')
        .replace('data_preprocessor:feature_type:categorical_transformer:', '')
        .length)) * 5
}


export namespace Colors {
    export const DEFAULT: string = '#abe2fb'
    export const HIGHLIGHT: string = '#2196f3'
    export const BORDER: string = '#b8b8b8'
    export const ADDITIONAL_FEATURE: string = '#aaa'
    export const SELECTED_FEATURE: string = '#444'


    export const EXTENDED_DISCRETE_COLOR_RANGE = [
        Colors.HIGHLIGHT,
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


export namespace Components {

    export const SOURCE: string = 'SOURCE'
    export const SINK: string = 'SINK'
    export const ENSEMBLE: string = 'ENSEMBLE'

    export function isPipEnd(id: string): boolean {
        return id === Components.SOURCE || id === Components.SINK
    }
}
