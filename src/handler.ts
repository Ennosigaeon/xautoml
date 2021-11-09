import {URLExt} from '@jupyterlab/coreutils';

import {ServerConnection} from '@jupyterlab/services';
import {CandidateId} from "./model";
import {LineSeriesPoint} from "react-vis";

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
        try {
            data = JSON.parse(data);
        } catch (error) {
            console.log('Not a JSON response body.', response);
        }
    }

    if (!response.ok) {
        throw new ServerError(response, data?.name, data?.message)
    }

    return data;
}


export type RocCurveData = Map<string, LineSeriesPoint[]>

export type Label = number | string

export interface LimeResult {
    idx: number
    expl: Map<Label, LocalExplanation>
    prob: Map<Label, number>
    label: Label,
    additional_features: boolean
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
    additional_features: boolean
}

export type LocalExplanation = Array<[string, number]>

export interface FeatureImportance {
    data: Map<string, number>,
    additional_features: boolean
}

export function requestRocCurve(cids: CandidateId[], data_file: string, model_dir: string): CancelablePromise<RocCurveData> {
    const promise = requestAPI<Map<string, LineSeriesPoint[]>>('roc_auc', {
        method: 'POST', body: JSON.stringify({
            'cids': cids.join(','),
            'data_file': data_file,
            'model_dir': model_dir
        })
    }).then(data => new Map<string, LineSeriesPoint[]>(Object.entries(data)))
    return cancelablePromise(promise)
}

export type OutputDescriptionData = Map<string, string>

export async function requestOutputComplete(cid: CandidateId, data_file: string, model_dir: string): Promise<OutputDescriptionData> {
    return requestOutput(cid, data_file, model_dir, 'complete')
}

export async function requestOutputDescription(cid: CandidateId, data_file: string, model_dir: string): Promise<OutputDescriptionData> {
    return requestOutput(cid, data_file, model_dir, 'description')
}

async function requestOutput(cid: CandidateId, data_file: string, model_dir: string, method: string): Promise<OutputDescriptionData> {
    return requestAPI<Map<string, Map<string, string>>>(`output/${method}`, {
        method: 'POST', body: JSON.stringify({
            'cids': cid,
            'data_file': data_file,
            'model_dir': model_dir
        })
    }).then(data => {
        return new Map<string, string>(Object.entries(data))
    })
}

export interface ConfusionMatrixData {
    classes: string[]
    values: number[][]
}

export async function requestConfusionMatrix(cid: CandidateId, data_file: string, model_dir: string): Promise<ConfusionMatrixData> {
    return requestAPI<ConfusionMatrixData>(`confusion_matrix`, {
        method: 'POST', body: JSON.stringify({
            'cids': cid,
            'data_file': data_file,
            'model_dir': model_dir
        })
    })
}

export function requestLimeApproximation(cid: CandidateId, idx: number, data_file: string, model_dir: string, step: string): CancelablePromise<LimeResult> {
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
    //         "label": 0
    //     })
    // })

    const promise = requestAPI<LimeResult>('explanations/lime', {
        method: 'POST', body: JSON.stringify({
            'cids': cid,
            'idx': idx,
            'data_file': data_file,
            'model_dir': model_dir,
            'step': step
        })
    })
    return cancelablePromise(promise.then(data => {
        data.expl = new Map<Label, LocalExplanation>(Object.entries(data.expl))
        data.prob = new Map<Label, number>(Object.entries(data.prob))
        return data
    }))
}

export function requestGlobalSurrogate(cid: CandidateId, data_file: string, model_dir: string, step: string, max_leaf_nodes: number = 10): CancelablePromise<DecisionTreeResult> {
    const promise = requestAPI<DecisionTreeResult>('explanations/dt', {
        method: 'POST', body: JSON.stringify({
            'cids': cid,
            'data_file': data_file,
            'model_dir': model_dir,
            'step': step,
            'max_leaf_nodes': max_leaf_nodes
        })
    })
    return cancelablePromise(promise)
}

export function requestFeatureImportance(cid: CandidateId, data_file: string, model_dir: string, step: string): CancelablePromise<FeatureImportance> {
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

    const promise = requestAPI<FeatureImportance>('explanations/feature_importance', {
        method: 'POST', body: JSON.stringify({
            'cids': cid,
            'data_file': data_file,
            'model_dir': model_dir,
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
