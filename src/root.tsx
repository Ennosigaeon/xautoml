import React from "react";
import {ReactWidget} from "@jupyterlab/apputils";
import {IRenderMime} from "@jupyterlab/rendermime-interfaces";
import {CandidateId, Pipeline, Runhistory} from "./model";
import MetaInformationTable from "./components/meta_information";
import PerformanceTimeline from "./components/performance_timeline";
import {catchReactWarnings, JupyterContext} from "./util";
import {RocCurve} from "./components/roc_curve";
import {BanditExplanationsComponent} from "./components/bandit_explanation";
import {CandidateTable} from "./components/candidate_table";
import {Jupyter} from "./jupyter";


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
    private data: Runhistory = undefined;

    constructor(options: IRenderMime.IRendererOptions, jupyter: Jupyter) {
        super();
        this._mimeType = options.mimeType;
        this.jupyter = jupyter

        this.addClass(CLASS_NAME);
        catchReactWarnings()
    }

    renderModel(model: IRenderMime.IMimeModel): Promise<void> {
        try {
            this.data = Runhistory.fromJson(model.data[this._mimeType] as unknown as Runhistory);
        } catch (e) {
            console.error('Failed to parse runhistory', e)
        }

        // Trigger call of render().
        this.onUpdateRequest(undefined);
        return this.renderPromise;
    }

    protected render() {
        if (!this.data)
            return <p>Error loading data...</p>
        return <ReactRoot data={this.data} jupyter={this.jupyter}/>
    }
}

export interface ReactRootProps {
    data: Runhistory;
    jupyter: Jupyter;
}

export interface ReactRootState {
    selectedCandidates: Set<CandidateId>
}


export default class ReactRoot extends React.Component<ReactRootProps, ReactRootState> {

    constructor(props: ReactRootProps) {
        super(props);
        this.state = {selectedCandidates: new Set<CandidateId>()}

        this.onCandidateSelection = this.onCandidateSelection.bind(this)
    }

    private onCandidateSelection(cids: Set<CandidateId>) {
        this.setState({selectedCandidates: cids})
    }

    render() {
        const {data, jupyter} = this.props
        const selectedCandidates = this.state.selectedCandidates
        const pipelines = new Map<CandidateId, Pipeline>(data.structures.map(s => [s.cid, s.pipeline]))

        if (!data) {
            return <p>Error loading data...</p>
        }
        return (
            <JupyterContext.Provider value={jupyter}>
                <MetaInformationTable meta={data.meta}/>
                <CandidateTable structures={data.structures}
                                selectedCandidates={selectedCandidates}
                                meta={data.meta}
                                onCandidateSelection={this.onCandidateSelection}/>
                <div style={{display: 'flex', height: '400px'}}>
                    <div style={{height: '100%', flexBasis: 0, flexGrow: 1}}>
                        <PerformanceTimeline data={data.structures} meta={data.meta}
                                             selectedCandidates={selectedCandidates}
                                             onCandidateSelection={this.onCandidateSelection}/>
                    </div>
                    <div style={{height: '100%', flexBasis: 0, flexGrow: 1}}>
                        <RocCurve selectedCandidates={selectedCandidates} meta={data.meta}/>
                    </div>
                </div>

                <BanditExplanationsComponent data={data.explanations.structures} pipelines={pipelines}
                                             selectedCandidates={selectedCandidates} structures={data.structures}
                                             onCandidateSelection={this.onCandidateSelection}/>
            </JupyterContext.Provider>
        )
    }

}
