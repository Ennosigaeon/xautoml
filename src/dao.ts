import {URLExt} from '@jupyterlab/coreutils';

import {ServerConnection} from '@jupyterlab/services';
import {CandidateId, Pipeline, Prediction} from "./model";

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
        throw new ServerConnection.NetworkError(error as Error);
    }

    let data: any = await response.text();

    if (data.length > 0) {
        data = JSON.parse(data);
    }

    if (!response.ok) {
        throw new Error(data?.message)
    }

    return data;
}

export interface LinePoint {
    x: number | string
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
    child_labels: string[]
    impurity: number
}

export interface DecisionTreeResult {
    fidelity: number,
    n_leaves: number,
    root: DecisionTreeNode,
    max_leaf_nodes: number,
}

export interface GlobalSurrogateResult {
    candidates: DecisionTreeResult[]
    best: number
    additional_features: string[]
}

export type LocalExplanation = Array<[string, number]>

export type OutputDescriptionData = Map<string, string>

export interface PerformanceData {
    duration: number
    val_score: number
    accuracy: number
    cm: ConfusionMatrixData
    report: Map<string, { precision: number, recall: number, 'f1-support': number, support: number }>
}

export interface ConfusionMatrixData {
    classes: string[]
    values: number[][]
}

export type ContinuousHPImportance = { "x": number, "y": number, "area": [number, number] }[]

export interface HPImportanceDetails {
    name: string[]
    mode: 'discrete' | 'continuous' | 'heatmap'
    data: any[] | any
}

export interface ImportanceOverview {
    column_names: string[]
    keys: [string, string][]
    importance: { mean: number, std: number, idx: number, errorBars?: [number, number] }[]
}

export interface FeatureImportance {
    data: ImportanceOverview,
    additional_features: string[],
}

export interface PDPResponse {
    y_range: [number, number]
    features: Map<string, SinglePDP>
}

export interface SinglePDP {
    ice: LinePoint[][]
    avg: LinePoint[]
}

export interface FANOVAOverview {
    overview: ImportanceOverview,
    error?: string
}

export interface FANOVADetails {
    details?: Map<string, Map<string, HPImportanceDetails>>
    error?: string
}

export interface ConfigSimilarityResponse {
    config: { x: number, y: number, idx: number }[],
    incumbents: { x: number, y: number, idx: number }[],
    surface: { x1: number, x2: number, y1: number, y2: number, z: number }[]
}

export interface EnsembleMemberStats {
    consensus: number
    weight: number
}

export interface EnsembleOverview {
    df: string,
    metrics: Map<CandidateId, EnsembleMemberStats>
}


export interface DecisionSurfaceResponse {
    colors: string[]
    contours: Map<CandidateId, string>
    X: LinePoint[]
    y: Prediction[]
}

export class PipelineHistory {
    merged: Pipeline[]
    individual: Pipeline[]
}
