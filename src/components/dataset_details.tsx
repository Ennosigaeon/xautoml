import React from "react";
import {Candidate, MetaInformation} from "../model";
import {
    CancelablePromise,
    CanceledPromiseError,
    LimeResult,
    OutputDescriptionData,
    requestLimeApproximation,
    requestOutputComplete
} from "../handler";
import {JupyterContext} from "../util";
import {LoadingIndicator} from "./loading";
import {JupyterButton} from "../util/jupyter-button";
import {TwoColumnLayout} from "../util/layout";
import {LimeComponent} from "./lime";

interface DataSetDetailsProps {
    candidate: Candidate
    component: [string, string]
    meta: MetaInformation
}

interface DataSetDetailsState {
    loadingDf: boolean
    outputs: OutputDescriptionData
    pendingLimeRequest: CancelablePromise<LimeResult>
    lime: LimeResult
    selectedSample: number
}


export class DataSetDetailsComponent extends React.Component<DataSetDetailsProps, DataSetDetailsState> {

    static selectedClassName = 'selected-config'
    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;
    dfTableRef = React.createRef<HTMLDivElement>()

    constructor(props: DataSetDetailsProps) {
        super(props);
        this.state = {
            loadingDf: false,
            outputs: new Map<string, string>(),
            pendingLimeRequest: undefined,
            lime: undefined,
            selectedSample: undefined
        }

        this.handleLoadDataframe = this.handleLoadDataframe.bind(this)
        this.handleSampleClick = this.handleSampleClick.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<DataSetDetailsProps>, prevState: Readonly<DataSetDetailsState>, snapshot?: any) {
        if (prevProps.component !== this.props.component) {
            if (this.state.loadingDf) {
                // Loading already in progress
                return
            }
            if (this.state.outputs.size == 0) {
                // Outputs not cached yet already cached
                this.setState({loadingDf: true})
                requestOutputComplete(this.props.candidate.id, this.props.meta.data_file, this.props.meta.model_dir)
                    .then(data => this.setState({outputs: data, loadingDf: false}))
                    .catch(reason => {
                        // TODO handle error
                        console.error(`Failed to fetch output data.\n${reason}`);
                        this.setState({loadingDf: false})
                    });
            }
        }

        if (!!this.dfTableRef.current) {
            [...this.dfTableRef.current.getElementsByTagName('tr')].forEach(tr => {
                tr.onclick = this.handleSampleClick

                // Highlight previously selected row
                if (this.state.selectedSample !== undefined && this.state.selectedSample === Number.parseInt(tr.firstElementChild.textContent)) {
                    tr.classList.add(DataSetDetailsComponent.selectedClassName)
                }
            })
        }
    }

    private handleSampleClick(event: MouseEvent) {
        const row = event.target instanceof HTMLTableRowElement ? event.target : (event.target as HTMLTableCellElement).parentElement
        const idx = Number.parseInt(row.firstElementChild.textContent)

        if (isNaN(idx))
            // Abort processing as no valid row selected
            return

        // Highlight selected row
        row.parentElement.querySelectorAll(`.${DataSetDetailsComponent.selectedClassName}`)
            .forEach(el => el.classList.remove(DataSetDetailsComponent.selectedClassName))
        row.classList.add(DataSetDetailsComponent.selectedClassName)

        if (this.state.pendingLimeRequest !== undefined) {
            // Request for data is currently still pending. Cancel previous request.
            this.state.pendingLimeRequest.cancel()
        }

        const promise = requestLimeApproximation(this.props.candidate.id, idx, this.props.meta.data_file, this.props.meta.model_dir)
        this.setState({pendingLimeRequest: promise, selectedSample: idx})

        promise
            .then(data => this.setState({lime: data, pendingLimeRequest: undefined}))
            .catch(reason => {
                if (!(reason instanceof CanceledPromiseError)) {
                    // TODO handle error
                    console.error(`Failed to fetch LimeResult data.\n${reason}`)
                    this.setState({pendingLimeRequest: undefined})
                } else {
                    console.log('Cancelled promise due to user request')
                }
            });
    }

    private handleLoadDataframe() {
        this.context.createCell(`
from xautoml.util import io_utils

xautoml_X, _, xautoml_feature_labels = io_utils.load_input_data('${this.props.meta.data_file}', framework='${this.props.meta.framework}')
xautoml_pipeline = io_utils.load_pipeline('${this.props.meta.model_dir}', '${this.props.candidate.id}', framework='${this.props.meta.framework}')

xautoml_df = io_utils.load_output_dataframe(xautoml_pipeline, '${this.props.component}', xautoml_X, xautoml_feature_labels)
xautoml_df
        `.trim())
    }

    render() {
        const {component} = this.props
        const {loadingDf, outputs, pendingLimeRequest, lime} = this.state

        const outputRender = outputs.has(component[0]) ?
            <div className={'jp-RenderedHTMLCommon'} ref={this.dfTableRef}
                 dangerouslySetInnerHTML={{__html: outputs.get(component[0])}}/> :
            <div>Missing</div>

        const limeRender = !!lime ? <LimeComponent result={lime}/> :
            <p>Select a sample on the left side to calculate a local model approximation (LIME).</p>

        return (
            <>
                <TwoColumnLayout>
                    <>
                        <TwoColumnLayout>
                            <h4>Output of <i>{component[1]} ({component[0]})</i></h4>
                            {(!loadingDf && outputs.has(component[0])) &&
                            <JupyterButton style={{marginTop: '14px', float: 'right'}} onClickHandler={this.handleLoadDataframe}/>}
                        </TwoColumnLayout>

                        <div style={{overflowX: 'auto'}}>
                            <LoadingIndicator loading={loadingDf}/>
                            {!loadingDf && outputRender}
                        </div>

                    </>
                    <>
                        <h4>Local Approximation</h4>
                        <LoadingIndicator loading={!!pendingLimeRequest}/>
                        {!pendingLimeRequest && limeRender}
                    </>
                </TwoColumnLayout>
            </>
        )
    }
}
