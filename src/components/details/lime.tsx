import React from "react";
import {Label, LimeResult} from "../../dao";
import {Colors, JupyterContext} from "../../util";
import {LoadingIndicator} from "../../util/loading";
import {DetailsModel} from "./model";
import {ErrorIndicator} from "../../util/error";
import {CollapseComp} from "../../util/collapse";
import {CommonWarnings} from "../../util/warning";
import {Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis} from "recharts";
import ResizeObserver from "resize-observer-polyfill";

class CustomizedTick extends React.PureComponent<any> {
    render() {
        const {x, y, payload, additionalFeatures} = this.props;
        console.log(payload.value)
        const isAdditional = additionalFeatures.filter((a: string) => payload.value.startsWith(a)).length > 0 ||
            additionalFeatures.filter((a: string) => payload.value.includes(` ${a} `)).length > 0

        return (
            <text x={x} y={y} dy={0} textAnchor="end" fill={isAdditional ? Colors.ADDITIONAL_FEATURE : Colors.SELECTED_FEATURE}>
                {payload.value.toLocaleString().replace(/ /g, '\u00A0')}
            </text>
        );
    }
}


interface LimeProps {
    model: DetailsModel
}

interface LimeState {
    selectedLabel: Label
    loading: boolean
    data: LimeResult
    error: Error

    x1: number
    x2: number
}

export class LimeComponent extends React.Component<LimeProps, LimeState> {

    static HELP = 'LIME, the acronym for local interpretable model-agnostic explanations, is a technique that ' +
        'approximates any black box machine learning model with a local, interpretable model to explain each ' +
        'individual prediction. The algorithm perturbs the original data points, feed them into the black box model, ' +
        'and then observe the corresponding outputs. The method then weighs those new data points as a function of ' +
        'their proximity to the original point. Ultimately, it fits a linear regression on the dataset with ' +
        'variations using those sample weights.'

    private resizeObserver: ResizeObserver
    private readonly container = React.createRef<HTMLDivElement>()

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: LimeProps) {
        super(props);
        this.state = {
            selectedLabel: undefined,
            loading: false,
            data: undefined,
            error: undefined,
            x1: undefined,
            x2: undefined
        }

        this.onLabelClick = this.onLabelClick.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<LimeProps>, prevState: Readonly<LimeState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component ||
            prevProps.model.selectedSample !== this.props.model.selectedSample)
            this.queryLime(this.props.model.selectedSample)

        if (this.container.current && this.resizeObserver === undefined) {
            this.resizeObserver = new ResizeObserver(() => {
                this.container.current.querySelectorAll<SVGLineElement>('.recharts-cartesian-axis-line')
                    .forEach(e => {
                        const x1 = e.x1.animVal.value
                        const x2 = e.x2.animVal.value
                        if (x1 !== x2)
                            this.setState({x1: x1, x2: x2})
                    })
            })
            this.resizeObserver.observe(this.container.current)
        }
    }

    componentWillUnmount() {
        this.resizeObserver?.disconnect()
    }

    private queryLime(idx: number) {
        const {candidate, component} = this.props.model
        if (component === undefined || idx === undefined)
            return

        const promise = this.context.requestLimeApproximation(candidate.id, idx, component)
        this.setState({loading: true, data: undefined, selectedLabel: undefined, error: undefined})

        promise
            .then(data => this.setState({loading: false, data: data, selectedLabel: data.label}))
            .catch(error => {
                console.error(`Failed to fetch LimeResult data.\n${error.name}: ${error.message}`)
                this.setState({error: error, loading: undefined})
            });
    }

    private onLabelClick(point: any) {
        this.setState({selectedLabel: point.label})
    }

    render() {
        const {selectedSample} = this.props.model
        const {selectedLabel, data, loading, error} = this.state

        const probs: any[] = []
        data?.prob.forEach((p, label) => probs.push({label: label, y: p}))

        let maxLabelLength = 0
        const expl: any[] = data?.expl.get(selectedLabel.toString())
            ?.map(([label, score]) => {
                maxLabelLength = Math.max(maxLabelLength, label.length * 5)
                return {x: score, label: label}
            })
            .reverse()
        const explHeight = data?.expl.get(selectedLabel.toString())?.length * 30

        return (
            <div className={'lime'} style={{height: '100%'}}>
                <h4>Local Approximation</h4>
                <ErrorIndicator error={error}/>
                {!error && <>
                    <LoadingIndicator loading={loading}/>

                    {(!loading && !selectedSample) &&
                        <p>Select a data set sample to calculate a local model approximation (LIME).</p>
                    }

                    {data?.categorical_input && <ErrorIndicator error={{
                        name: "Calculation Failed",
                        message: 'Calculation of LIME failed, probably due to categorical input. If the selected data frame ' +
                            'contains any categorical features, please select a later stage in the pipeline after imputation ' +
                            'being applied. See the <a class="hyperlink" ' +
                            'href="https://marcotcr.github.io/lime/tutorials/Tutorial%20-%20continuous%20and%20categorical%20features.html">LIME ' +
                            'documentation</a> for more information.'
                    }}/>
                    }

                    {!data?.categorical_input && data?.expl.size === 0 && <p>
                        LIME explanations are not available for the actual predictions.</p>
                    }

                    {data?.expl.size > 0 && <div style={{minWidth: "350px"}}>
                        <CommonWarnings additionalFeatures={data.additional_features.length > 0}/>
                        <CollapseComp showInitial={true}>
                            <h5>Predicted Class Probabilities</h5>
                            <>
                                <div style={{height: 400}}>
                                    <ResponsiveContainer>
                                        <BarChart data={probs}>
                                            <CartesianGrid strokeDasharray="3 3"/>
                                            <XAxis dataKey="label" type={"category"}/>
                                            <YAxis/>
                                            <Bar dataKey="y" fill={Colors.DEFAULT} onClick={this.onLabelClick}>
                                                {probs.map((d, index) => (
                                                    <Cell key={`cell-${index}`}
                                                          fill={selectedLabel === d.label ? Colors.HIGHLIGHT : Colors.DEFAULT}/>
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <p>Correct Class: {data.label}</p>
                            </>
                        </CollapseComp>

                        <CollapseComp showInitial={true}>
                            <h5>Explanations for Class {selectedLabel}</h5>
                            <div style={{height: explHeight}} ref={this.container}>
                                <ResponsiveContainer>
                                    <BarChart data={expl} layout={'vertical'}
                                              margin={{left: maxLabelLength, top: 20, right: 0, bottom: 0}}>
                                        <CartesianGrid strokeDasharray="3 3"/>
                                        <XAxis type={'number'}/>
                                        <YAxis dataKey="label" type={"category"} interval={0}
                                               tick={<CustomizedTick additionalFeatures={data.additional_features}/>}/>
                                        <Bar dataKey="x" fill={Colors.DEFAULT}/>
                                        {this.state.x1 &&
                                            <text x={this.state.x1} y={15}>{`Not ${selectedLabel}`}</text>}
                                        {this.state.x2 &&
                                            <text x={this.state.x2} textAnchor="end"
                                                  y={15}>{selectedLabel.toString()}</text>}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CollapseComp>
                    </div>
                    }
                </>}
            </div>
        )
    }
}
