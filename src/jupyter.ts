import {
    ConfigSimilarityResponse,
    DecisionSurfaceResponse,
    EnsembleOverview,
    FANOVADetails,
    FANOVAOverview,
    FeatureImportance,
    GlobalSurrogateResult,
    HPImportanceDetails,
    Label,
    LimeResult,
    LinePoint,
    LocalExplanation,
    OutputDescriptionData,
    PDPResponse,
    PerformanceData,
    PipelineHistory,
    RocCurveData,
    SinglePDP
} from "./dao";
import {INotebookTracker, Notebook, NotebookActions} from "@jupyterlab/notebook";
import {TagTool} from "@jupyterlab/celltags";
import {KernelMessage} from "@jupyterlab/services";
import {IDisplayData, IError, IExecuteResult, IMimeBundle, IStream} from '@jupyterlab/nbformat';
import {BO, CandidateId, PipelineStep, Prediction} from "./model";
import {Components} from "./util";
import memoizee from "memoizee";
import SOURCE = Components.SOURCE;
import {ISessionContext} from "@jupyterlab/apputils";
import {IFileBrowserFactory} from "@jupyterlab/filebrowser";

export class ServerError extends Error {

    constructor(public name: string, message: string, public readonly traceback: string[]) {
        super(message);
        super.name = name
    }
}


export class OpenedCache {
    private cache: Map<string, any> = new Map()

    public setIfNotPresent<T>(key: string, value: T) {
        if (key === undefined)
            return

        if (!this.cache.has(key))
            this.cache.set(key, value)
    }

    public get<T>(key: string) {
        if (key === undefined)
            return false
        if (!this.cache.has(key))
            return false

        return this.cache.get(key)
    }

    public set<T>(key: string, value: T) {
        if (key === undefined)
            return

        this.cache.set(key, value)
    }
}

export class KernelWrapper {

    constructor(private readonly sessionContext: ISessionContext) {
    }

    getSessionContext(): ISessionContext {
        return this.sessionContext
    }

    executeCode<T>(code: string, callback?: (msg: KernelMessage.IIOPubMessage) => void): Promise<T> {
        if (!this.sessionContext || !this.sessionContext.session?.kernel)
            return new Promise((resolve, reject) => reject('Not connected to kernel'))

        const request = this.sessionContext.session?.kernel?.requestExecute({code})

        const outputBuffer: string[] = []
        let result: IExecuteResult = undefined
        let mimeBundle: IMimeBundle = undefined
        let error: IError = undefined

        request.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
            const msgType = msg.header.msg_type;
            switch (msgType) {
                case 'error':
                    error = msg.content as IError
                    break
                case 'stream':
                    const text = (msg.content as IStream).text
                    outputBuffer.push(typeof text === 'string' ? text : text.join('\n'))
                    break
                case 'display_data':
                    const display = msg.content as IDisplayData
                    mimeBundle = display.data
                    break
                case 'execute_result':
                    result = msg.content as IExecuteResult
                    break
                default:
                    break;
            }

            if (callback)
                callback(msg)

            return;
        }

        return request.done.then(() => {
            console.log(code)
            console.log(outputBuffer.join('\n'))
            if (error) {
                throw new ServerError(error.ename, error.evalue, error.traceback)
            }
            if (result !== undefined)
                return result.data['application/json'] as unknown as T
            else if (mimeBundle !== undefined)
                return mimeBundle as unknown as T
            return undefined
        })
    }

    close() {
        this.sessionContext.dispose()
    }
}

export class Jupyter {

    private readonly LOCAL_STORAGE_CONTENT = 'xautoml-previousCellContent'
    private readonly TAG_NAME = 'xautoml-generated'
    private previousCellContent: string = undefined;

    private initialized: boolean
    public readonly collapsedState = new OpenedCache()

    constructor(private notebooks: INotebookTracker = undefined,
                private tags: TagTool = undefined,
                private sessionContext: ISessionContext = undefined,
                public readonly fileBrowserFactory: IFileBrowserFactory = undefined
    ) {
        this.previousCellContent = localStorage.getItem(this.LOCAL_STORAGE_CONTENT)

        this.initialized = false
    }

