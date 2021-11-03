import React from "react";
import {Jupyter} from "./jupyter";

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
    export const DEFAULT: string = '#12939a'
    export const HIGHLIGHT: string = '#007bff'
}
