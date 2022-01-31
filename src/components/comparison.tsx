import React from "react";
import {ComparisonType, DetailsModel} from "./details/model";
import {MetaInformation} from "../model";
import {FeatureImportanceComponent} from "./details/feature_importance";
import {LocalSurrogateComponent} from "./details/local_surrogate";
import {Label} from "../dao";
import {GlobalSurrogateComponent} from "./details/global_surrogate";
import {HPImportanceComp} from "./details/hp_importance";
import {CollapseComp} from "../util/collapse";
import {ArrowForwardIos} from "@material-ui/icons";
import {IconButton} from "@material-ui/core";
import {HyperparameterTable} from "./details/pipeline_hyperparameters";
import {PerformanceDetailsComponent} from "./details/performance_details";


interface ComparisonProps {
    models: DetailsModel[]
    meta: MetaInformation
    type: ComparisonType

    onClose: () => void
}

interface ComparisonState {
    limeLabel: Label
    dtSelectedIndex: number
    featureImportanceSelectedFeature: string
    hpImportanceSelectedHp1: string
    hpImportanceSelectedHp2: string
}

export class Comparison extends React.Component<ComparisonProps, ComparisonState> {

    constructor(props: ComparisonProps) {
        super(props);
        this.state = {
            limeLabel: undefined,
            dtSelectedIndex: 1,
            featureImportanceSelectedFeature: undefined,
            hpImportanceSelectedHp1: undefined,
            hpImportanceSelectedHp2: undefined
        }

        this.onLimeLabelChange = this.onLimeLabelChange.bind(this)
        this.onDTIndexChange = this.onDTIndexChange.bind(this)
        this.onFeatureImportanceFeatureChange = this.onFeatureImportanceFeatureChange.bind(this)
        this.onHpImportanceChange = this.onHpImportanceChange.bind(this)
    }

    private onLimeLabelChange(label: Label) {
        this.setState({limeLabel: label})
    }

    private onDTIndexChange(idx: number) {
        this.setState({dtSelectedIndex: idx})
    }

    private onFeatureImportanceFeatureChange(feature: string) {
        this.setState({featureImportanceSelectedFeature: feature})
    }

    private onHpImportanceChange(hp1: string, hp2: string) {
        this.setState({hpImportanceSelectedHp1: hp1, hpImportanceSelectedHp2: hp2})
    }

    render() {
        const {models, meta, type} = this.props
        const n = 3

        return (
            <div className={'comparison-container container'}>
                <div style={{display: "flex", marginBottom: '10px'}}>
                    <IconButton style={{flexShrink: 1, maxHeight: '18px'}} size='small' onClick={this.props.onClose}>
                        <ArrowForwardIos/>
                    </IconButton>
                    <h3 style={{margin: 0, lineHeight: '24px', textAlign: 'center'}}>Comparisons</h3>
                </div>

                {models.length > n && <p>Only up to {n} models can be compared at once</p>}
                {models.slice(0, n).map(model =>
                    <CollapseComp showInitial={true} key={model.candidate.id}>
                        <h4>{model.candidate.id}</h4>
                        {type === 'performance' &&
                            <PerformanceDetailsComponent model={model} meta={meta}/>}
                        {type === 'lime' &&
                            <LocalSurrogateComponent model={model} selectedLabel={this.state.limeLabel}
                                                     orientation={'horizontal'}
                                                     onLabelChange={this.onLimeLabelChange}/>}
                        {type === 'global_surrogate' &&
                            <GlobalSurrogateComponent model={model} onDTIndexChange={this.onDTIndexChange}
                                                      dtIndex={this.state.dtSelectedIndex}/>}
                        {type === 'feature_importance' &&
                            <FeatureImportanceComponent model={model}
                                                        onFeatureSelection={this.onFeatureImportanceFeatureChange}
                                                        selectedFeature={this.state.featureImportanceSelectedFeature}/>}
                        {type === 'hp_importance' &&
                            <HPImportanceComp model={model} metric={meta.metric}
                                              onHpChange={this.onHpImportanceChange}
                                              selectedHp1={this.state.hpImportanceSelectedHp1}
                                              selectedHp2={this.state.hpImportanceSelectedHp2}/>}

                        {type === 'configuration' &&
                            <HyperparameterTable config={model.candidate.config} twoColumns={true}/>}
                    </CollapseComp>
                )}
            </div>
        )
    }


}
