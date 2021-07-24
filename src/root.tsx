import React from "react";
import {ReactWidget} from "@jupyterlab/apputils";
import {IRenderMime} from "@jupyterlab/rendermime-interfaces";
import {CandidateId, Pipeline, Runhistory} from "./model";
import MetaInformationTable from "./meta_information";
import ConfigTable from "./config_table";
import PerformanceTimeline from "./performance_timeline";
import {StructureGraphComponent} from "./structuregraph";
import {catchReactWarnings} from "./util";


/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'mimerenderer-xautoml';

/**
 * A widget for rendering application/xautoml.
 */
export class JupyterWidget extends ReactWidget implements IRenderMime.IRenderer {
    private readonly _mimeType: string;
    private data: Runhistory = undefined;

    constructor(options: IRenderMime.IRendererOptions) {
        super();
        this._mimeType = options.mimeType;
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
        if (!this.data) {
            return <p>Error loading data...</p>
        }
        return <ReactRoot data={this.data}/>
    }
}

export interface ReactRootProps {
    data: Runhistory;
}

export interface ReactRootState {
    selectedConfigs: CandidateId[]
}

export default class ReactRoot extends React.Component<ReactRootProps, ReactRootState> {

    constructor(props: ReactRootProps) {
        super(props);
        this.state = {selectedConfigs: []}

        this.onConfigSelection = this.onConfigSelection.bind(this)
    }

    private onConfigSelection(cids: CandidateId[]) {
        this.setState({selectedConfigs: cids})
    }

    render() {
        const data = this.props.data
        const pipelines = new Map<string, Pipeline>()
        this.props.data.structures.forEach((v, k) => pipelines.set(k, v.pipeline))

        if (!data) {
            return <p>Error loading data...</p>
        }
        return <>
            <MetaInformationTable meta={data.meta}/>
            <ConfigTable configs={data.configs} structures={data.structures}
                         selectedConfigs={this.state.selectedConfigs}
                         onConfigSelection={this.onConfigSelection}/>
            <div style={{'width': '800px', 'height': '400px'}}>
                <PerformanceTimeline data={data.configs} meta={data.meta} selectedConfigs={this.state.selectedConfigs}
                                     onConfigSelection={this.onConfigSelection}/>
            </div>
            <StructureGraphComponent data={data.xai.structures} pipelines={pipelines}
                                     selectedConfigs={this.state.selectedConfigs} configs={data.configs}
                                     onConfigSelection={this.onConfigSelection}/>
        </>
    }

}
