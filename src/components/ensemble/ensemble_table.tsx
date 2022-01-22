import React from "react";
import {CandidateId, Prediction} from "../../model";
import {EnsembleMemberStats} from "../../dao";
import {Table, TableContainer} from "@material-ui/core";
import TableBody from "@material-ui/core/TableBody";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import TableHead from "@material-ui/core/TableHead";
import {prettyPrint} from "../../util";

type Order = 'asc' | 'desc';

interface HeadCell {
    id: keyof RowRecord;
    label: string;
    numeric: boolean;
}

interface RowRecord extends EnsembleMemberStats {
    id: CandidateId
    prediction: Prediction
}

interface EnsembleTableProps {
    metrics: Map<CandidateId, EnsembleMemberStats>
    predictions: Map<CandidateId, Prediction>

    onCandidateSelection: (cid: Set<CandidateId>, show?: boolean) => void
}

interface EnsembleTableState {
    order: Order;
    orderBy: keyof RowRecord;
}

export class EnsembleTable extends React.Component<EnsembleTableProps, EnsembleTableState> {

    static readonly HELP = 'List of all pipelines in the ensemble. For each member, the weight in the ensemble and ' +
        'how much the prediction of this member align with the ensemble prediction (consensus) are displayed. By ' +
        'selecting a single sample in the data set preview on the right, the actual predictions of each ensemble ' +
        'member can be computed. '

    constructor(props: EnsembleTableProps) {
        super(props);
        this.state = {order: 'desc', orderBy: 'weight'}

        this.onRequestSort = this.onRequestSort.bind(this)
    }

    private onRequestSort(_: React.MouseEvent<unknown>, property: keyof RowRecord): void {
        const isAsc = this.state.orderBy === property && this.state.order === 'asc';
        this.setState({order: isAsc ? 'desc' : 'asc', orderBy: property})
    }

    private onRowClick(e: React.MouseEvent, cid: CandidateId) {
        if (e.ctrlKey) {
            this.props.onCandidateSelection(new Set([cid]), true)
            e.stopPropagation()
            e.preventDefault()
        }
    }

    render() {
        const {order, orderBy} = this.state

        const headCells: HeadCell[] = [
            {id: 'id', numeric: false, label: 'Id'},
            {id: 'prediction', numeric: true, label: 'Prediction'},
            {id: 'weight', numeric: true, label: 'Weight'},
            {id: 'consensus', numeric: true, label: 'Consensus'},
        ];

        const comp = (a: RowRecord, b: RowRecord) => {
            const sign = order === 'desc' ? 1 : -1
            if (b[orderBy] < a[orderBy])
                return sign * -1;
            if (b[orderBy] > a[orderBy])
                return sign * 1;
            return 0;
        }

        const rows: RowRecord[] = []
        this.props.metrics.forEach((value, cid) => rows.push({
            id: cid,
            weight: value.weight,
            consensus: value.consensus,
            prediction: this.props.predictions.get(cid)
        }))

        return (
            <TableContainer>
                <Table size="small"
                       onMouseDown={(e => {
                           // Prevent browser from highlighting clicked table cells.
                           // See https://stackoverflow.com/questions/5067644/html-table-when-i-ctrlclick-the-border-of-the-cell-appears
                           if (e.ctrlKey)
                               e.preventDefault()
                       })}>
                    <TableHead>
                        <TableRow>
                            {headCells.map(headCell => (
                                <TableCell
                                    key={headCell.id}
                                    align={headCell.numeric ? 'right' : 'left'}
                                    sortDirection={orderBy === headCell.id ? order : false}
                                >
                                    <TableSortLabel
                                        active={orderBy === headCell.id}
                                        direction={orderBy === headCell.id ? order : 'asc'}
                                        onClick={(event: React.MouseEvent) => this.onRequestSort(event, headCell.id)}
                                    >
                                        {headCell.label}
                                        {orderBy === headCell.id ? (
                                            <span className={'candidate-table_visually-hidden'}>
                                                    {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                                                </span>
                                        ) : null}
                                    </TableSortLabel>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows
                            .sort(comp)
                            .map(row => {
                                return (
                                    <TableRow key={row.id} hover tabIndex={-1}
                                              onClick={(e) => this.onRowClick(e, row.id)}>
                                        <TableCell scope='row' padding='none'>{row.id}</TableCell>
                                        <TableCell align='right'>{row.prediction}</TableCell>
                                        <TableCell align='right'>{prettyPrint(row.weight)}</TableCell>
                                        <TableCell align='right'>{prettyPrint(row.consensus)}</TableCell>
                                    </TableRow>
                                );
                            })}
                    </TableBody>
                </Table>
            </TableContainer>


        )
    }
}
