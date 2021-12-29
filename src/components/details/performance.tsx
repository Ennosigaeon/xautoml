import React from "react";
import {DetailsModel} from "./model";
import {KeyValue} from "../../util/KeyValue";
import {JupyterContext, prettyPrint} from "../../util";
import {ConfusionMatrix} from "./confusion_matrix";
import {RocCurve} from "../general/roc_curve";
import {Candidate, CandidateId, MetaInformation} from "../../model";
import {PerformanceData} from "../../dao";
import {ErrorIndicator} from "../../util/error";
import {LoadingIndicator} from "../../util/loading";
import {Table, TableBody, TableCell, TableRow} from "@material-ui/core";


interface PerformanceComponentProps {
    model: DetailsModel
    meta: MetaInformation
    candidateMap: Map<CandidateId, Candidate>
}

interface PerformanceComponentState {
    data: PerformanceData
    loading: boolean
    error: Error
}

export class PerformanceComponent extends React.Component<PerformanceComponentProps, PerformanceComponentState> {

    static HELP = 'Displays basic performance details like train and test performance. Additionally, a confusion ' +
        'matrix for all classes is computed. Finally, the ROC curve for this candidate is displayed.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: PerformanceComponentProps) {
        super(props);
        this.state = {data: undefined, loading: false, error: undefined}
    }

    componentDidMount() {
        this.queryPerformanceData()
    }

    private queryPerformanceData() {
        if (this.state.loading)
            return

        const {model} = this.props
        this.setState({loading: true})
        this.context.requestPerformanceData(model.candidate.id)
            .then(data => this.setState({data: data, loading: false}))
            .catch(error => {
                console.error(`Failed to fetch confusion matrix: \n${error.name}: ${error.message}`);
                this.setState({error: error, loading: false})
            });
    }

    render() {
        const {model, meta, candidateMap} = this.props
        const {data, loading, error} = this.state

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error && <>
                    <LoadingIndicator loading={loading}/>
                    {data &&
                        <div style={{display: "flex"}}>
                            <div style={{flexGrow: 1, flexShrink: 1, flexBasis: "19%"}}>
                                <h5>Metrics</h5>
                                <KeyValue key_={`Training ${meta.metric}`}
                                          value={model.candidate.loss}/>
                                <KeyValue key_={`Validation ${meta.metric}`} value={data.val_score}/>
                                <KeyValue key_={`Validation Accuracy`} value={data.accuracy}/>
                                <KeyValue key_={'Training Duration'}
                                          value={`${prettyPrint(model.candidate.runtime.training_time)} sec`}/>
                                <KeyValue key_={'Prediction Duration'}
                                          value={`${prettyPrint(data.duration)} sec`}/>

                                <hr/>

                                <h5>Information</h5>
                                <KeyValue key_={'Status'} value={model.candidate.status}/>
                                <KeyValue key_={'Budget'} value={model.candidate.budget}/>
                            </div>

                            <div style={{flexGrow: 1, margin: "0 10px", flexBasis: "27%"}}>
                                <h5>Class Report</h5>
                                <Table className={'jp-RenderedHTMLCommon'}>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell component="th"/>
                                            <TableCell component="th" scope="row">Precision</TableCell>
                                            <TableCell component="th" scope="row">Recall</TableCell>
                                            <TableCell component="th" scope="row">Support</TableCell>
                                        </TableRow>

                                        {Array.from(data.report.keys()).map(clazz =>
                                            <TableRow key={clazz}>
                                                <TableCell component="th" scope="col">{clazz}</TableCell>
                                                <TableCell align="right">{prettyPrint(data.report.get(clazz).precision)}</TableCell>
                                                <TableCell align="right">{prettyPrint(data.report.get(clazz).recall)}</TableCell>
                                                <TableCell align="right">{prettyPrint(data.report.get(clazz).support)}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <div style={{flexGrow: 1, margin: "0 10px", flexBasis: "27%"}}>
                                <h5>Confusion Matrix</h5>
                                <ConfusionMatrix cm={data.cm}/>
                            </div>

                            <div style={{flexGrow: 1, flexBasis: "27%"}}>
                                <h5>Receiver Operating Characteristic (ROC) Curve</h5>
                                <RocCurve selectedCandidates={new Set([model.candidate.id])}
                                          candidateMap={candidateMap}
                                          height={200}/>
                            </div>
                        </div>
                    }
                </>
                }
            </>
        )
    }
}
