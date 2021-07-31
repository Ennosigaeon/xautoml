import React from "react";
import {Candidate, CandidateId, Structure} from "./model";
import {DataGrid, GridColDef, GridRowId} from '@material-ui/data-grid';
import {StructureGraphComponent} from "./structure_graph";

interface CandidateTableProps {
    metric_sign: number;
    structures: Structure[];
    selectedCandidates: CandidateId[];
    onCandidateSelection?: (cid: CandidateId[]) => void;
}

export default class CandidateTable extends React.Component<CandidateTableProps, {}> {

    static
    defaultProps = {
        onCandidateSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: CandidateTableProps) {
        super(props);

        this.state = {selectedRows: []}
        this.processSelection = this.processSelection.bind(this)
    }

    private processSelection(selection: GridRowId[]) {
        this.props.onCandidateSelection(selection as string[])
    }

    render() {
        const rows: any[] = []
        const additionalData = new Map<CandidateId, [Structure, Candidate]>();

        const sign = this.props.metric_sign
        this.props.structures.forEach(structure => {
            structure.configs.forEach(c => {
                rows.push(
                    {
                        id: c.id,
                        timestamp: c.runtime.timestamp.toFixed(3),
                        performance: (sign * c.loss[0]).toFixed(3),
                    }
                )
                additionalData.set(c.id, [structure, c])
            })
        })

        const columns: GridColDef[] = [
            {field: 'id', headerName: 'Id', sortable: false},
            {field: 'timestamp', headerName: 'Timestamp', width: 150},
            {field: 'performance', headerName: 'Performance', width: 160},
            {
                field: 'candidate', headerName: 'Configuration', sortable: false, flex: 2, renderCell: params => {
                    const [structure, candidate] = additionalData.get(params.id as CandidateId)
                    return <StructureGraphComponent structure={structure} candidate={candidate}/>
                }
            }
        ];

        return (
            <div style={{height: 640, width: '100%'}}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    pageSize={10}
                    sortModel={[{
                        field: 'performance',
                        sort: 'desc',
                    }]}
                    getRowClassName={(params) => {
                        if (this.props.selectedCandidates.includes(params.id as string))
                            return 'selected-config'
                        else if (additionalData.get(params.id as CandidateId)[1].status != Candidate.SUCCESS)
                            return 'failed-config'
                        else return ''
                    }}
                    checkboxSelection
                    selectionModel={this.props.selectedCandidates}
                    onSelectionModelChange={this.processSelection}
                />
            </div>
        )
    }
}
