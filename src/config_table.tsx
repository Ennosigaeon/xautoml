import React from "react";
import {CandidateId, Config, Pipeline, Structure} from "./model";
import 'purecss/build/tables.css'
import {DataGrid, GridCellParams, GridColDef, GridRowId} from '@material-ui/data-grid';

interface PipelineVisualizerProps {
    pipeline: Pipeline
}


export class PipelineVisualizer extends React.Component<PipelineVisualizerProps, {}> {

    render() {
        return (
            <div>{this.props.pipeline.steps.map(step => step[1].split('.').pop()).join(' -> ')}</div>
        )
    }
}


interface ConfigTableProps {
    configs: Map<CandidateId, Config[]>;
    structures: Map<CandidateId, Structure>;
    selectedConfigs: CandidateId[];
    onConfigSelection?: (cid: CandidateId[]) => void;
}

export default class ConfigTable extends React.Component<ConfigTableProps, {}> {

    static defaultProps = {
        onConfigSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: ConfigTableProps) {
        super(props);

        this.state = {selectedRows: []}
        this.processSelection = this.processSelection.bind(this)
    }

    private processSelection(selection: GridRowId[]) {
        this.props.onConfigSelection(selection as string[])
    }

    render() {
        const columns: GridColDef[] = [
            {field: 'id', headerName: 'Id'},
            {
                field: 'pipeline', headerName: 'Pipeline', flex: 2, renderCell: (params: GridCellParams) => {
                    const pipeline = params.getValue(params.id, 'pipeline') as Pipeline
                    return <PipelineVisualizer pipeline={pipeline}/>
                }
            },
            {field: 'config', headerName: 'Configuration', flex: 2},
            {field: 'timestamp', headerName: 'Timestamp', width: 150},
            {field: 'performance', headerName: 'Performance', width: 160}
        ];


        const rows: any[] = []

        this.props.configs.forEach((configs: Config[], structure: string) => {
            configs.map(c => rows.push(
                {
                    id: c.id,
                    pipeline: this.props.structures.get(structure).pipeline,
                    config: 'TODO: Missing',
                    timestamp: c.runtime.timestamp.toFixed(3),
                    performance: c.loss[0].toFixed(3),
                    result: c.status
                }
            ))
        })


        return (
            <div style={{height: 640, width: '100%'}}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    pageSize={10}
                    getRowClassName={(params) => {
                        if (this.props.selectedConfigs.includes(params.id as string))
                            return 'selected-config'
                        else if (params.getValue(params.id, 'result') != Config.SUCCESS)
                            return 'config-table-failure'
                        else return ''
                    }}
                    checkboxSelection
                    selectionModel={this.props.selectedConfigs}
                    onSelectionModelChange={this.processSelection}
                />
            </div>
        )
    }
}
