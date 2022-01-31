import React from "react";
import {Label, LimeResult} from "../../dao";
import {Colors, JupyterContext} from "../../util";
import {LoadingIndicator} from "../../util/loading";
import {ComparisonType, DetailsModel} from "./model";
import {ErrorIndicator} from "../../util/error";
import {CollapseComp} from "../../util/collapse";
import {CommonWarnings} from "../../util/warning";
import {Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";
import ResizeObserver from "resize-observer-polyfill";
import {MinimalisticTooltip} from "../../util/recharts";
import {CompareArrows} from "@material-ui/icons";
import {IconButton} from "@material-ui/core";

class CustomizedTick extends React.PureComponent<any> {
    render() {
        const {x, y, payload, additionalFeatures} = this.props;
        const isAdditional = additionalFeatures.filter((a: string) => payload.value.startsWith(a)).length > 0 ||
            additionalFeatures.filter((a: string) => payload.value.includes(` ${a} `)).length > 0

        return (
            <text x={x} y={y} dy={0} textAnchor="end"
                  fill={isAdditional ? Colors.ADDITIONAL_FEATURE : Colors.SELECTED_FEATURE}>
                {payload.value.toLocaleString().replace(/ /g, '\u00A0')}
                <title>{payload.value.toLocaleString()}</title>
            </text>
        );
    }
}


interface LocalSurrogateProps {
    model: DetailsModel
    orientation: 'vertical' | 'horizontal'

    selectedLabel?: Label
    onLabelChange?: (label: Label) => void
    onComparisonRequest?: (type: ComparisonType) => void
}

interface LocalSurrogateState {
    selectedLabel: Label
    loading: boolean
    data: LimeResult
    error: Error

    x1: number
    x2: number
}

export class LocalSurrogateComponent extends React.Component<LocalSurrogateProps, LocalSurrogateState> {

    private resizeObserver: ResizeObserver
    private readonly container = React.createRef<HTMLDivElement>()

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: LocalSurrogateProps) {
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
        this.onTickClick = this.onTickClick.bind(this)
    }

    componentDidMount() {
        if (this.props.model.selectedSample !== undefined)
            this.queryLime(this.props.model.selectedSample)
    }

    componentDidUpdate(prevProps: Readonly<LocalSurrogateProps>, prevState: Readonly<LocalSurrogateState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component ||
            prevProps.model.selectedSample !== this.props.model.selectedSample)
            this.queryLime(this.props.model.selectedSample)

        if (prevProps.selectedLabel !== this.props.selectedLabel)
            this.setState({selectedLabel: this.props.selectedLabel})

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

        const promise = this.context.requestLimeSurrogate(candidate.id, idx, component)
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
        if (this.props.onLabelChange !== undefined)
            this.props.onLabelChange(point.label)
    }

    private onTickClick(e: React.MouseEvent) {
        // @ts-ignore
        this.setState({selectedLabel: e.value})
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

        maxLabelLength = Math.min(this.props.orientation === 'vertical' ? 150 : 500, maxLabelLength)
        const explHeight = data?.expl.get(selectedLabel.toString())?.length * 30

        return (
            <div className={`lime ${this.props.orientation}`}>
                {this.props.orientation === 'vertical' &&
                    <div style={{display: "flex", justifyContent: "space-between"}}>
                        <h3>Local Surrogate</h3>
                        {this.props.onComparisonRequest && selectedSample !== undefined &&
                            <IconButton style={{flexShrink: 1, maxHeight: '24px'}} size='small'
                                        title={'Compare With Selected Candidates'}
                                        onClick={() => this.props.onComparisonRequest('lime')}>
                                <CompareArrows/>
                            </IconButton>
                        }
                    </div>
                }
                <ErrorIndicator error={error}/>
                {!error && <>
                    <LoadingIndicator loading={loading}/>

                    {(!loading && selectedSample === undefined) &&
                        <>
                            <p>Select a data set sample to calculate a local model surrogate (LIME).</p>
                            <p>
                                LIME, the acronym for local interpretable model-agnostic explanations, is a technique
                                that approximates any black box machine learning model with a local, interpretable
                                model to explain each individual prediction. The algorithm perturbs the original data
                                points, feeds them into the black box model, and then observes the corresponding
                                outputs. The method then weighs those new data points as a function of their proximity
                                to the original point. Ultimately, it fits a linear regression on the dataset with
                                variations using those sample weights.
                            </p>
                        </>
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

                    {data?.expl.size > 0 && <>
                        <div className={'lime_plot'}>
                            <CommonWarnings additionalFeatures={data.additional_features.length > 0}/>
                            <CollapseComp name={'lime-classes'} showInitial={true}
                                          help={'In this plot you can see the predicted class probabilities of the model ' +
                                              'for all available classes. The probabilities range between 0 (the model is' +
                                              'certain that this is not the correct class) to 1 (the model is certain ' +
                                              'that this is the correct class). If the model is uncertain about the ' +
                                              'correct class, two or more classes have roughly the same probabilities.' +
                                              '\n\n' +
                                              'The actual correct class is given above the plot.'}>
                                <h4>Predicted Class Probabilities</h4>
                                <>
                                    <p>Correct Class: {data.label}</p>
                                    <div style={{height: 100}}>
                                        <ResponsiveContainer>
                                            <BarChart data={probs}>
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis dataKey="label" type={"category"} onClick={this.onTickClick}
                                                       className={'selectable-ticks'}/>
                                                <YAxis/>
                                                <Bar dataKey="y" fill={Colors.DEFAULT} onClick={this.onLabelClick}
                                                     className={'lime-class'}>
                                                    {probs.map((d, index) => (
                                                        <Cell key={`cell-${index}`}
                                                              fill={selectedLabel === d.label ? Colors.HIGHLIGHT : Colors.DEFAULT}/>
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            </CollapseComp>
                        </div>
                        <div className={'lime_plot'}>
                            <CollapseComp name={'lime-explanations'} showInitial={true}
                                          help={'This plots contains the most important factors influencing the ' +
                                              'prediction of the selected sample. In each row, a true statement about ' +
                                              'the selected sample is given. The according plot on the right side ' +
                                              'indicates how this statement changes the prediction probability. Values' +
                                              'smaller than zero are an argument against the selected class, values ' +
                                              'larger than zero for the selected class.' +
                                              '\n\n' +
                                              'To switch the class, you can chose any class in the plot above by ' +
                                              'clicking the x axis ticks or box plots. The currently selected class is ' +
                                              'displayed above the plot.'}>
                                <h4>Explanations for Class {selectedLabel}</h4>
                                <div style={{height: explHeight, overflow: "hidden"}} ref={this.container}>
                                    <ResponsiveContainer>
                                        <BarChart data={expl} layout={'vertical'}
                                                  margin={{left: maxLabelLength, top: 20, right: 0, bottom: 0}}>
                                            <CartesianGrid strokeDasharray="3 3"/>
                                            <XAxis type={'number'}/>
                                            <YAxis dataKey="label" type={"category"} interval={0}
                                                   tick={<CustomizedTick
                                                       additionalFeatures={data.additional_features}/>}/>

                                            <Tooltip content={<MinimalisticTooltip/>}/>

                                            <Bar dataKey="x" fill={Colors.DEFAULT} className={'lime-explanation'}/>
                                            {this.state.x1 &&
                                                <text x={this.state.x1} y={15}>{`Not ${selectedLabel}`}</text>}
                                            {this.state.x2 &&
                                                <text x={this.state.x2} textAnchor="end"
                                                      y={15}>{selectedLabel.toString()}</text>}

                                            <ReferenceLine x="0" stroke="#666666"/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CollapseComp>
                        </div>
                    </>
                    }
                </>}
            </div>
        )
    }
}
