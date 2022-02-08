import React from 'react';
import {FeatureImportance, PDPResponse} from "../../dao";
import {LoadingIndicator} from "../../util/loading";
import {DetailsModel} from "./model";
import {ErrorIndicator} from "../../util/error";
import {Colors, JupyterContext, maxLabelLength, prettyPrint} from "../../util";
import {CommonWarnings} from "../../util/warning";
import {JupyterButton} from "../../util/jupyter-button";
import {ImportanceOverviewComp} from "../../util/importance_overview";
import {CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis} from "recharts";
import {Heading} from "../../util/heading";
import {FormControl, MenuItem, Select} from '@material-ui/core';
import {CandidateId} from "../../model";
import {ID} from "../../jupyter";

class LabelEncoder {

    public labels: string[]

    fit(data: string[]): LabelEncoder {
        this.labels = [...new Set(data)]
        return this
    }

    transform(x: string): number {
        return this.labels.indexOf(x)
    }

    inverse(i: number): string {
        return this.labels[i]
    }
}


interface PDPCompProps {
    data: Map<string, PDPResponse>
    feature: string
    cid: CandidateId
    component: string
}

interface PDPCompState {
    clazz: string
}

class PDPComp extends React.Component<PDPCompProps, PDPCompState> {

    static readonly HELP = 'Partial dependence plots (PDP) and individual conditional expectation (ICE) plots can be ' +
        'used to visualize and analyze interaction between the target class and a input feature of  interest. PDPs ' +
        'are calculated by, marginalizing over the values of all other input features (the ‘complement’ features). ' +
        'Intuitively, you can interpret the partial dependence as the expected target response as a function of the ' +
        'input features of interest.' +
        '\n\n' +
        'Similar to a PDP, an ICE plot shows the dependence between the target function and an input feature of ' +
        'interest. However, unlike a PDP, which shows the average effect of the input feature, an ICE plot ' +
        'visualizes the dependence of the prediction on a feature for each sample separately with one line per ' +
        'sample.' +
        '\n\n' +
        'The PDP line for the selected component is rendered in dark blue while a subset of the ICE lines is ' +
        'rendered in light blue. The x axis contains the possible range of the selected feature while the y axis ' +
        'contains the partial dependence on the target class.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: PDPCompProps) {
        super(props);
        this.state = {clazz: undefined}

