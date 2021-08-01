import {URLExt} from '@jupyterlab/coreutils';

import {ServerConnection} from '@jupyterlab/services';
import {CandidateId} from "./model";

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


export async function requestRocCurve(cids: CandidateId[], data_file: string, model_dir: string) {
    return requestAPI<any>('roc_auc', {
        method: 'POST', body: JSON.stringify({
            'cids': cids.join(','),
            'data_file': data_file,
            'model_dir': model_dir
        })
    })
}

export async function requestOutputDescription(cids: CandidateId[], data_file: string, model_dir: string): Promise<any> {
    return requestAPI<any>('output/description', {
        method: 'POST', body: JSON.stringify({
            'cids': cids.join(','),
            'data_file': data_file,
            'model_dir': model_dir
        })
    })
}
