import React from "react";
import {ReactWidget} from "@jupyterlab/apputils";
import {IRenderMime} from "@jupyterlab/rendermime-interfaces";
import {CandidateId, Runhistory} from "./model";
import MetaInformationTable from "./components/meta_information";
import PerformanceTimeline from "./components/performance_timeline";
import {catchReactWarnings, JupyterContext} from "./util";
import {RocCurve} from "./components/roc_curve";
import {BanditExplanationsComponent} from "./components/bandit_explanation";
import {CandidateTable} from "./components/candidate_table";
import {Jupyter} from "./jupyter";
import {ParallelCoordinates} from "./components/pc/parallel_corrdinates";
import {LoadingIndicator} from "./components/loading";
import {CollapseComp} from "./util/collapse";


/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'mimerenderer-xautoml';

/**
 * A widget for rendering application/xautoml.
 */
export class JupyterWidget extends ReactWidget implements IRenderMime.IRenderer {
    private readonly _mimeType: string;
    private readonly jupyter: Jupyter;
    private runhistory: Runhistory = undefined;

    constructor(options: IRenderMime.IRendererOptions, jupyter: Jupyter) {
        super();
        this._mimeType = options.mimeType;
        this.jupyter = jupyter

        this.addClass(CLASS_NAME);
        catchReactWarnings()
    }

    renderModel(model: IRenderMime.IMimeModel): Promise<void> {
        try {
            this.runhistory = Runhistory.fromJson(model.data[this._mimeType] as unknown as Runhistory);
        } catch (e) {
            console.error('Failed to parse runhistory', e)
        }

        // Trigger call of render().
        this.onUpdateRequest(undefined);
        return this.renderPromise;
    }

    protected render() {
        if (!this.runhistory)
            return <p>Error loading data...</p>
        return <ReactRoot runhistory={this.runhistory} jupyter={this.jupyter}/>
    }
}

export interface ReactRootProps {
    runhistory: Runhistory;
    jupyter: Jupyter;
}

export interface ReactRootState {
    selectedCandidates: Set<CandidateId>
    mounted: boolean
}

export default class ReactRoot extends React.Component<ReactRootProps, ReactRootState> {

    private readonly container: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    constructor(props: ReactRootProps) {
        super(props);
        this.state = {selectedCandidates: new Set<CandidateId>(), mounted: false}

        this.onCandidateSelection = this.onCandidateSelection.bind(this)
    }

    private onCandidateSelection(cids: Set<CandidateId>) {
        this.setState({selectedCandidates: cids})
    }

    componentDidMount() {
        if (this.container.current.clientWidth > 0)
            this.setState({mounted: true})
        else
            // Jupyter renders all components before output containers are rendered.
            // Delay rendering to get the container width.
            window.setTimeout(() => this.setState({mounted: true}), 100)
    }

    render() {
        const {runhistory, jupyter} = this.props
        const {selectedCandidates, mounted} = this.state

        if (!mounted) {
            // Render loading indicator while waiting for delayed re-rendering with mounted container
            return (
                <div ref={this.container} style={{width: '100%'}}>
                    <LoadingIndicator loading={true}/>
                </div>
            )
        }

        if (!runhistory) {
            return <p>Error loading data...</p>
        }
        return (
            <JupyterContext.Provider value={jupyter}>
                <div style={{display: 'flex'}}>
                    <div style={{flexGrow: 1, flexShrink: 0, marginRight: '20px'}}>
                        <MetaInformationTable meta={runhistory.meta}/>
                        <CollapseComp showInitial={true}>
                            <h4>Performance Timeline</h4>
                            <PerformanceTimeline data={runhistory.structures} meta={runhistory.meta}
                                                 selectedCandidates={selectedCandidates}
                                                 onCandidateSelection={this.onCandidateSelection}/>
                        </CollapseComp>
                        <CollapseComp showInitial={true}>
                            <h4>ROC Curve</h4>
                            <RocCurve selectedCandidates={selectedCandidates} meta={runhistory.meta} height={300}/>
                        </CollapseComp>
                    </div>
                    <div style={{flexGrow: 2}}>
                        <CandidateTable structures={runhistory.structures}
                                        selectedCandidates={selectedCandidates}
                                        meta={runhistory.meta}
                                        onCandidateSelection={this.onCandidateSelection}/>

                        <ParallelCoordinates runhistory={runhistory}/>
                        <BanditExplanationsComponent explanations={runhistory.explanations.structures}
                                                     selectedCandidates={selectedCandidates}
                                                     structures={runhistory.structures}
                                                     onCandidateSelection={this.onCandidateSelection}/>
                    </div>
                </div>
            </JupyterContext.Provider>
        )
    }

}
