import React from "react";
import {OutputDescriptionData} from "../../dao";
import {LoadingIndicator} from "../../util/loading";
import {DetailsModel} from "./model";
import {TwoColumnLayout} from "../../util/layout";
import {JupyterButton} from "../../util/jupyter-button";
import {JupyterContext} from "../../util";
import {ErrorIndicator} from "../../util/error";
import {ID} from "../../jupyter";
import {DatasetTable} from "./dataset_table";


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

    static HELP = 'Displays a preview of the data set generated by the selected pipeline step. It is possible to ' +
        'transfer the previewed data set into a new Jupyter cell to continue with further analysis. By selecting a ' +
        'single record a LIME analysis can be calculated.'


    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: RawDatasetProps) {
        super(props);
        this.state = {
            loadingDf: false,
            outputs: new Map<string, string>(),
            error: undefined
        }

        this.handleLoadDataframe = this.handleLoadDataframe.bind(this)
    }

    componentDidMount() {
        this.queryOutputs()
    }

    componentDidUpdate(prevProps: Readonly<RawDatasetProps>, prevState: Readonly<RawDatasetState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component)
            this.queryOutputs()

    }

    private queryOutputs() {
        if (this.state.loadingDf) {
            // Loading already in progress
            return
        }
        if (this.state.outputs.size == 0) {
            const {candidate} = this.props.model

            // Outputs not cached yet
            this.setState({loadingDf: true})
            this.context.requestOutputComplete(candidate.id)
                .then(data => this.setState({outputs: data, loadingDf: false}))
                .catch(error => {
                    console.error(`Failed to fetch output data: \n${error.name}: ${error.message}`);
                    this.setState({error: error})
                });
        }
    }

    private handleLoadDataframe() {
        const {candidate, component} = this.props.model

        this.context.createCell(`
from xautoml.util import io_utils

${ID}_X, ${ID}_y, ${ID}_pipeline = XAutoMLManager.get_active().get_sub_pipeline('${candidate.id}', '${component}')
${ID}_X
        `.trim())
    }

    render() {
        const {component, algorithm, selectedSample} = this.props.model
        const {loadingDf, outputs, error} = this.state

        return (
            <>
                <TwoColumnLayout>
                    <h4>Output of <i>{algorithm} ({component})</i></h4>
                    {(!loadingDf && outputs.has(component)) &&
                        <JupyterButton style={{marginTop: 0, float: 'right'}} onClick={this.handleLoadDataframe}/>
                    }
                </TwoColumnLayout>
                <ErrorIndicator error={error}/>
                {!error &&
                    <>
                        <LoadingIndicator loading={loadingDf}/>
                        {!loadingDf &&
                            <>
                                {outputs.has(component) ?
                                    <DatasetTable data={outputs.get(component)}
                                                  selectedSample={selectedSample}
                                                  onSampleClick={this.props.onSampleClick}/> :
                                    <div>Missing</div>}
                            </>}
                    </>}
            </>
        )
    }

}
