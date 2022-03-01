import React from 'react';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TablePagination from '@material-ui/core/TablePagination';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import Checkbox from '@material-ui/core/Checkbox';
import {Box, IconButton, Menu, MenuItem, Table, TableContainer} from '@material-ui/core';
import {Candidate, CandidateId, Explanations, MetaInformation, PipelineStep, Structure} from '../model';
import {Components, JupyterContext, prettyPrint} from '../util';
import {PipelineVisualizationComponent} from './details/pipeline_visualization';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp';
import Collapse from '@material-ui/core/Collapse';
import {CandidateInspections} from './candidate_inspections';
import {JupyterButton} from "../util/jupyter-button";
import {ID} from "../jupyter";
import {MoreVert} from "@material-ui/icons";
import {Comparison} from "./comparison";
import {DetailsModel, ComparisonType} from "./details/model";

interface SingleCandidate {
    id: CandidateId;
    pred_time: number;
    performance: number;
    candidate: [Structure, Candidate];
}

type Order = 'asc' | 'desc';

interface HeaderCell {
    id: keyof SingleCandidate;
    label: string;
    numeric: boolean;
    sortable: boolean;
    width: string;
}

interface LeaderboardHeaderProps {
    headCells: HeaderCell[]
    numSelected: number;
    onRequestSort: (event: React.MouseEvent<unknown>, property: keyof SingleCandidate) => void;
    onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
    order: Order;
    orderBy: string;
    rowCount: number;
}

class LeaderboardHeader extends React.Component<LeaderboardHeaderProps> {

    constructor(props: LeaderboardHeaderProps) {
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
                    <TableCell style={{width: '205px'}}/>
                </TableRow>
            </TableHead>
        )
    }
}


interface LeaderboardRowProps {
    candidate: SingleCandidate
    meta: MetaInformation
    selected: boolean
    onRowClick: (id: CandidateId) => void
    onRowHide: (id: CandidateId) => void
    onComparisonRequest: (type: ComparisonType, selectedRow: number) => void

    structures: Structure[]
    explanations: Explanations

    open: boolean
}

interface LeaderboardRowState {
    open: boolean
    selectedComponent: [string, string]
}

class LeaderboardRow extends React.Component<LeaderboardRowProps, LeaderboardRowState> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: LeaderboardRowProps) {
        super(props);
        this.state = {open: this.props.open, selectedComponent: [undefined, undefined]}

