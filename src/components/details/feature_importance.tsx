import React from 'react';
import {FeatureImportance, requestFeatureImportance} from "../../handler";
import {LoadingIndicator} from "../loading";
import {DetailsModel} from "./model";
import {ErrorIndicator} from "../../util/error";
import {Colors, prettyPrint} from "../../util";
import {AdditionalFeatureWarning} from "../../util/warning";
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis} from "recharts";


class CustomizedAxisTick extends React.PureComponent<any> {
    render() {
        const {x, y, payload} = this.props;

        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={16} textAnchor="end" fill="#666" transform="rotate(-35)">
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

    constructor(props: FeatureImportanceProps) {
        super(props);

        this.state = {data: new Map<string, FeatureImportance>(), error: undefined}
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
        requestFeatureImportance(candidate.id, meta.data_file, meta.model_dir, component)
            .then(data => this.setState((state) => ({data: state.data.set(component, data)})))
            .catch(error => {
                console.error(`Failed to fetch FeatureImportance data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });
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

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error &&
                <>
                    <LoadingIndicator loading={bars.length === 0}/>
                    {bars.length > 0 &&
                    <>
                        {data.get(component).additional_features && <AdditionalFeatureWarning/>}
                        <div style={{height: this.props.height}}>
                            <ResponsiveContainer>
                                <BarChart data={bars} margin={{top: 0, right: 0, left: 0, bottom: maxLabelLength}}>
                                    <CartesianGrid strokeDasharray="3 3"/>
                                    <XAxis dataKey="feature" type={"category"} tick={<CustomizedAxisTick/>}/>
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
