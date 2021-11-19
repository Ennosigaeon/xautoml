import React from "react";
import {DetailsModel} from "./model";
import {KeyValue} from "../../util/KeyValue";
import {fixedPrec} from "../../util";
import {ConfusionMatrix} from "../confusion_matrix";
import {RocCurve} from "../roc_curve";


interface PerformanceComponentProps {
    model: DetailsModel
}

export class PerformanceComponent extends React.Component<PerformanceComponentProps, {}> {

    static HELP = 'Displays basic performance details like train and test performance. Additionally, a confusion ' +
        'matrix for all classes is computed. Finally, the ROC curve for this candidate is displayed.'

    render() {
        const {model} = this.props

        return (
            <div style={{display: "flex"}}>
                <div style={{flexGrow: 1, flexShrink: 1, flexBasis: "20%"}}>
                    <h5>Metrics</h5>
                    <KeyValue key_={`Training ${model.meta.metric}`}
                              value={model.candidate.loss}/>
                    {/* TODO */}
                    <KeyValue key_={`Validation ${model.meta.metric}`} value={0}/>
                    <KeyValue key_={'Training Duration'}
                              value={`${fixedPrec(model.candidate.runtime.training_time)} sec`}/>
                    {/* TODO */}
                    <KeyValue key_={'Prediction Duration'} value={'0 sec'}/>
                </div>

                <div style={{flexGrow: 1, margin: "0 10px", flexBasis: "40%"}}>
                    <h5>Confusion Matrix</h5>
                    <ConfusionMatrix model={model}/>
                </div>

                <div style={{flexGrow: 1, flexBasis: "40%"}}>
                    <h5>Receiver Operating Characteristic (ROC) Curve</h5>
                    <RocCurve selectedCandidates={new Set([model.candidate.id])} meta={model.meta} height={200}/>
                </div>
            </div>
        )
    }
}
