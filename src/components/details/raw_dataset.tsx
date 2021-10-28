import React from "react";
import {OutputDescriptionData, requestOutputComplete} from "../../handler";
import {DataSetDetailsComponent} from "../dataset_details";
import {LoadingIndicator} from "../loading";
import {DetailsModel} from "./model";
import {TwoColumnLayout} from "../../util/layout";
import {JupyterButton} from "../../util/jupyter-button";
import {JupyterContext} from "../../util";
import {ErrorIndicator} from "../../util/error";


interface RawDatasetProps {
    model: DetailsModel
    onSampleClick: (idx: number) => void
}

interface RawDatasetState {
    loadingDf: boolean
    outputs: OutputDescriptionData
    error: Error
}

export class RawDataset extends React.Component<RawDatasetProps, RawDatasetState> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    private readonly dfTableRef = React.createRef<HTMLDivElement>()

    constructor(props: RawDatasetProps) {
        super(props);
        this.state = {loadingDf: false, outputs: new Map<string, string>(), error: undefined}

        this.handleSampleClick = this.handleSampleClick.bind(this)
        this.handleLoadDataframe = this.handleLoadDataframe.bind(this)
    }

    componentDidMount() {
        this.queryOutputs()
    }

    componentDidUpdate(prevProps: Readonly<RawDatasetProps>, prevState: Readonly<RawDatasetState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component) {
            this.queryOutputs()
        }

        if (!!this.dfTableRef.current) {
            [...this.dfTableRef.current.getElementsByTagName('tr')].forEach(tr => {
                tr.onclick = this.handleSampleClick

                // Highlight previously selected row
                if (this.props.model.selectedSample !== undefined &&
                    this.props.model.selectedSample === Number.parseInt(tr.firstElementChild.textContent)) {
                    tr.classList.add(DataSetDetailsComponent.selectedClassName)
                }
            })
        }

    }

    private queryOutputs() {
        if (this.state.loadingDf) {
            // Loading already in progress
            return
        }
        if (this.state.outputs.size == 0) {
            const {candidate, meta} = this.props.model

            // Outputs not cached yet
            this.setState({loadingDf: true})
            requestOutputComplete(candidate.id, meta.data_file, meta.model_dir)
                .then(data => this.setState({outputs: data, loadingDf: false}))
                .catch(error => {
                    console.error(`Failed to fetch output data: \n${error.name}: ${error.message}`);
                    this.setState({error: error})
                });
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

        this.props.onSampleClick(idx)
    }

    private handleLoadDataframe() {
        const {meta, candidate, component} = this.props.model
        this.context.createCell(`
from xautoml.util import io_utils

xautoml_X, _, xautoml_feature_labels = io_utils.load_input_data('${meta.data_file}', framework='${meta.framework}')
xautoml_pipeline = io_utils.load_pipeline('${meta.model_dir}', '${candidate.id}', framework='${meta.framework}')

xautoml_df = io_utils.load_output_dataframe(xautoml_pipeline, '${component}', xautoml_X, xautoml_feature_labels)
xautoml_df
        `.trim())
    }

    render() {
        const {component, algorithm} = this.props.model
        const {loadingDf, outputs, error} = this.state

        const outputRender = outputs.has(component) ?
            <div style={{overflowX: 'auto'}}>
                <div className={'jp-RenderedHTMLCommon'} ref={this.dfTableRef}
                     dangerouslySetInnerHTML={{__html: outputs.get(component)}}/>
            </div> :
            <div>Missing</div>

        return (
            <>
                <TwoColumnLayout>
                    <h4>Output of <i>{algorithm} ({component})</i></h4>
                    {(!loadingDf && outputs.has(component)) &&
                    <JupyterButton style={{marginTop: '14px', float: 'right'}}
                                   onClickHandler={this.handleLoadDataframe}/>
                    }
                </TwoColumnLayout>
                <ErrorIndicator error={error}/>
                {!error &&
                <>
                    <LoadingIndicator loading={loadingDf}/>
                    {!loadingDf && outputRender}
                </>}

            </>
        )
    }

}
