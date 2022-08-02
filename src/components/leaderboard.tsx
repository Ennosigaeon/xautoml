import React from 'react';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TablePagination from '@material-ui/core/TablePagination';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import Checkbox from '@material-ui/core/Checkbox';
import {Button, IconButton, Menu, MenuItem, Table, TableContainer} from '@material-ui/core';
import {Candidate, CandidateId, Explanations, MetaInformation, Structure} from '../model';
import {Components, JupyterContext, prettyPrint} from '../util';
import {JupyterButton} from "../util/jupyter-button";
import {ID} from "../jupyter";
import {MoreVert} from "@material-ui/icons";
import {Comparison} from "./comparison";
import {ComparisonType, DetailsModel} from "./details/model";
import {IMimeBundle} from "@jupyterlab/nbformat";
import {GoDeploymentComponent} from "./usu_iap/deployment-dialog";
import {Overlay} from "../util/overlay";
import {CandidateInspections} from "./candidate_inspections";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";

interface SingleCandidate {
    id: CandidateId;
    pred_time: number;
    performance: number;
    classifier: string;
    length: number;
    candidate: Candidate;
    structure: Structure
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
                    <TableCell style={{width: '270px'}}/>
                </TableRow>
            </TableHead>
        )
    }
}


interface LeaderboardRowProps {
    candidate: SingleCandidate
    selected: boolean
    onRowClick: (candidate: SingleCandidate, select: boolean) => void
    onRowHide: (id: CandidateId) => void

    open: boolean
    iapEnabled: boolean
}

class LeaderboardRow extends React.Component<LeaderboardRowProps> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: LeaderboardRowProps) {
        super(props);