        this.toggleDetails = this.toggleDetails.bind(this)
        this.openComponent = this.openComponent.bind(this)
        this.openCandidateInJupyter = this.openCandidateInJupyter.bind(this)
        this.onRowClick = this.onRowClick.bind(this)
        this.onCheckBoxClick = this.onCheckBoxClick.bind(this)
        this.onHide = this.onHide.bind(this)
    }

    componentDidUpdate(prevProps: Readonly<LeaderboardRowProps>, prevState: Readonly<LeaderboardRowState>, snapshot?: any) {
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

    private openComponent(step: PipelineStep) {
        if (this.state.open &&
            (this.state.selectedComponent[0] === step.id || this.state.selectedComponent[0] === step.step_name)) {
            // Close details when selecting the same step again
            this.setState({open: false, selectedComponent: [undefined, undefined]})
        } else {
            // quick and dirty fix for dswizard to select pipeline steps.
            // TODO clean-up the pipeline id, step_name, label mess
            if (this.props.meta.framework === 'dswizard')
                this.setState({open: true, selectedComponent: [step.id, step.label]})
            else
                this.setState({open: true, selectedComponent: [step.step_name, step.label]})
        }
    }

    private openCandidateInJupyter(e: React.MouseEvent) {
        this.context.createCell(`
${ID}_X, ${ID}_y, ${ID}_pipeline = gcx().pipeline('${this.props.candidate.candidate[1].id}')
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

    private onHide() {
        this.props.onRowHide(this.props.candidate.id)
    }

    render() {
        const {candidate, meta, selected, structures, explanations, onComparisonRequest} = this.props
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
                    <TableCell scope='row' padding='none'>{candidate.id}</TableCell>
                    <TableCell align='right'>{prettyPrint(candidate.performance, 4)}</TableCell>
                    <TableCell align='right'>{prettyPrint(candidate.pred_time, 3)}</TableCell>
                    <TableCell align='right' style={{height: '50px'}} padding='none'>
                        <PipelineVisualizationComponent structure={candidate.candidate[0].pipeline}
                                                        candidate={candidate.candidate[1]}
                                                        selectedComponent={selectedComponent[0]}
                                                        onComponentSelection={this.openComponent}/>
                    </TableCell>
                    <TableCell>
                        <JupyterButton onClick={this.openCandidateInJupyter}/>
                        <IconButton aria-label='expand row' size='small' onClick={this.toggleDetails}>
                            {this.state.open ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                        </IconButton>
                        {/*<BasicMenu onHide={this.onHide}/>*/}
                    </TableCell>
                </TableRow>
                <TableRow>
                    <TableCell style={{padding: 0}} colSpan={6}>
                        <Collapse in={this.state.open} timeout='auto' unmountOnExit={false} mountOnEnter={true}>
                            <Box margin={1} style={{marginBottom: '5em'}}>
                                <CandidateInspections
                                    structure={candidate.candidate[0]}
                                    candidate={candidate.candidate[1]}
                                    componentId={selectedComponent[0]}
                                    componentLabel={selectedComponent[1]}
                                    meta={meta}
                                    explanations={explanations}
                                    onComparisonRequest={onComparisonRequest}
                                    structures={structures}/>
                            </Box>
                        </Collapse>
                    </TableCell>
                </TableRow>
            </>
        );
    }
}

interface BasicMenuProps {
    onHide: () => void
}

class BasicMenu extends React.Component<BasicMenuProps, { open: boolean }> {

    private readonly ref: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    constructor(props: BasicMenuProps) {
        super(props)
        this.state = {open: false}

        this.handleClick = this.handleClick.bind(this)
        this.handleClose = this.handleClose.bind(this)
        this.handleHide = this.handleHide.bind(this)
    }

    private handleClick(e: React.MouseEvent<HTMLButtonElement>) {
        this.setState((state) => ({open: !state.open}))
        e.stopPropagation()
    }

    private handleClose(e: React.MouseEvent) {
        this.setState({open: false})
        e.stopPropagation()
    }

    private handleHide(e: React.MouseEvent) {
        this.props.onHide()
        this.handleClose(e)
    }

    render() {
        return (
            <div ref={this.ref} style={{display: 'inline'}}>
                <IconButton aria-label='expand row' size='small' onClick={this.handleClick}>
                    <MoreVert/>
                </IconButton>
                <Menu
                    anchorEl={this.ref?.current}
                    open={this.state.open}
                    onClose={this.handleClose}>
                    <MenuItem onClick={this.handleHide}>Hide</MenuItem>
                </Menu>
            </div>
        )
    }
}


interface LeaderboardProps {
    structures: Structure[];
    selectedCandidates: Set<CandidateId>;
    hiddenCandidates: Set<CandidateId>;
    hideUnselectedCandidates: boolean;
    showCandidate: CandidateId;
    meta: MetaInformation;
    explanations: Explanations;
    onCandidateSelection: (cid: Set<CandidateId>) => void;
    onCandidateHide: (cid: CandidateId) => void;
}

interface LeaderboardState {
    rows: SingleCandidate[],
    order: Order
    orderBy: keyof SingleCandidate
    page: number
    rowsPerPage: number

    selectedRow: number
    comparisonType: ComparisonType
}

export class Leaderboard extends React.Component<LeaderboardProps, LeaderboardState> {

    constructor(props: LeaderboardProps) {
        super(props);

        const order = this.props.meta.is_minimization ? 'asc' : 'desc'
        const orderBy = 'performance'

        this.state = {
            rows: this.calculateData(order, orderBy),
            order: order,
            orderBy: orderBy,
            page: 0,
            rowsPerPage: 10,
            selectedRow: undefined,
            comparisonType: undefined
        }

        this.handleRequestSort = this.handleRequestSort.bind(this)
        this.handleSelectAllClick = this.handleSelectAllClick.bind(this)
        this.handleRowClick = this.handleRowClick.bind(this)
        this.handleChangePage = this.handleChangePage.bind(this)
        this.handleChangeRowsPerPage = this.handleChangeRowsPerPage.bind(this)
        this.handleComparisonRequest = this.handleComparisonRequest.bind(this)
    }

    private handleComparisonRequest(type: ComparisonType, selectedRow: number) {
        this.setState({comparisonType: type, selectedRow: selectedRow})
    }

    private handleRequestSort(_: React.MouseEvent<unknown>, property: keyof SingleCandidate): void {
        const isAsc = this.state.orderBy === property && this.state.order === 'asc';
        const order = isAsc ? 'desc' : 'asc'
        this.setState({rows: this.calculateData(order, property), order: order, orderBy: property})
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

    componentDidUpdate(prevProps: Readonly<LeaderboardProps>, prevState: Readonly<LeaderboardState>, snapshot?: any) {
        if (prevProps.structures !== this.props.structures || prevProps.hideUnselectedCandidates !== this.props.hideUnselectedCandidates)
            this.setState({rows: this.calculateData(this.state.order, this.state.orderBy)})

        if (prevProps.showCandidate !== this.props.showCandidate && this.props.showCandidate !== undefined) {
            const idx = this.state.rows.map(c => c.id).indexOf(this.props.showCandidate)
            const page = Math.trunc(idx / this.state.rowsPerPage)
            this.setState({page: page})
        }
    }

    private calculateData(order: 'desc' | 'asc', orderBy: keyof SingleCandidate): SingleCandidate[] {
        const rows: SingleCandidate[] = []

        const comp = (a: SingleCandidate, b: SingleCandidate) => {
            const sign = order === 'desc' ? 1 : -1
            if (b[orderBy] < a[orderBy])
                return sign * -1;
            if (b[orderBy] > a[orderBy])
                return sign * 1;
            return 0;
        }

        this.props.structures.forEach(structure => {
            structure.configs
                .filter(c => c.filled)
                .filter(c => !this.props.hideUnselectedCandidates || this.props.selectedCandidates.has(c.id))
                .forEach(c => {
                    rows.push(
                        {
                            id: c.id,
                            pred_time: c.runtime.prediction_time,
                            performance: c.loss,
                            candidate: [structure, c]
                        }
                    )
                })
        })
        return rows.sort(comp)
    }

    render() {
        const {structures, explanations, hiddenCandidates} = this.props
        const {rows, order, orderBy, page, rowsPerPage} = this.state

        const headCells: HeaderCell[] = [
            {id: 'id', numeric: false, sortable: true, label: 'Id', width: '40px'},
            {id: 'performance', numeric: true, sortable: true, label: 'Performance', width: '100px'},
            {id: 'pred_time', numeric: true, sortable: true, label: 'Pred. Time', width: '60px'},
            {id: 'candidate', numeric: false, sortable: false, label: 'Pipeline', width: 'auto'}
        ];

        return (
            <div className={'comparison-anchor'}>
                <TableContainer>
                    <Table style={{tableLayout: 'fixed'}}
                           size="small"
                           onMouseDown={(e => {
                               // Prevent browser from highlighting clicked table cells.
                               // See https://stackoverflow.com/questions/5067644/html-table-when-i-ctrlclick-the-border-of-the-cell-appears
                               if (e.ctrlKey)
                                   e.preventDefault()
                           })}>
                        <LeaderboardHeader
                            headCells={headCells}
                            numSelected={this.props.selectedCandidates.size}
                            order={order}
                            orderBy={orderBy}
                            onSelectAllClick={this.handleSelectAllClick}
                            onRequestSort={this.handleRequestSort}
                            rowCount={rows.length}/>
                        <TableBody>
                            {rows
                                .filter(s => !hiddenCandidates.has(s.id))
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map(row => {
                                    return (
                                        <LeaderboardRow key={row.id}
                                                        candidate={row}
                                                        meta={this.props.meta}
                                                        selected={this.props.selectedCandidates.has(row.id)}
                                                        onRowClick={this.handleRowClick}
                                                        onRowHide={this.props.onCandidateHide}
                                                        structures={structures}
                                                        explanations={explanations}
                                                        onComparisonRequest={this.handleComparisonRequest}
                                                        open={row.id === this.props.showCandidate}/>
                                    );
                                })}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[10, 20, 30]}
                    component='div'
                    count={rows.length - hiddenCandidates.size}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={this.handleChangePage}
                    onRowsPerPageChange={this.handleChangeRowsPerPage}
                />


                {this.state.comparisonType !== undefined &&
                    <Comparison meta={this.props.meta} type={this.state.comparisonType}
                                onClose={() => this.handleComparisonRequest(undefined, undefined)}
                                models={rows.filter(r => this.props.selectedCandidates.has(r.id))
                                    .map(r => new DetailsModel(r.candidate[0], r.candidate[1], Components.SOURCE, Components.SOURCE, this.state.selectedRow))}/>
                }
            </div>
        )
    }
}
