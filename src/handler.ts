import {URLExt} from '@jupyterlab/coreutils';

import {ServerConnection} from '@jupyterlab/services';
import {CandidateId, Config} from "./model";
import memoizee from "memoizee";


export class ServerError extends Error {

    constructor(public readonly response: Response, name?: string, message?: string, public readonly traceback?: string) {
        super(message);
        if (name)
            super.name = name
    }
}


export class CanceledPromiseError extends Error {
    constructor() {
        super("Promise canceled");
    }
}

export interface CancelablePromise<T> extends Promise<T> {

    cancel(): void
}

function cancelablePromise<T>(promise: Promise<T>): CancelablePromise<T> {
    let isCanceled = false;

    const wrappedPromise = new Promise<T>((resolve, reject) => {
        Promise.resolve(promise).then(
            value => (isCanceled ? reject(new CanceledPromiseError()) : resolve(value)),
            error => reject(error),
        );
    });

    // @ts-ignore
    wrappedPromise.cancel = () => (isCanceled = true);
    return wrappedPromise as CancelablePromise<T>;
}


/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function requestAPI<T>(
    endPoint = '',
    init: RequestInit = {}
): Promise<T> {
    // Make request to Jupyter API
    const settings = ServerConnection.makeSettings();
    const requestUrl = URLExt.join(
        settings.baseUrl,
        'xautoml', // API Namespace
        endPoint
    );

    let response: Response;
    try {
        response = await ServerConnection.makeRequest(requestUrl, init, settings);
    } catch (error) {
        throw new ServerConnection.NetworkError(error);
    }

    let data: any = await response.text();

    if (data.length > 0) {
        data = JSON.parse(data);
    }

    if (!response.ok) {
        throw new ServerError(response, data?.name, data?.message)
    }

    return data;
}

const memRequestAPI = memoizee(requestAPI, {
    promise: true, primitive: true, length: 2, max: 100, normalizer: (args => {
        return `\u0001${args[0]}\u0001${args[1].body}`;
    })
});

export interface LinePoint {
    x: number
    y: number
}

export type RocCurveData = Map<string, LinePoint[]>

export type Label = number | string

export interface LimeResult {
    idx: number
    expl: Map<Label, LocalExplanation>
    prob: Map<Label, number>
    label: Label
    categorical_input: boolean
    additional_features: string[]
}

export interface DecisionTreeNode {
    label: string,
    children: DecisionTreeNode[]
}

export interface DecisionTreeResult {
    fidelity: number,
    n_pred: number,
    n_leaves: number,
    root: DecisionTreeNode,
    max_leaf_nodes: number,
    additional_features: string[],
    downsampled: boolean
}

export type LocalExplanation = Array<[string, number]>

export interface FeatureImportance {
    data: Map<string, number>,
    additional_features: string[],
    downsampled: boolean
}

export function requestRocCurve(cids: CandidateId[], model_files: string[], data_file: string): CancelablePromise<RocCurveData> {
    const promise = memRequestAPI<Map<string, LinePoint[]>>('roc_auc', {
        method: 'POST', body: JSON.stringify({
            'cids': cids.slice(0, 50).join(','), // Truncate to at most 50 ids due to performance reasons
            'data_file': data_file,
            'model_files': model_files.join(',')
        })
    }).then(data => new Map<string, LinePoint[]>(Object.entries(data)))
    return cancelablePromise(promise)
}

export interface OutputDescriptionData {
    data: Map<string, string>
    downsampled: boolean
}

export async function requestOutputComplete(model_file: string, data_file: string): Promise<OutputDescriptionData> {
    return requestOutput(model_file, data_file, 'complete')
}

export async function requestOutputDescription(model_file: string, data_file: string): Promise<OutputDescriptionData> {
    return requestOutput(model_file, data_file, 'description')
}

async function requestOutput(model_file: string, data_file: string, method: string): Promise<OutputDescriptionData> {
    return memRequestAPI<OutputDescriptionData>(`output/${method}`, {
        method: 'POST', body: JSON.stringify({
            'data_file': data_file,
            'model_files': model_file
        })
    }).then(data => {
        return {data: new Map<string, string>(Object.entries(data.data)), downsampled: data.downsampled}
    })
}

export interface ConfusionMatrixData {
    classes: string[]
    values: number[][]
}

export async function requestConfusionMatrix(model_file: string, data_file: string): Promise<ConfusionMatrixData> {
    return memRequestAPI<ConfusionMatrixData>(`confusion_matrix`, {
        method: 'POST', body: JSON.stringify({
            'data_file': data_file,
            'model_files': model_file
        })
    })
}

