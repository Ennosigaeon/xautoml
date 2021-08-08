import {URLExt} from '@jupyterlab/coreutils';

import {ServerConnection} from '@jupyterlab/services';
import {CandidateId} from "./model";
import {LineSeriesPoint} from "react-vis";


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
        throw new ServerConnection.ResponseError(response, data.message || data);
    }

    return data;
}


export type RocCurveData = Map<string, LineSeriesPoint[]>

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