        this.handleClassChange = this.handleClassChange.bind(this)
        this.exportDataFrame = this.exportDataFrame.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<PDPCompProps>, prevState: Readonly<PDPCompState>, snapshot?: any) {
        if (prevProps.data === undefined && this.props.data !== undefined)
            this.setState({clazz: this.props.data.keys().next().value})
    }

    handleClassChange(event: any) {
        this.setState({clazz: event.target.value})
    }

    private exportDataFrame() {
        const {cid, component, feature} = this.props

        this.context.createCell(`
${ID}_pdp = gcx().pdp('${cid}', '${component}', ['${feature}'])
${ID}_pdp
        `.trim())
    }

    renderNumerical(data: PDPResponse) {
        const yRange = data.y_range
        const pdp = data.features.get(this.props.feature)

        return (
            <ResponsiveContainer>
                <LineChart data={pdp.avg} margin={{left: 30}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis type="number" dataKey="x" label={{value: this.props.feature, dy: 10}}
                           domain={['dataMin', 'dataMax']} tickFormatter={prettyPrint}/>
                    <YAxis type="number" dataKey="y" label={{value: `Partial dependence`, angle: -90, dx: -40}}
                           domain={yRange} tickFormatter={prettyPrint}/>

                    {pdp.ice.map((points, idx) => (
                        <Line key={idx} data={points} type="monotone" dataKey="y"
                              stroke={Colors.DEFAULT} strokeWidth={1} dot={false}/>
                    ))}
                    {pdp.avg && <Line data={pdp.avg} type="monotone" dataKey="y"
                                      stroke={Colors.HIGHLIGHT} strokeWidth={2} dot={false}/>
                    }
                </LineChart>
            </ResponsiveContainer>
        )
    }

    renderCategorical(data: PDPResponse) {
        const yRange = data.y_range
        const pdp = data.features.get(this.props.feature)
        const ice = [].concat(...pdp.ice)
        const avg = pdp.avg

        const encoder = new LabelEncoder().fit(avg.map(i => i.x as string))

        return (
            <ResponsiveContainer>
                <ScatterChart margin={{left: 30}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis type="number" dataKey="x" label={{value: this.props.feature, dy: 10}}
                           domain={[-0.5, encoder.labels.length - 0.5]}
                           ticks={[...Array(encoder.labels.length).keys()].map((_, i) => i)}
                           tickFormatter={(i: number) => encoder.inverse(i)}/>
                    <YAxis type="number" dataKey="y" label={{value: `Partial dependence`, angle: -90, dx: -40}}
                           domain={yRange} tickFormatter={prettyPrint}/>

                    {ice && <Scatter data={ice.map(i => ({x: encoder.transform(i.x as string), y: i.y}))}
                                     fill={Colors.DEFAULT}
                                     radius={1}/>}
                    {avg && <Scatter data={avg.map(i => ({x: encoder.transform(i.x as string), y: i.y}))}
                                     fill={Colors.HIGHLIGHT}
                                     radius={3}/>}
                </ScatterChart>
            </ResponsiveContainer>
        )
    }

    render() {
        const {feature} = this.props
        const data = this.props?.data?.get(this.state.clazz)

        const pdp = data ? data.features.get(feature) : undefined

        return (
            <>
                <div style={{height: '250px', flexGrow: 1}}>
                    <LoadingIndicator loading={data === undefined}/>
                    {pdp &&
                        <>
                            <div style={{display: "flex", justifyContent: "space-between", marginBottom: '1em'}}
                                 className={'pdp'}>
                                <Heading help={PDPComp.HELP}>
                                    <h4>
                                        Partial Dependencies for Feature <i>{feature}</i> and class&nbsp;
                                        {this.props.data.size > 2 ?
                                            <FormControl variant="standard" size="small">
                                                <Select value={this.state.clazz}
                                                        onChange={this.handleClassChange}
                                                        style={{marginLeft: '10px', marginRight: '10px'}}>
                                                    {Array.from(this.props.data.keys()).map(clazz => <MenuItem
                                                        value={clazz}>{clazz}</MenuItem>)}
                                                </Select>
                                            </FormControl> : <i>{this.state.clazz}</i>
                                        }</h4>
                                </Heading>
                                <JupyterButton onClick={this.exportDataFrame}/>
                            </div>

                            {typeof pdp.avg[0].x === 'number' && this.renderNumerical(data)}
                            {typeof pdp.avg[0].x === 'string' && this.renderCategorical(data)}
                        </>
                    }
                </div>
            </>
        )
    }
}


interface FeatureImportanceProps {
    model: DetailsModel

    selectedFeature?: string
    onFeatureSelection?: (feature: string) => void
}

interface FeatureImportanceState {
    data: FeatureImportance
    pdp: Map<string, PDPResponse>
    error: Error
    detailsError: Error
    selectedRow: number
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
        this.state = {
            data: undefined,
            pdp: undefined,
            error: undefined,
            selectedRow: undefined,
            detailsError: undefined
        }

        this.exportDataFrame = this.exportDataFrame.bind(this)
        this.selectRow = this.selectRow.bind(this)
    }

    componentDidMount() {
        window.setTimeout(() => {
            this.queryFeatureImportance().then(() => this.selectRow(this.state?.data.data.column_names.indexOf(this.props.selectedFeature)))
        }, 100)
    }

    componentDidUpdate(prevProps: Readonly<FeatureImportanceProps>, prevState: Readonly<FeatureImportanceState>, snapshot?: any) {
        if (prevProps.model.component !== this.props.model.component)
            this.queryFeatureImportance()

        if (prevProps.selectedFeature !== this.props.selectedFeature)
            this.selectRow(this.state.data.data.column_names.indexOf(this.props.selectedFeature))
    }

    private queryFeatureImportance() {
        const {candidate, component} = this.props.model
        if (!component)
            return

        this.setState({error: undefined, selectedRow: undefined, pdp: undefined, detailsError: undefined})
        return this.context.requestFeatureImportance(candidate.id, component)
            .then(data => this.setState({data: data, error: undefined}))
            .catch(error => {
                console.error(`Failed to fetch FeatureImportance data.\n${error.name}: ${error.message}`)
                this.setState({error: error})
            });
    }

    private selectRow(idx: number) {
        if (idx === undefined)
            return
        if (idx === -1)
            this.setState({selectedRow: undefined, pdp: undefined})
        else {
            const feature = this.state.data.data.column_names[idx]
            this.setState({selectedRow: idx})
            this.queryPDP(feature)
            if (this.props.onFeatureSelection !== undefined && this.props.selectedFeature !== feature)
                this.props.onFeatureSelection(feature)
        }
    }

    private queryPDP(feature: string) {
        this.setState({pdp: undefined, detailsError: undefined})
        this.context.requestPDP(this.props.model.candidate.id, this.props.model.component, [feature])
            .then(data => this.setState({pdp: data, detailsError: undefined}))
            .catch(error => {
                console.error(`Failed to fetch FeatureImportance data.\n${error.name}: ${error.message}`)
                this.setState({detailsError: error})
            });
    }

    private exportDataFrame() {
        const {candidate, component} = this.props.model

        this.context.createCell(`
${ID}_feature_importance = gcx().feature_importance('${candidate.id}', '${component}')
${ID}_feature_importance
        `.trim())
    }

    render() {
        const {data, error, selectedRow, pdp, detailsError} = this.state
        const marginTop = data ? maxLabelLength(data.data.column_names) : 0

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error &&
                    <>
                        <LoadingIndicator loading={data === undefined}/>
                        {data && data.data.column_names.length > 0 &&
                            <>
                                <CommonWarnings additionalFeatures={data.additional_features.length > 0}/>
                                <div style={{display: 'flex'}}>
                                    <ImportanceOverviewComp overview={data.data} selectedRow={selectedRow}
                                                            onExportClick={this.exportDataFrame}
                                                            onSelectRow={this.selectRow}/>
                                    <div style={{
                                        marginLeft: '20px',
                                        flexGrow: 1,
                                        flexShrink: 1,
                                        minWidth: 'auto'
                                    }}>
                                        {selectedRow === undefined ?
                                            <p style={{marginTop: marginTop}}>
                                                Select a feature on the left side to get a detailed visualization how
                                                the different values of this feature correlate with the predicted class.
                                            </p> :
                                            <>
                                                <ErrorIndicator error={detailsError}/>
                                                {detailsError === undefined &&
                                                    <PDPComp data={pdp} feature={data.data.column_names[selectedRow]}
                                                             cid={this.props.model.candidate.id}
                                                             component={this.props.model.component}/>
                                                }
                                            </>
                                        }
                                    </div>
                                </div>
                            </>
                        }
                        {data && data.data.column_names.length === 0 &&
                            <p>Feature importance not available for the actual predictions.</p>}
                    </>
                }
            </>
        );
    }
}
