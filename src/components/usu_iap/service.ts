import {ServerConnection} from "@jupyterlab/services";
import {URLExt} from "@jupyterlab/coreutils";
import {DeploymentModel, DeploymentResult, ResourceLimits} from "./model";

class RestApiService {
    static readonly apiNamespace = 'usuai_jupyter';

    /**
     * Call the API extension
     *
     * @param endPoint API REST end point for the extension
     * @param init Initial values for the request
     * @param token bearerToken to be sent to jupyter backend, defaults to token from session storage (AuthzService.bearerToken)
     * @returns The response body interpreted as JSON
     */
    static async requestAPI<T>(endPoint = '', init: RequestInit = {}, token?: string): Promise<T> {
        const response: Response = await this.doRequest(endPoint, init, token);
        const data: any = await this.parseResponse(response);

        if (response.ok) {
            return data as T;
        }

        this.handleError(data, response);
    }

    // Make request to Jupyter API
    private static async doRequest(endPoint: string, init: RequestInit, token?: string): Promise<Response> {
        this.addTokenHeader(token, init, endPoint);

        const settings = ServerConnection.makeSettings();
        const requestUrl = URLExt.join(settings.baseUrl, this.apiNamespace, endPoint);

        return await ServerConnection.makeRequest(requestUrl, init, settings);
    }

    private static addTokenHeader(token: string, init: RequestInit, endPoint: string): void {
        if (!token) {
            // TODO AuthToken missing
            token = 'foobar'
        }

        if (token) {
            const authTokenName = 'x-auth-usu-token';
            const headers: Headers = new Headers(init.headers);
            headers.set(authTokenName, token);
            init.headers = headers;
        } else {
            console.log(`Missing API token for endPoint: ${endPoint}`);
        }
    }

    private static async parseResponse(response: Response): Promise<any> {
        const responseText: string = await response.text();
        if (responseText.length > 0) {
            try {
                return JSON.parse(responseText);
            } catch (error) {
                throw new ServerConnection.ResponseError(response, 'Unexpected response type');
            }
        }
        return {};
    }

    private static handleError(data: any, response: Response): void {
        let message = data.message || data;
        if (message instanceof Object) {
            message = JSON.stringify(message);
        }
        throw new ServerConnection.ResponseError(response, message);
    }
}


export namespace IAPService {
    export function getLimits(): Promise<ResourceLimits> {
        return RestApiService.requestAPI<ResourceLimits>('limits', {method: 'GET'});
    }

    export function createDeployment(value: DeploymentModel): Promise<DeploymentResult> {
        return RestApiService.requestAPI<DeploymentResult>('deployment', {
            body: JSON.stringify(value),
            method: 'POST'
        });
    }
}
