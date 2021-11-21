import {URLExt} from '@jupyterlab/coreutils';

import {ServerConnection} from '@jupyterlab/services';
import {CandidateId} from "./model";

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
    const promise = requestAPI<Map<string, LinePoint[]>>('roc_auc', {
        method: 'POST', body: JSON.stringify({
            'cids': cids.join(','),
            'data_file': data_file,
            'model_dir': model_dir
        })
    }).then(data => new Map<string, LinePoint[]>(Object.entries(data)))
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
    //         "label": "0"
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

export type ContinuousHPImportance = { "x": number, "y": number, "area": [number, number] }[]

export interface HPImportance {
    name: string[]
    mode: 'discrete' | 'continuous' | 'heatmap'
    data: any[] | any
}

export function requestFANOVAOverview(cid: CandidateId, step: string): Promise<any> {
    const promise = new Promise<any>(((resolve, reject) => {
        resolve(
            {
                "hyperparameters": ["1:1.1:add_indicator", "1:1.1:strategy", "1:1.2:1.2.2:add_indicator", "1:1.2:1.2.2:strategy", "2:criterion", "2:max_depth_factor", "2:min_samples_leaf_factor", "2:min_samples_split_factor"],
                "importance": {
                    "2:min_samples_leaf_factor___2:min_samples_split_factor": 1.0,
                    "2:max_depth_factor___2:min_samples_leaf_factor": 0.9827009060844569,
                    "1:1.2:1.2.2:add_indicator___2:min_samples_leaf_factor": 0.9783818642491183,
                    "2:criterion___2:min_samples_leaf_factor": 0.972633544087044,
                    "1:1.2:1.2.2:strategy___2:min_samples_leaf_factor": 0.9721969648909152,
                    "1:1.1:strategy___2:min_samples_leaf_factor": 0.9721472783613292,
                    "1:1.1:add_indicator___2:min_samples_leaf_factor": 0.9714614852853692,
                    "2:min_samples_leaf_factor": 0.9712655111152928,
                    "2:max_depth_factor___2:min_samples_split_factor": 0.015083182512246916,
                    "1:1.2:1.2.2:add_indicator___2:min_samples_split_factor": 0.013100897918394111,
                    "1:1.2:1.2.2:strategy___2:min_samples_split_factor": 0.01295408274986387,
                    "1:1.1:strategy___2:min_samples_split_factor": 0.011861424210412403,
                    "2:criterion___2:min_samples_split_factor": 0.011696768679721505,
                    "1:1.1:add_indicator___2:min_samples_split_factor": 0.011341843854596988,
                    "2:min_samples_split_factor": 0.011229480542764826,
                    "1:1.2:1.2.2:add_indicator___2:max_depth_factor": 0.005342590518449394,
                    "1:1.1:strategy___2:max_depth_factor": 0.002651530619699719,
                    "1:1.2:1.2.2:strategy___2:max_depth_factor": 0.0025592384233578415,
                    "2:criterion___2:max_depth_factor": 0.00231288058484904,
                    "1:1.1:add_indicator___2:max_depth_factor": 0.0022037121601876206,
                    "1:1.2:1.2.2:add_indicator___1:1.2:1.2.2:strategy": 0.0020996358726088522,
                    "2:max_depth_factor": 0.002051418637297774,
                    "1:1.1:strategy___1:1.2:1.2.2:add_indicator": 0.0020016598030304492,
                    "1:1.1:add_indicator___1:1.2:1.2.2:add_indicator": 0.0018310564592453652,
                    "1:1.2:1.2.2:add_indicator___2:criterion": 0.0017888410919606407,
                    "1:1.2:1.2.2:add_indicator": 0.001695649329002862,
                    "1:1.1:strategy___1:1.2:1.2.2:strategy": 0.0005438800779758796,
                    "1:1.1:add_indicator___1:1.1:strategy": 0.0003926989064698032,
                    "1:1.2:1.2.2:strategy___2:criterion": 0.0003366794319511791,
                    "1:1.1:add_indicator___1:1.2:1.2.2:strategy": 0.0003300963851902298,
                    "1:1.1:strategy___2:criterion": 0.0003190081158677089,
                    "1:1.2:1.2.2:strategy": 0.00024053853567248005,
                    "1:1.1:strategy": 0.00021349886484311087,
                    "1:1.1:add_indicator___2:criterion": 9.321623231584502e-05,
                    "2:criterion": 3.7891722182266998e-06,
                    "1:1.1:add_indicator": 0.0
                },
                "std": {
                    "2:min_samples_leaf_factor___2:min_samples_split_factor": 0.04591092987504182,
                    "2:max_depth_factor___2:min_samples_leaf_factor": 0.04333560438925979,
                    "1:1.2:1.2.2:add_indicator___2:min_samples_leaf_factor": 0.03623833821169296,
                    "2:criterion___2:min_samples_leaf_factor": 0.0508046850085868,
                    "1:1.2:1.2.2:strategy___2:min_samples_leaf_factor": 0.04995669226063303,
                    "1:1.1:strategy___2:min_samples_leaf_factor": 0.05039356307266139,
                    "1:1.1:add_indicator___2:min_samples_leaf_factor": 0.050230275690056655,
                    "2:min_samples_leaf_factor": 0.050323768141948506,
                    "2:max_depth_factor___2:min_samples_split_factor": 0.012393810256314752,
                    "1:1.2:1.2.2:add_indicator___2:min_samples_split_factor": 0.0133963221451614,
                    "1:1.2:1.2.2:strategy___2:min_samples_split_factor": 0.013872185685952644,
                    "1:1.1:strategy___2:min_samples_split_factor": 0.01269569251844798,
                    "2:criterion___2:min_samples_split_factor": 0.012246835194645327,
                    "1:1.1:add_indicator___2:min_samples_split_factor": 0.012335235520344726,
                    "2:min_samples_split_factor": 0.012401612151680903,
                    "1:1.2:1.2.2:add_indicator___2:max_depth_factor": 0.01013388600338646,
                    "1:1.1:strategy___2:max_depth_factor": 0.0029605512248976,
                    "1:1.2:1.2.2:strategy___2:max_depth_factor": 0.00296053454919686,
                    "2:criterion___2:max_depth_factor": 0.0029488688165896487,
                    "1:1.1:add_indicator___2:max_depth_factor": 0.0030086503945940916,
                    "1:1.2:1.2.2:add_indicator___1:1.2:1.2.2:strategy": 0.004677344552157955,
                    "2:max_depth_factor": 0.0028879037256801265,
                    "1:1.1:strategy___1:1.2:1.2.2:add_indicator": 0.004333148531783201,
                    "1:1.1:add_indicator___1:1.2:1.2.2:add_indicator": 0.004513844851251373,
                    "1:1.2:1.2.2:add_indicator___2:criterion": 0.004345726765427604,
                    "1:1.2:1.2.2:add_indicator": 0.0043785932915637715,
                    "1:1.1:strategy___1:1.2:1.2.2:strategy": 0.0004967633305921048,
                    "1:1.1:add_indicator___1:1.1:strategy": 0.0008799809252033376,
                    "1:1.2:1.2.2:strategy___2:criterion": 0.00034684503633069364,
                    "1:1.1:add_indicator___1:1.2:1.2.2:strategy": 0.0003105437672760652,
                    "1:1.1:strategy___2:criterion": 0.0005371763513051318,
                    "1:1.2:1.2.2:strategy": 0.0003160287088109523,
                    "1:1.1:strategy": 0.0005188948129518112,
                    "1:1.1:add_indicator___2:criterion": 0.00017013092354492082,
                    "2:criterion": 5.601071021655069e-05,
                    "1:1.1:add_indicator": 0.00013993611658954006
                }
            }
        )
    }))

    return promise
}

