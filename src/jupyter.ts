import {INotebookTracker, NotebookActions} from "@jupyterlab/notebook";


export type JupyterTokens = {
    notebooks: INotebookTracker
}

export namespace Jupyter {


    export function createCell(notebooks: INotebookTracker, content: string = ''): void {
        const current = notebooks.currentWidget;
        const notebook = current.content;
        NotebookActions.insertBelow(notebook);

        const activeCell = notebook.activeCell;
        activeCell.model.value.text = content;
    }
}
