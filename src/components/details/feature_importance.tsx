import React from 'react';
import {FeatureImportance, requestFeatureImportance} from "../../handler";
import {LoadingIndicator} from "../loading";
import {DetailsModel} from "./model";
import {ErrorIndicator} from "../../util/error";
import {Colors, JupyterContext, prettyPrint} from "../../util";
import {AdditionalFeatureWarning} from "../../util/warning";
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis} from "recharts";
import {JupyterButton} from "../../util/jupyter-button";
import {ID} from "../../jupyter";


class CustomizedAxisTick extends React.PureComponent<any> {
    render() {
        const {x, y, payload, additionalFeatures} = this.props;
        const isAdditional = additionalFeatures.includes(payload.value)

        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={16} textAnchor="end" fill={isAdditional ? '#aaa' : '#444'}
                      transform="rotate(-35)">
                    {payload.value}
                </text>
            </g>
        );
    }
}


class CustomTooltip extends React.PureComponent<TooltipProps<any, any>> {
    render() {
        const {active, payload} = this.props

        if (active && payload && payload.length) {
            return (
                <div className="recharts-default-tooltip" style={{
                    margin: '0px',
                    padding: '10px',
                    backgroundColor: 'rgb(255, 255, 255)',
                    border: '1px solid rgb(204, 204, 204)',
                    whiteSpace: 'nowrap'
                }}>
                    <p className="label">{prettyPrint(payload[0].value, 3)}</p>
                </div>
            )
        }
        return null
    }
}


interface FeatureImportanceProps {
    model: DetailsModel
    height: number
}

interface FeatureImportanceState {
    data: Map<string, FeatureImportance>
    error: Error
}

export class FeatureImportanceComponent extends React.Component<FeatureImportanceProps, FeatureImportanceState> {

    static HELP = 'The permutation feature importance is defined to be the decrease in a model score when a single ' +
        'feature value is randomly shuffled. This procedure breaks the relationship between the feature and the ' +
        'target, thus the drop in the model score is indicative of how much the model depends on the feature.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: FeatureImportanceProps) {
        super(props);
        this.state = {data: new Map<string, FeatureImportance>(), error: undefined}

        this.exportDataFrame = this.exportDataFrame.bind(this)
    }

    componentDidMount() {
        this.queryFeatureImportance()
    }

    componentDidUpdate(prevProps: Readonly<FeatureImportanceProps>, prevState: Readonly<FeatureImportanceState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component)
            this.queryFeatureImportance()
    }

    private queryFeatureImportance() {
        const {candidate, meta, component} = this.props.model
        if (!component || this.state.data.has(component))
            return

        this.setState({error: undefined})
        requestFeatureImportance(candidate.model_file, meta.data_file, component)
            .then(data => this.setState((state) => ({data: state.data.set(component, data)})))
            .catch(error => {
                console.error(`Failed to fetch FeatureImportance data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });
    }

    private exportDataFrame() {
        function pythonBool(bool: boolean) {
            const string = bool.toString()
            return string.charAt(0).toUpperCase() + string.slice(1);
        }

        const {component} = this.props.model
        const {data} = this.state
        const additionalFeatures = data.get(component).additional_features

        const entries: string[] = []
        const index: string[] = []
        const columns: string[] = ['\'importance\'', '\'additional_feature\'']
        data.get(component).data.forEach((value, key) => {
            entries.push(`[${value}, ${pythonBool(additionalFeatures.includes(key))}]`)
            index.push(`'${key}'`)
        })

        this.context.createCell(`
import pandas as pd

${ID}_feature_importance = pd.DataFrame([${entries}],
  index=[${index}],
  columns=[${columns}])
${ID}_feature_importance
        `.trim())
    }

    render() {
        const {data, error} = this.state
        const {component} = this.props.model

        const bars: any[] = []
        let maxLabelLength = 35
        data.get(component)?.data.forEach((value, key) => {
            bars.push({feature: key, y: value})
            maxLabelLength = Math.max(maxLabelLength, key.length * 4)
        })
        const additionalFeatures = data.has(component) ? data.get(component).additional_features : []

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error &&
                <>
                    <LoadingIndicator loading={bars.length === 0}/>
                    {bars.length > 0 &&
                    <>
                        <div style={{display: "flex", flexDirection: "row-reverse"}}>
                            <JupyterButton onClickHandler={this.exportDataFrame}    />
                        </div>

                        {additionalFeatures.length > 0 && <AdditionalFeatureWarning/>}
                        <div style={{height: this.props.height}}>
                            <ResponsiveContainer>
                                <BarChart data={bars} margin={{bottom: maxLabelLength}}>
                                    <CartesianGrid strokeDasharray="3 3"/>
                                    <XAxis dataKey="feature" type={"category"} interval={0}
                                           tick={<CustomizedAxisTick additionalFeatures={additionalFeatures}/>}/>
                                    <YAxis/>
                                    <Tooltip content={<CustomTooltip/>}/>
                                    <Bar dataKey="y" fill={Colors.DEFAULT}/>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                    }
                </>
                }
            </>
        );
    }
}