    unmount() {
        this.memExecuteCode.clear()
        this.initialized = false
    }

    executeCode<T>(code: string): Promise<T> {
        if (!this.initialized) {
            this.initialized = true
            return this.executeCode('from xautoml._helper import gcx')
                .then(() => this.executeCode(code))
        }
        const sessionContext = this.sessionContext !== undefined ? this.sessionContext : this.notebooks.currentWidget.context.sessionContext
        const wrapper = new KernelWrapper(sessionContext);
        return wrapper.executeCode(code)
    }

    private memExecuteCode = memoizee(this.executeCode, {
        promise: true, primitive: true, length: 1, max: 100
    });

    canCreateCell(): boolean {
        return this.notebooks !== undefined
    }

    createCell(content: string = ''): void {
        if (this.notebooks === undefined || this.tags === undefined)
            return

        const current = this.notebooks.currentWidget
        const notebook: Notebook = current.content
        const xautomlCell = notebook.activeCellIndex

        NotebookActions.selectBelow(notebook)
        const currentContent = notebook.activeCell.model.value.text
        if (this.tags.checkApplied(this.TAG_NAME) && currentContent === this.previousCellContent) {
            // Cell was autogenerated and not changed by user.
            NotebookActions.clearOutputs(notebook)
        } else {
            notebook.activeCellIndex = xautomlCell;
            notebook.deselectAll();
            NotebookActions.insertBelow(notebook)
            this.tags.addTag(this.TAG_NAME)
        }

        notebook.activeCell.model.value.text = content
        this.previousCellContent = content
        localStorage.setItem(this.LOCAL_STORAGE_CONTENT, content)

        notebook.activeCell.editor.focus()
    }

    requestPerformanceData(cid: CandidateId): Promise<PerformanceData> {
        return this.memExecuteCode<PerformanceData>(`gcx()._performance_data('${cid}')`)
            .then(data => {
                return {
                    duration: data.duration,
                    val_score: data.val_score,
                    accuracy: data.accuracy,
                    cm: data.cm,
                    report: new Map(Object.entries(data.report))
                }
            })
    }

    requestOutputComplete(cid: CandidateId): Promise<OutputDescriptionData> {
        return this.memExecuteCode<OutputDescriptionData>(`gcx()._output_complete('${cid}')`)
            .then(data => new Map<string, string>(Object.entries(data)))
    }

    requestOutputDescription(cid: CandidateId): Promise<OutputDescriptionData> {
        return this.memExecuteCode<OutputDescriptionData>(`gcx()._output_description('${cid}')`)
            .then(data => new Map<string, string>(Object.entries(data)))
    }

    requestLimeSurrogate(cid: CandidateId, idx: number = 0, step: string = SOURCE): Promise<LimeResult> {
        return this.memExecuteCode<LimeResult>(`gcx()._lime('${cid}', ${idx}, '${step}')`)
            .then(data => {
                return {
                    idx: data.idx,
                    label: data.label,
                    categorical_input: data.categorical_input,
                    additional_features: data.additional_features,
                    expl: new Map<Label, LocalExplanation>(Object.entries(data.expl)),
                    prob: new Map<Label, number>(Object.entries(data.prob))
                }
            })
    }

    requestGlobalSurrogate(cid: CandidateId, step: string, max_leaf_nodes: number | 'None' = 'None'): Promise<GlobalSurrogateResult> {
        return this.memExecuteCode<GlobalSurrogateResult>(
            `gcx()._decision_tree_surrogate('${cid}', '${step}', ${max_leaf_nodes})`
        )
    }

    requestFeatureImportance(cid: CandidateId, step: string = SOURCE): Promise<FeatureImportance> {
        return this.memExecuteCode<FeatureImportance>(
            `gcx()._feature_importance('${cid}', '${step}')`
        )
    }

