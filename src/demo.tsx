import React from "react";
import {ReactWidget} from "@jupyterlab/apputils";
import {IRenderMime} from "@jupyterlab/rendermime-interfaces";
import {Runhistory} from "./model";
import {StructureGraphComponent} from "./structuregraph";
import PerformanceTimeline from "./performance_timeline";
import MetaInformationTable from "./meta_information";


/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'mimerenderer-xautoml';

/**
 * A widget for rendering application/xautoml.
 */
export class OutputWidget extends ReactWidget implements IRenderMime.IRenderer {
    private readonly _mimeType: string;
    private data: Runhistory = undefined;

    constructor(options: IRenderMime.IRendererOptions) {
        super();
        this._mimeType = options.mimeType;
        this.addClass(CLASS_NAME);
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
        return <>
            <MetaInformationTable meta={this.data.meta}/>
            <div style={{'width': '800px', 'height': '400px'}}>
                <PerformanceTimeline data={this.data.configs} meta={this.data.meta}/>
            </div>
            <StructureGraphComponent data={this.data.xai.structures}/>
        </>
    }
}