export function requestFANOVADetails(cid: CandidateId, step: string): Promise<HPImportance[]> {
    // Fake data for faster development
    const promise = new Promise<HPImportance[]>(((resolve, reject) => {
        resolve([
                {
                    "name": ["1:1.1:add_indicator"],
                    "mode": "discrete",
                    "data": {
                        "true": [0.9890371389750009, 0.9894838053091545],
                        "false": [0.9890800907380859, 0.9895627141327983]
                    }
                },
                {
                    "name": ["2:min_samples_leaf_factor"],
                    "mode": "continuous",
                    "data": [
                        {"x": 1e-07, "y": 0.9930357610515442, "area": [0.9943632009104826, 0.9917083211926059]},
                        {"x": 0.062500075, "y": 0.9970865876729753, "area": [0.9974310619953092, 0.9967421133506414]},
                        {"x": 0.12500005, "y": 0.984586331591529, "area": [0.9899095375869649, 0.9792631255960931]},
                        {"x": 0.18750002500, "y": 0.9821125911435755, "area": [0.9826414445549955, 0.9815837377321556]},
                        {"x": 0.25, "y": 0.9818033014070633, "area": [0.9820840631071402, 0.9815225397069863]}]
                },
                {
                    "name": ["1:1.1:add_indicator", "2:min_samples_leaf_factor"],
                    "mode": "continuous",
                    "data": [
                        {"x": 1e-07, "true": 0.9930269891255136, "false": 0.993044532977575},
                        {"x": 0.062500075, "true": 0.9970763884596203, "false": 0.9970967868863303},
                        {"x": 0.12500005, "true": 0.9845324086379921, "false": 0.9846402545450658},
                        {"x": 0.18750002500000001, "true": 0.9820596563381794, "false": 0.9821655259489718},
                        {"x": 0.25, "true": 0.9817503666016669, "false": 0.9818562362124593}]
                },
                {
                    "name": ["1:1.1:add_indicator", "1:1.1:strategy"],
                    "mode": "heatmap",
                    "data": {
                        "mean": {"true": 0.9892690218266527, "false": 0.9893491122235408},
                        "median": {"true": 0.989619348233015, "false": 0.9896940056493079},
                        "most_frequent": {"true": 0.9892793446828742, "false": 0.9893437738811252}
                    }
                }
            ]
        )
    }))

    return promise.then(data => data.map(d => {
            if (d.mode === 'discrete')
                d.data = new Map<string, [number, number]>(Object.entries(d.data))
            return d
        }
    ))
}