        this.openCandidateInJupyter = this.openCandidateInJupyter.bind(this)
        this.onRowClick = this.onRowClick.bind(this)
        this.onCheckBoxClick = this.onCheckBoxClick.bind(this)
        this.onHide = this.onHide.bind(this)
        this.onDeploy = this.onDeploy.bind(this)
    }

    private openCandidateInJupyter(e: React.MouseEvent) {
        this.context.createCell(`
${ID}_X, ${ID}_y, ${ID}_pipeline = gcx().pipeline('${this.props.candidate.id}')
${ID}_pipeline
        `.trim())
        e.stopPropagation()
    }

    private onRowClick(e: React.MouseEvent) {
        this.props.onRowClick(this.props.candidate, e.ctrlKey)
    }

    private onCheckBoxClick(e: React.MouseEvent) {
        this.props.onRowClick(this.props.candidate, true)
        e.stopPropagation()
    }

    private onHide() {
        this.props.onRowHide(this.props.candidate.id)
    }

    private onDeploy(e: React.MouseEvent) {
        this.context.executeCode<IMimeBundle>(`
from xautoml.gui import export
export('${this.props.candidate.id}')
        `)
        new GoDeploymentComponent('', this.context.fileBrowserFactory.createFileBrowser('usu_iap')).open()

        e.stopPropagation()
    }

    render() {
        const {candidate, selected, iapEnabled} = this.props

        return (
            <>
                <TableRow hover
                          onClick={this.onRowClick}
                          role='checkbox'
                          tabIndex={-1}
                          style={{cursor: 'pointer'}}
                          className={this.props.open ? 'LeaderboardRow-open' : ''}
                          selected={selected}>
                    <TableCell padding='checkbox'>
                        <Checkbox checked={selected}
                                  color='primary'
                                  onClick={this.onCheckBoxClick}/>
                    </TableCell>
                    <TableCell scope='row' padding='none'>{candidate.id}</TableCell>
                    <TableCell align='right'>{prettyPrint(candidate.performance, 4)}</TableCell>
                    <TableCell align='right'>{prettyPrint(candidate.pred_time, 3)}</TableCell>
                    <TableCell align='right'>{candidate.length}</TableCell>
                    <TableCell align='center'>
                        <div className={'structure-graph_node'} style={{maxWidth: '200px', margin: 'auto'}}>
                            <div className={'hierarchical-tree_node-content'}>
                                <p>{candidate.classifier}</p>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <JupyterButton onClick={this.openCandidateInJupyter} active={this.context.canCreateCell()}/>
                        {iapEnabled && <Button onClick={this.onDeploy} style={{margin: '0 10px'}}>Deploy</Button>}
                        <IconButton aria-label='expand row' size='small'>
                            <KeyboardArrowDownIcon/>
                        </IconButton>
                        {/*<BasicMenu onHide={this.onHide}/>*/}
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
    iapEnabled: boolean;
}

interface LeaderboardState {
    rows: SingleCandidate[],
    order: Order
    orderBy: keyof SingleCandidate
    page: number
    rowsPerPage: number

    selectedRow: number
    selectedCandidate: SingleCandidate
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
            selectedCandidate: undefined,
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

    private handleRowClick(candidate: SingleCandidate, select: boolean): void {
        const id = candidate.id
        if (select) {
            const selected = new Set(this.props.selectedCandidates)
            if (selected.has(id)) {
                selected.delete(id)
            } else {
                selected.add(id)
            }

            this.props.onCandidateSelection(selected)
        } else {
            if (this.state.selectedCandidate?.id === id)
                this.setState({selectedCandidate: undefined})
            else {
                this.setState({selectedCandidate: candidate})
            }

        }
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
            this.setState({page: page, selectedCandidate: this.state.rows.find(r => r.id === this.props.showCandidate)})
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
                            candidate: c,
                            structure: structure,
                            classifier: structure.pipeline[structure.pipeline.length - 1].label,
                            length: structure.pipeline.length
                        }
                    )
                })
        })
        return rows.sort(comp)
    }

    render() {
        const {structures, explanations, hiddenCandidates, iapEnabled} = this.props
        const {rows, order, orderBy, page, rowsPerPage} = this.state

        const headCells: HeaderCell[] = [
            {id: 'id', numeric: false, sortable: true, label: 'Id', width: '60px'},
            {id: 'performance', numeric: true, sortable: true, label: 'Performance', width: '100px'},
            {id: 'pred_time', numeric: true, sortable: true, label: 'Pred. Time', width: '120px'},
            {id: 'length', numeric: true, sortable: true, label: 'Pipeline Length', width: '150px'},
            {id: 'classifier', numeric: false, sortable: true, label: 'Classifier', width: 'auto'},
        ];

        return (
            <div className={'overlay-anchor'}>
                <TableContainer style={{gridRowStart: 1, gridColumnStart: 1}}>
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
                                                        selected={this.props.selectedCandidates.has(row.id)}
                                                        onRowClick={this.handleRowClick}
                                                        onRowHide={this.props.onCandidateHide}
                                                        iapEnabled={iapEnabled}
                                                        open={row.id === this.state.selectedCandidate?.id}/>
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

                {this.state.selectedCandidate !== undefined &&
                    <Overlay title={this.state.selectedCandidate.id} onClose={() => {
                        this.setState({selectedCandidate: undefined})
                    }}>
                        <CandidateInspections
                            key={this.state.selectedCandidate.id}
                            structure={this.state.selectedCandidate.structure}
                            candidate={this.state.selectedCandidate.candidate}
                            meta={this.props.meta}
                            explanations={explanations}
                            onComparisonRequest={this.handleComparisonRequest}
                            structures={structures}/>
                    </Overlay>
                }
                {this.state.comparisonType !== undefined &&
                    <Overlay title={'Comparison'} onClose={() => this.handleComparisonRequest(undefined, undefined)}>
                        <Comparison meta={this.props.meta} type={this.state.comparisonType}
                                    models={rows.filter(r => this.props.selectedCandidates.has(r.id))
                                        .map(r => new DetailsModel(r.structure, r.candidate, Components.SOURCE, Components.SOURCE, this.state.selectedRow))}/>
                    </Overlay>
                }
            </div>
        )
    }
}
