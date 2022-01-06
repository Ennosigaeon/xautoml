import React from 'react';
import {FeatureImportance} from "../../dao";
import {LoadingIndicator} from "../../util/loading";
import {DetailsModel} from "./model";
import {ErrorIndicator} from "../../util/error";
import {Colors, JupyterContext, prettyPrint} from "../../util";
import {CommonWarnings} from "../../util/warning";
import {Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import {JupyterButton} from "../../util/jupyter-button";
import {ID} from "../../jupyter";
import {MinimalisticTooltip} from "../../util/recharts";


class CustomizedAxisTick extends React.PureComponent<any> {
    render() {
        const {x, y, payload, additionalFeatures} = this.props;
        const isAdditional = additionalFeatures.includes(payload.value)

        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={16} textAnchor="end"
                      fill={isAdditional ? Colors.ADDITIONAL_FEATURE : Colors.SELECTED_FEATURE}
                      transform="rotate(-35)">
                    {payload.value}
                </text>
            </g>
        );
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

    static readonly HELP = 'Visualizes the importance of each features. The feature importance is calculated by ' +
        'shuffling a single feature randomly. The permutation feature importance is defined to be the decrease in a ' +
        'model score after shuffling. This procedure breaks the relationship between the feature and the target, ' +
        'thus the drop in the model score is indicative of how much the model depends on the feature.'

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
        const {candidate, component} = this.props.model
        if (!component || this.state.data.has(component))
            return

        this.setState({error: undefined})
        this.context.requestFeatureImportance(candidate.id, component)
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

        // noinspection JSMismatchedCollectionQueryUpdate
        const entries: string[] = []
        // noinspection JSMismatchedCollectionQueryUpdate
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
                                    <JupyterButton onClick={this.exportDataFrame}/>
                                </div>

                                <CommonWarnings additionalFeatures={additionalFeatures.length > 0}/>
                                <div style={{height: this.props.height}}>
                                    <ResponsiveContainer>
                                        <BarChart data={bars} margin={{bottom: maxLabelLength, left: 30}}>
                                            <CartesianGrid strokeDasharray="3 3"/>
                                            <XAxis dataKey="feature" type={"category"} interval={0}
                                                   tick={<CustomizedAxisTick
                                                       additionalFeatures={additionalFeatures}/>}/>
                                            <YAxis label={{value: `Performance Decrease`, angle: -90, dx: -40}}
                                                   domain={['0', 'dataMax']}
                                                   tickFormatter={y => prettyPrint(y, 4)}/>
                                            <ReferenceLine y="0" stroke="#666666"/>
                                            <Tooltip content={<MinimalisticTooltip/>}/>
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
