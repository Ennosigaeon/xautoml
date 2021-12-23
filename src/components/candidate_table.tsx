import React from 'react';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TablePagination from '@material-ui/core/TablePagination';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import Checkbox from '@material-ui/core/Checkbox';
import {Box, IconButton, Table, TableContainer} from '@material-ui/core';
import {Candidate, CandidateId, Explanations, MetaInformation, Structure} from '../model';
import {Components, JupyterContext, prettyPrint} from '../util';
import {StepWithConfig, StructureGraphComponent} from './details/structure_graph';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp';
import Collapse from '@material-ui/core/Collapse';
import {DataSetDetailsComponent} from './dataset_details';
import {JupyterButton} from "../util/jupyter-button";
import {ID} from "../jupyter";

interface SingleCandidate {
    id: CandidateId;
    timestamp: number;
    performance: number;
    candidate: [Structure, Candidate];
}

type Order = 'asc' | 'desc';

interface HeadCell {
    id: keyof SingleCandidate;
    label: string;
    numeric: boolean;
    sortable: boolean;
    width: string;
}

interface CandidateTableHeadProps {
    headCells: HeadCell[]
    numSelected: number;
    onRequestSort: (event: React.MouseEvent<unknown>, property: keyof SingleCandidate) => void;
    onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
    order: Order;
    orderBy: string;
    rowCount: number;
}

class CandidateTableHead extends React.Component<CandidateTableHeadProps, {}> {

    constructor(props: CandidateTableHeadProps) {
        super(props);
    }

    render() {
        const {headCells, numSelected, onRequestSort, onSelectAllClick, order, orderBy, rowCount} = this.props

        return (
            <TableHead>
                <TableRow>
                    <TableCell padding='checkbox'>
                        <Checkbox
                            indeterminate={numSelected > 0 && numSelected < rowCount}
                            checked={rowCount > 0 && numSelected === rowCount}
                            onChange={onSelectAllClick}
                            color='primary'
                        />
                    </TableCell>
                    {headCells.map(headCell => (
                        <TableCell
                            key={headCell.id}
                            align={headCell.numeric ? 'right' : 'left'}
                            sortDirection={orderBy === headCell.id ? order : false}
                            style={{width: headCell.width}}
                        >
                            {headCell.sortable ?
                                <TableSortLabel
                                    active={orderBy === headCell.id}
                                    direction={orderBy === headCell.id ? order : 'asc'}
                                    onClick={(event: React.MouseEvent) => onRequestSort(event, headCell.id)}
                                >
                                    {headCell.label}
                                    {orderBy === headCell.id ? (
                                        <span className={'candidate-table_visually-hidden'}>
                                        {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                                    </span>
                                    ) : null}
                                </TableSortLabel>
                                : headCell.label}
                        </TableCell>
                    ))}
                    <TableCell style={{width: '175px'}}/>
                </TableRow>
            </TableHead>
        )
    }
}


interface CandidateTableRowProps {
    candidate: SingleCandidate
    meta: MetaInformation
    selected: boolean
    onRowClick: (id: CandidateId) => void

    structures: Structure[]
    explanations: Explanations

    open: boolean
}

interface CandidateTableRowState {
    open: boolean
    selectedComponent: [string, string]
}

class CandidateTableRow extends React.Component<CandidateTableRowProps, CandidateTableRowState> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: CandidateTableRowProps) {
        super(props);
        this.state = {open: this.props.open, selectedComponent: [undefined, undefined]}