export function requestLimeApproximation(model_file: string, idx: number, data_file: string, step: string): CancelablePromise<LimeResult> {
    // Fake data for faster development
    // const promise = new Promise<LimeResult>((resolve, reject) => {
    //     resolve({
    //         "idx": 0,
    //         "expl": {
    //             // @ts-ignore
    //             "0": [["576.00 < e <= 7645.46", 0.05793208203765528], ["32.00 < t <= 424.75", -0.014515266014365737], ["12.00 < loc <= 45.00", 0.011024354544654624], ["20.08 < i <= 38.55", -0.009705658982473364], ["ev(g) <= 1.00", 0.00962771642667607], ["1.00 < iv(g) <= 2.00", -0.008614981836724617], ["6.00 < d <= 15.00", -0.008038553896323998], ["3.00 < branchCount <= 9.00", -0.007916072380450659], ["25.00 < n <= 103.00", -0.0069804039399546216], ["lOComment <= 0.00", -0.005071969142608168]],
    //             "1": [["576.00 < e <= 7645.46", -0.05793208203765534], ["32.00 < t <= 424.75", 0.014515266014365756], ["12.00 < loc <= 45.00", -0.01102435454465464], ["20.08 < i <= 38.55", 0.00970565898247338], ["ev(g) <= 1.00", -0.009627716426676045], ["1.00 < iv(g) <= 2.00", 0.00861498183672467], ["6.00 < d <= 15.00", 0.00803855389632401], ["3.00 < branchCount <= 9.00", 0.007916072380450655], ["25.00 < n <= 103.00", 0.006980403939954652], ["lOComment <= 0.00", 0.005071969142608183]]
    //         },
    //         // @ts-ignore
    //         "prob": {"0": 0.865458461894008, "1": 0.1345415381059912},
    //         "label": "0"
    //     })
    // })

    const promise = memRequestAPI<LimeResult>('explanations/lime', {
        method: 'POST', body: JSON.stringify({
            'idx': idx,
            'data_file': data_file,
            'model_files': model_file,
            'step': step
        })
    })
    return cancelablePromise(promise.then(data => {
        data.expl = new Map<Label, LocalExplanation>(Object.entries(data.expl))
        data.prob = new Map<Label, number>(Object.entries(data.prob))
        return data
    }))
}

export function requestGlobalSurrogate(model_file: string, data_file: string, step: string, max_leaf_nodes: number = undefined): CancelablePromise<DecisionTreeResult> {
    const promise = memRequestAPI<DecisionTreeResult>('explanations/dt', {
        method: 'POST', body: JSON.stringify({
            'data_file': data_file,
            'model_files': model_file,
            'step': step,
            'max_leaf_nodes': max_leaf_nodes
        })
    })
    return cancelablePromise(promise)
}

export function requestFeatureImportance(model_file: string, data_file: string, step: string): CancelablePromise<FeatureImportance> {
    // Fake data for faster development
    // const promise = new Promise<any>((resolve, reject) => {
    //     resolve({
    //             "loc": {"0": 0.03681858802502227},
    //             "v(g)": {"0": 0.006409182305630012},
    //             "ev(g)": {"0": 0.010908176943699633},
    //             "iv(g)": {"0": 0.0037282171581769275},
    //             "n": {"0": 0.013147899910634364},
    //             "v": {"0": 0.0026670017873100305},
    //             "l": {"0": 0.026077971403038313},
    //             "d": {"0": 0.005074285075960638},
    //             "i": {"0": 0.004071715817694277},
    //             "e": {"0": 0.0032031948168006474},
    //             "b": {"0": 0.003479669347631731},
    //             "t": {"0": 0.004353775692582595},
    //             "lOCode": {"0": 0.006920241286863171},
    //             "lOComment": {"0": 0.0026390750670241213},
    //             "lOBlank": {"0": 0.0027424039320821823},
    //             "lOCodeAndComment": {"0": 0.0057808310991956935},
    //             "uniq_Op": {"0": 0.009902815013404797},
    //             "uniq_Opnd": {"0": 0.0},
    //             "total_Op": {"0": 0.0},
    //             "total_Opnd": {"0": 0.0},
    //             "branchCount": {"0": 0.0}
    //         }
    //     )
    // })

    const promise = memRequestAPI<FeatureImportance>('explanations/feature_importance', {
        method: 'POST', body: JSON.stringify({
            'data_file': data_file,
            'model_files': model_file,
            'step': step
        })
    })
    return cancelablePromise(promise.then(data => {
        data.data = new Map<string, number>(
            Object.entries(data.data).map(([key, value]) => [key, value['0']])
        )
        return data
    }))
}

export type ContinuousHPImportance = { "x": number, "y": number, "area": [number, number] }[]

export interface HPImportanceDetails {
    name: string[]
    mode: 'discrete' | 'continuous' | 'heatmap'
    data: any[] | any
}

export interface HPImportance {
    hyperparameters: string[]
    keys: number[][]
    importance: any[]
}

export interface FANOVAResponse {
    overview: HPImportance,
    details?: Map<number, Map<number, HPImportanceDetails>>
    error?: string
}

export function requestFANOVA(cs: Config.ConfigSpace, configs: Config[], loss: number[], step?: string): Promise<FANOVAResponse> {
    return memRequestAPI<FANOVAResponse>('hyperparameters/fanova', {
        method: 'POST', body: JSON.stringify({
            'configspace': JSON.parse(cs.json),
            'configs': configs,
            'loss': loss,
            'step': step
        })
    })
}

export function requestSimulatedSurrogate(cs: Config.ConfigSpace, configs: Config[], loss: number[]): Promise<Config.Explanation> {
    return memRequestAPI<Config.Explanation>('surrogate/simulate', {
        method: 'POST', body: JSON.stringify({
            'configspace': JSON.parse(cs.json),
            'configs': configs,
            'loss': loss
        })
    }).then(data => new Config.Explanation(new Map<string, [number, number][]>(Object.entries(data))))
}
