import React from "react";
import {CandidateId} from "../../model";
import {LoadingIndicator} from "../../util/loading";
import {ErrorIndicator} from "../../util/error";
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis} from "recharts";
import {Colors, JupyterContext} from "../../util";


interface RocCurveProps {
    selectedCandidates: Set<CandidateId>
    height: number
}

interface RocCurveState {
    data: Map<string, any[]>
    pendingCount: number
    loading: boolean
    error: Error
}

export class RocCurve extends React.Component<RocCurveProps, RocCurveState> {

    static readonly HELP = 'Displays the ROC curve for all selected candidates.' +
        '\n\n' +
        'A ROC curve, is a graphical plot that illustrates the diagnostic ability of a classifier system as its ' +
        'discrimination threshold is varied. The ROC curve is created by plotting the true positive rate (TPR) ' +
        'against the false positive rate (FPR) at various threshold settings.'

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: RocCurveProps) {
        super(props)

        this.state = {
            data: new Map<string, any[]>(),
            loading: false,
            error: undefined,
            pendingCount: 0
        }
    }

    componentDidMount() {
        if (this.props.selectedCandidates.size > 0) {
            const cids = Array.from(this.props.selectedCandidates)
            this.queryROCCurve(cids)
        }
    }

    componentDidUpdate(prevProps: Readonly<RocCurveProps>, prevState: Readonly<RocCurveState>, snapshot?: any) {
        if (prevProps.selectedCandidates.size !== this.props.selectedCandidates.size) {
            let newCandidates: CandidateId[]
            if (!this.state.loading) {
                // Remove previously selected candidates
                const superfluousCandidates = Array.from(prevProps.selectedCandidates).filter(c => !this.props.selectedCandidates.has(c))
                const currentCandidates = this.state.data
                const currentKeys = Array.from(currentCandidates.keys())
                superfluousCandidates.forEach(c => {
                    currentKeys.filter(k => k.startsWith(c)).forEach(k => currentCandidates.delete(k))
                })
                this.setState({data: currentCandidates})
                newCandidates = Array.from(this.props.selectedCandidates).filter(c => !prevProps.selectedCandidates.has(c))

                if (currentCandidates.size === 0)
                    this.setState({error: undefined})
            } else {
                // Request for data is currently still pending. Erase complete state and load everything from scratch to
                // prevent incoherent states
                this.setState({data: new Map<string, any[]>(), loading: false})
                newCandidates = Array.from(this.props.selectedCandidates)
            }

            // Fetch new selected candidates
            if (newCandidates.length > 0) {
                this.queryROCCurve(newCandidates)
            }
        }
    }

    private queryROCCurve(candidates: CandidateId[]) {
        const promise = this.context.requestROCCurve(candidates)
        this.setState({loading: true, error: undefined, pendingCount: candidates.length})

        promise
            .then(data => {
                const currentCandidates = this.state.data
                data.forEach((v, k) => currentCandidates.set(k, v))
                this.setState({data: currentCandidates, loading: false})
            })
            .catch(error => {
                console.error(`Failed to fetch Roc Curve data.\n${error.name}: ${error.message}`)
                this.setState({error: error, loading: false})
            });
    }

    render() {
        const {loading, pendingCount, error} = this.state

        let content: JSX.Element
        if (loading && pendingCount > 2)
            content = <LoadingIndicator loading={true}/>
        else {
            const labels: string[] = []
            const data: any[] = []
            this.state.data.forEach((v, k) => {
                const prunedName = k.split(' ')[0]
                if (this.props.selectedCandidates.has(prunedName)) {
                    labels.push(prunedName)
                    data.push(v)
                }
            })
            if (data.length > 0) {
                content = (
                    <div style={{height: this.props.height}}>
                        <ResponsiveContainer>
                            <LineChart>
                                <CartesianGrid strokeDasharray="3 3"/>
                                <XAxis dataKey="x" label={{value: 'False Positive Rate', dy: 10}} type={'number'}
                                       domain={[0, 1]}/>
                                <YAxis label={{value: 'True Positive Rate', angle: -90, dx: -15}}/>
                                {data.length <= 12 && <Legend/>}
                                {data.map((s, idx) => (
                                    <Line key={labels[idx]} name={labels[idx]} data={s} dataKey={'y'}
                                          stroke={Colors.getColor(idx)} strokeWidth={2} dot={false}/>
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )
            } else
                content = <p>No Configuration selected</p>
        }

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error && content}
            </>
        )
    }
}