        this.toggleDetails = this.toggleDetails.bind(this)
        this.openComponent = this.openComponent.bind(this)
        this.openCandidateInJupyter = this.openCandidateInJupyter.bind(this)
        this.onRowClick = this.onRowClick.bind(this)
        this.onCheckBoxClick = this.onCheckBoxClick.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<CandidateTableRowProps>, prevState: Readonly<CandidateTableRowState>, snapshot?: any) {
        if (!prevProps.open && this.props.open)
            this.setState({open: true})
    }

    private toggleDetails(e: React.MouseEvent) {
        this.setState(state => {
            if (state.open)
                return {open: false, selectedComponent: [undefined, undefined]}
            else
                return {open: true, selectedComponent: [Components.SOURCE, Components.SOURCE]}
        })
        e.stopPropagation()
    }

    private openComponent(step: StepWithConfig) {
        if (this.state.open && this.state.selectedComponent[0] === step.id) {
            // Close details when selecting the same step again
            this.setState({open: false, selectedComponent: [undefined, undefined]})
        } else {
            this.setState({open: true, selectedComponent: [step.id, step.label]})
        }
    }

    private openCandidateInJupyter(e: React.MouseEvent) {
        this.context.createCell(`
from xautoml.util import io_utils

${ID}_X, ${ID}_y = io_utils.load_input_data('${this.props.meta.data_file}', framework='${this.props.meta.framework}')
${ID}_pipeline = io_utils.load_pipeline('${this.props.candidate.candidate[1].model_file}', framework='${this.props.meta.framework}')
${ID}_pipeline
        `.trim())
        e.stopPropagation()
    }

    private onRowClick(e: React.MouseEvent) {
        if (e.ctrlKey)
            this.props.onRowClick(this.props.candidate.id)
        else
            this.toggleDetails(e)
    }

    private onCheckBoxClick(e: React.MouseEvent) {
        this.props.onRowClick(this.props.candidate.id)
        e.stopPropagation()
    }

    render() {
        const {candidate, meta, selected, structures, explanations} = this.props
        const {open} = this.state

        const selectedComponent = (open && this.state.selectedComponent[0] === undefined) ?
            [Components.SOURCE, Components.SOURCE] : this.state.selectedComponent;

        return (
            <>
                <TableRow hover
                          onClick={this.onRowClick}
                          role='checkbox'
                          tabIndex={-1}
                          selected={selected}>
                    <TableCell padding='checkbox'>
                        <Checkbox checked={selected}
                                  color='primary'
                                  onClick={this.onCheckBoxClick}/>
                    </TableCell>
                    <TableCell id={candidate.id} scope='row' padding='none'>{candidate.id}</TableCell>
                    <TableCell align='right'>{prettyPrint(candidate.timestamp, 2)}</TableCell>
                    <TableCell align='right'>{prettyPrint(candidate.performance, 4)}</TableCell>
                    <TableCell align='right' style={{height: '50px'}} padding='none'>
                        <StructureGraphComponent structure={candidate.candidate[0]}
                                                 candidate={candidate.candidate[1]}
                                                 selectedComponent={selectedComponent[0]}
                                                 meta={meta}
                                                 onComponentSelection={this.openComponent}/>
                    </TableCell>
                    <TableCell>
                        <JupyterButton onClick={this.openCandidateInJupyter}/>
                        <IconButton aria-label='expand row' size='small' onClick={this.toggleDetails}>
                            {this.state.open ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                        </IconButton>
                    </TableCell>
                </TableRow>
                <TableRow>
                    <TableCell style={{padding: 0}} colSpan={6}>
                        <Collapse in={this.state.open} timeout='auto' unmountOnExit={false} mountOnEnter={true}>
                            <Box margin={1}>
                                <DataSetDetailsComponent
                                    structure={candidate.candidate[0]}
                                    candidate={candidate.candidate[1]}
                                    componentId={selectedComponent[0]}
                                    componentLabel={selectedComponent[1]}
                                    meta={meta}
                                    explanations={explanations}
                                    structures={structures}/>
                            </Box>
                        </Collapse>
                    </TableCell>
                </TableRow>
            </>
        );
    }
}

interface CandidateTableProps {
    structures: Structure[];
    selectedCandidates: Set<CandidateId>;
    hideUnselectedCandidates: boolean;
    showCandidate: CandidateId;
    meta: MetaInformation;
    explanations: Explanations;
    onCandidateSelection?: (cid: Set<CandidateId>) => void;
}

interface CandidateTableState {
    rows: SingleCandidate[],
    order: Order
    orderBy: keyof SingleCandidate
    page: number
    rowsPerPage: number
}

export class CandidateTable extends React.Component<CandidateTableProps, CandidateTableState> {

    static defaultProps = {
        onCandidateSelection: (_: CandidateId[]) => {
        }
    }

    constructor(props: CandidateTableProps) {
        super(props);

        this.state = {
            rows: this.calculateData(),
            order: this.props.meta.is_minimization ? 'asc' : 'desc',
            orderBy: 'performance',
            page: 0,
            rowsPerPage: 10
        }

        this.handleRequestSort = this.handleRequestSort.bind(this)
        this.handleSelectAllClick = this.handleSelectAllClick.bind(this)
        this.handleRowClick = this.handleRowClick.bind(this)
        this.handleChangePage = this.handleChangePage.bind(this)
        this.handleChangeRowsPerPage = this.handleChangeRowsPerPage.bind(this)
    }

