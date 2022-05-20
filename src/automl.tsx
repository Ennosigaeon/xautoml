import {ReactWidget} from '@jupyterlab/apputils';


import React from 'react';
import {IFileBrowserFactory} from "@jupyterlab/filebrowser";
import {ClassificationRoot} from "./components/automl/classification";
import {TimeSeriesRoot} from "./components/automl/timeseries";
import {KernelWrapper} from "./jupyter";
import {IDocumentManager} from "@jupyterlab/docmanager";

export class ClassificationWidget extends ReactWidget {

    public kernel: KernelWrapper;

    constructor(private readonly fileBrowserFactory: IFileBrowserFactory,
                private readonly documentManager: IDocumentManager,
                private readonly mimeType: string) {
        super();
    }

    render(): JSX.Element {
        return <ClassificationRoot fileBrowserFactory={this.fileBrowserFactory} kernel={this.kernel}
                                   documentManager={this.documentManager} mimeType={this.mimeType}/>;
    }
}


export class TimeSeriesWidget extends ReactWidget {
    /**
     * Constructs a new CounterWidget.
     */
    constructor() {
        super();
    }

    render(): JSX.Element {
        return <TimeSeriesRoot/>;
    }
}