    requestPDP(cid: CandidateId, step: string = SOURCE, features: string[] = undefined): Promise<Map<string, PDPResponse>> {
        const list = features.join('\', \'')
        return this.memExecuteCode<Map<string, PDPResponse>>(
            `gcx()._pdp('${cid}', '${step}', ['${list}'])`
        ).then(data => {
            const x: [string, PDPResponse][] = Object.entries(data as Map<string, PDPResponse>)
                .map(([clazz, pdpResponse]) => {
                    return [clazz, {
                        y_range: pdpResponse.y_range,
                        features: new Map<string, SinglePDP>(Object.entries(pdpResponse.features))
                    }]
                });
            return new Map<string, PDPResponse>(x)
        })
    }

    requestFANOVA(sid: CandidateId, step: string = 'None'): Promise<FANOVAOverview> {
        return this.memExecuteCode<FANOVAOverview>(
            `gcx()._fanova_overview('${sid}', '${step}')`
        )
    }

    requestFANOVADetails(sid: CandidateId, step: string = 'None', hps: [string, string]): Promise<FANOVADetails> {
        return this.memExecuteCode<FANOVADetails>(
            `gcx()._fanova_details('${sid}', '${step}', '${hps[0]}', '${hps[1]}')`
        ).then(data => {
            const details = new Map<string, Map<string, HPImportanceDetails>>(
                Object.entries(data.details).map(t => [t[0], new Map<string, HPImportanceDetails>(Object.entries(t[1]))])
            )
            return {details: details, error: data.error}
        })
    }

    requestSimulatedSurrogate(sid: CandidateId, timestamp: number): Promise<BO.Explanation> {
        return this.memExecuteCode<Map<string, Map<string, [number, number][]>>>(
            `gcx()._simulate_surrogate('${sid}', ${timestamp})`
        ).then(data => {
                // @ts-ignore
                return BO.Explanation.fromJson({
                    candidates: [],
                    loss: [],
                    marginalization: data,
                    selected: undefined,
                    metric: 'Performance'
                })
            }
        )
    }

    requestConfigSimilarity(): Promise<ConfigSimilarityResponse> {
        return this.memExecuteCode<ConfigSimilarityResponse>(`gcx()._config_similarity()`)
    }

    requestROCCurve(cid: CandidateId[]): Promise<RocCurveData> {
        const list = cid.join('\', \'')
        return this.memExecuteCode<RocCurveData>(`gcx()._roc_curve(['${list}'])`)
            .then(data => new Map<string, LinePoint[]>(Object.entries(data)))
    }

    requestEnsembleOverview(): Promise<EnsembleOverview> {
        return this.memExecuteCode<EnsembleOverview>(`gcx()._ensemble_overview()`)
            .then(data => {
                return {
                    df: data.df,
                    metrics: new Map(Object.entries(data.metrics))
                }
            })
    }

    requestEnsemblePredictions(idx: number): Promise<Map<CandidateId, Prediction>> {
        return this.memExecuteCode<Map<CandidateId, Prediction>>(`gcx()._ensemble_predictions(${idx})`)
            .then(data => new Map<CandidateId, Prediction>(Object.entries(data)))
    }


    requestEnsembleDecisionSurface(): Promise<DecisionSurfaceResponse> {
        return this.memExecuteCode<DecisionSurfaceResponse>(`gcx()._ensemble_decision_surface()`)
            .then(data => {
                return {
                    colors: data.colors,
                    contours: new Map(Object.entries(data.contours)),
                    X: data.X,
                    y: data.y
                }
            })
    }

    requestPipelineHistory(): Promise<PipelineHistory> {
        return this.memExecuteCode<PipelineHistory>(`gcx()._get_pipeline_history()`)
            .then(data => {
                return {
                    'merged': data.merged.map(pipeline => pipeline.map(d => PipelineStep.fromJson(d))),
                    'individual': data.individual.map(pipeline => pipeline.map(d => PipelineStep.fromJson(d)))
                }
            })
    }
}

// Prefix used in python to prevent accidental name clashes
export const ID = 'xautoml'