    private handleRequestSort(_: React.MouseEvent<unknown>, property: keyof SingleCandidate): void {
        const isAsc = this.state.orderBy === property && this.state.order === 'asc';
        this.setState({order: isAsc ? 'desc' : 'asc', orderBy: property})
    }

    private handleSelectAllClick(event: React.ChangeEvent<HTMLInputElement>): void {
        if (event.target.checked) {
            const newSelected = this.state.rows.map((n) => n.id);
            this.props.onCandidateSelection(new Set(newSelected))
        } else {
            this.props.onCandidateSelection(new Set())
        }
    }

    private handleRowClick(id: CandidateId): void {
        const selected = new Set(this.props.selectedCandidates)
        if (selected.has(id)) {
            selected.delete(id)
        } else {
            selected.add(id)
        }

        this.props.onCandidateSelection(selected)
    }

    private handleChangePage(_: unknown, newPage: number) {
        this.setState({page: newPage})
    }

    private handleChangeRowsPerPage(event: React.ChangeEvent<HTMLInputElement>) {
        this.setState({rowsPerPage: parseInt(event.target.value, 10), page: 0})
    }

    componentDidUpdate(prevProps: Readonly<CandidateTableProps>, prevState: Readonly<CandidateTableState>, snapshot?: any) {
        if (prevProps.structures !== this.props.structures || prevProps.hideUnselectedCandidates !== this.props.hideUnselectedCandidates) {
            const rows = this.calculateData()
            this.setState({rows: rows})
        }

        if (prevProps.showCandidate !== this.props.showCandidate && this.props.showCandidate !== undefined) {
            const idx = this.state.rows.map(c => c.id).indexOf(this.props.showCandidate)
            const page = Math.trunc(idx / this.state.rowsPerPage)
            this.setState({page: page})
        }
    }

    private calculateData(): SingleCandidate[] {
        const rows: SingleCandidate[] = []

        this.props.structures.forEach(structure => {
            structure.configs
                .filter(c => !this.props.hideUnselectedCandidates || this.props.selectedCandidates.has(c.id))
                .forEach(c => {
                    rows.push(
                        {
                            id: c.id,
                            timestamp: c.runtime.timestamp,
                            performance: c.loss,
                            candidate: [structure, c]
                        }
                    )
                })
        })
        return rows
    }

    render() {
        const {structures, explanations} = this.props
        const {rows, order, orderBy, page, rowsPerPage} = this.state
        const comp = (a: SingleCandidate, b: SingleCandidate) => {
            const sign = order === 'desc' ? 1 : -1
            if (b[orderBy] < a[orderBy])
                return sign * -1;
            if (b[orderBy] > a[orderBy])
                return sign * 1;
            return 0;
        }

        const headCells: HeadCell[] = [
            {id: 'id', numeric: false, sortable: true, label: 'Id', width: '40px'},
            {id: 'timestamp', numeric: true, sortable: true, label: 'Timestamp', width: '90px'},
            {id: 'performance', numeric: true, sortable: true, label: 'Performance', width: '100px'},
            {id: 'candidate', numeric: false, sortable: false, label: 'Configuration', width: 'auto'}
        ];

        return (
            <>
                <TableContainer>
                    <Table style={{tableLayout: 'fixed'}}
                           size="small"
                           onMouseDown={(e => {
                               // Prevent browser from highlighting clicked table cells.
                               // See https://stackoverflow.com/questions/5067644/html-table-when-i-ctrlclick-the-border-of-the-cell-appears
                               if (e.ctrlKey)
                                   e.preventDefault()
                           })}>
                        <CandidateTableHead
                            headCells={headCells}
                            numSelected={this.props.selectedCandidates.size}
                            order={order}
                            orderBy={orderBy}
                            onSelectAllClick={this.handleSelectAllClick}
                            onRequestSort={this.handleRequestSort}
                            rowCount={rows.length}/>
                        <TableBody>
                            {rows.sort(comp)
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map(row => {
                                    return (
                                        <CandidateTableRow key={row.id}
                                                           candidate={row}
                                                           meta={this.props.meta}
                                                           selected={this.props.selectedCandidates.has(row.id)}
                                                           onRowClick={this.handleRowClick}
                                                           structures={structures}
                                                           explanations={explanations}
                                                           open={row.id === this.props.showCandidate}/>
                                    );
                                })}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[10, 20, 30]}
                    component='div'
                    count={rows.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={this.handleChangePage}
                    onRowsPerPageChange={this.handleChangeRowsPerPage}
                />
            </>
        )
    }
}
