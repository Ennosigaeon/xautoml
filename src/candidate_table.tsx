import React from "react";
import {Candidate, CandidateId, Config, Pipeline, Structure} from "./model";
import {DataGrid, GridColDef, GridRowId} from '@material-ui/data-grid';
import {Paper, Table, TableBody, TableCell, TableContainer, TableRow, Tooltip, Typography} from "@material-ui/core";
import {fixedPrec, normalizeComponent} from "./util";

interface ComponentVisualizerProps {
    pipeline: Pipeline
    component: string
    config: Config
}


export class ComponentVisualizer extends React.Component<ComponentVisualizerProps, {}> {

    constructor(props: ComponentVisualizerProps) {
        super(props);

        this.toggleTooltip = this.toggleTooltip.bind(this)
    }

    private toggleTooltip(show: boolean) {
        this.setState({showTooltip: show})
    }

    render() {
        const subConfigs = new Array<[string, Config]>()

        this.props.pipeline.steps
            .filter(t => t[1].endsWith(this.props.component))
            .map(t => t[0])
            .forEach(step => {
                    const prefix = `${step}:`
                    const subConfig = new Map<string, number | string | boolean>()

                    Array.from(this.props.config.keys())
                        .filter(k => k.startsWith(prefix))
                        .forEach(key => {
                            subConfig.set(key.substring(prefix.length), this.props.config.get(key))
                        })
                    subConfigs.push([step, subConfig])
                }
            )

        if (subConfigs.length > 0) {
            return (
                <Tooltip title={
                    <>
                        <Typography color="inherit" component={'h4'}>Configuration</Typography>
                        {subConfigs.map(([step, conf]) => (
                            <div key={step}>
                                <Typography color="inherit" component={'p'}>Step: {step}</Typography>
                                <TableContainer component={Paper}>
                                    <Table size="small">
                                        <TableBody>
                                            {Array.from(conf).map(([name, value]) => (
                                                <TableRow key={name}>
                                                    <TableCell component="th" scope="row">{name}</TableCell>
                                                    <TableCell align="right">{
                                                        typeof value === 'number' ? fixedPrec(value, 5) : String(value)
                                                    }</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <hr/>
                            </div>
                        ))}
                    </>
                } placement={'left'}>
                    <div className={'candidate-table_component'}>{subConfigs.length}</div>
                </Tooltip>
            )
        } else {
            return <></>
        }
    }
}


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
        const primitives = new Set<string>()
        this.props.structures.forEach((v, k) => {
            v.pipeline.steps.map(s => primitives.add(s[1]))
        })
        const sortedPrimitives = Array.from(primitives.values()).sort((a, b) => a.localeCompare(b))

        const columns: GridColDef[] = [
            {field: 'id', headerName: 'Id', sortable: false},
            {field: 'timestamp', headerName: 'Timestamp', width: 150},
            {field: 'performance', headerName: 'Performance', width: 160}
        ];
        sortedPrimitives.map(c => columns.push(
            {
                field: c,
                headerName: normalizeComponent(c),
                sortable: false,
                width: 50,
                headerClassName: 'candidate-table_vertical-header',
                renderCell: params => {
                    const [pipeline, config, _] = additionalData.get(params.id as CandidateId)
                    return <ComponentVisualizer pipeline={pipeline} component={params.field} config={config}/>
                }
            }
        ))

        const rows: any[] = []
        const additionalData: Map<CandidateId, [Pipeline, Config, string]> = new Map<CandidateId, [Pipeline, Config, string]>();

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
                additionalData.set(c.id, [structure.pipeline, c.config, c.status])
            })
        })

        return (
            <div style={{height: 730, width: '100%'}}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    pageSize={10}
                    headerHeight={150}
                    sortModel={[{
                        field: 'performance',
                        sort: 'desc',
                    }]}
                    getRowClassName={(params) => {
                        if (this.props.selectedCandidates.includes(params.id as string))
                            return 'selected-config'
                        else if (additionalData.get(params.id as CandidateId)[2] != Candidate.SUCCESS)
                            return 'config-table-failure'
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
