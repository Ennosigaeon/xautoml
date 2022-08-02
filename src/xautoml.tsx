import React from "react";
import {ReactWidget} from "@jupyterlab/apputils";
import {IRenderMime} from "@jupyterlab/rendermime-interfaces";
import {CandidateId, Entrypoint, OptimizationData, RunHistory} from "./model";
import {Colors, JupyterContext} from "./util";
import {Leaderboard} from "./components/leaderboard";
import {Jupyter} from "./jupyter";
import {LoadingIndicator} from "./util/loading";
import {Box, Button, Tab, Tabs} from "@material-ui/core";
import {TabContext} from "@material-ui/lab";
import {DivInTabs, TabPanel} from "./util/tabpanel";
import {SearchSpace} from "./components/search_space";
import {GeneralInformation} from "./components/optimization_overview";
import {Ensemble} from "./components/ensemble";
import {IAPService} from "./components/usu_iap/service";
import {CandidateInspections} from "./components/candidate_inspections";


/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'mimerenderer-xautoml';

/**
 * A widget for rendering application/xautoml.
 */
export class JupyterWidget extends ReactWidget implements IRenderMime.IRenderer {
    private readonly _mimeType: string;
    private readonly jupyter: Jupyter;
    private data: OptimizationData = undefined;

    constructor(mimeType: string, jupyter: Jupyter) {
        super();
        this._mimeType = mimeType;
        this.jupyter = jupyter

        this.addClass(CLASS_NAME);
    }

    renderModel(model: IRenderMime.IMimeModel): Promise<void> {
        try {
            this.data = OptimizationData.fromJson(model.data[this._mimeType] as unknown as OptimizationData);
        } catch (e) {
            console.error('Failed to parse runHistory', e)
        }

        // Trigger call of render().
        this.onUpdateRequest(undefined);
        return this.renderPromise;
    }

    protected render() {
        if (!this.data)
            return <p>Error loading data...</p>
        return <ReactRoot runHistory={this.data.runhistory} entrypoint={this.data.entrypoint}
                          kwargs={this.data.kwargs} jupyter={this.jupyter}/>
    }
}

interface ReactRootProps {
    entrypoint: Entrypoint;
    kwargs: Map<string, any>;
    runHistory: RunHistory;
    jupyter: Jupyter;
}

interface ReactRootState {
    selectedCandidates: Set<CandidateId>
    hiddenCandidates: Set<CandidateId>
    showCandidate: CandidateId
    openTab: string
    mounted: boolean
    hideUnselected: boolean
    iapEnabled: boolean
}

export default class ReactRoot extends React.Component<ReactRootProps, ReactRootState> {

    private readonly container: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    constructor(props: ReactRootProps) {
        super(props);
        this.state = {
            selectedCandidates: new Set<CandidateId>(),
            hiddenCandidates: new Set<CandidateId>(),
            mounted: false,
            openTab: '1',
            showCandidate: undefined,
            hideUnselected: false,
            iapEnabled: false
        }

        this.onCandidateSelection = this.onCandidateSelection.bind(this)
        this.onCandidateHide = this.onCandidateHide.bind(this)
        this.resetHidden = this.resetHidden.bind(this)
        this.switchTab = this.switchTab.bind(this)
        this.toggleHideUnselected = this.toggleHideUnselected.bind(this)
    }

    private onCandidateSelection(cids: Set<CandidateId>, show: boolean = false) {
        if (show && cids.size === 1) {
            const cid = cids.values().next().value
            this.setState({showCandidate: cid, openTab: '1'})
        } else {
            this.setState({selectedCandidates: cids})
        }
    }

    private onCandidateHide(cid: CandidateId) {
        this.state.hiddenCandidates.add(cid)
        this.setState({hiddenCandidates: this.state.hiddenCandidates})
    }

    private resetHidden() {
        this.state.hiddenCandidates.clear()
        this.setState({hiddenCandidates: this.state.hiddenCandidates})
    }

    componentDidMount() {
        if (this.container.current.clientWidth > 0)
            this.setState({mounted: true})
        else
            // Jupyter renders all components before output containers are rendered.
            // Delay rendering to get the container width.
            window.setTimeout(() => this.setState({mounted: true}), 100)

        IAPService.enabled().then(enabled => this.setState({iapEnabled: enabled}))
            .catch(_ => this.setState({iapEnabled: false}))
    }

    componentWillUnmount() {
        this.props.jupyter.unmount()
    }

    private switchTab(_: any, selectedTab: string) {
        this.setState({openTab: selectedTab})
    }

    private toggleHideUnselected(_: React.ChangeEvent, checked: boolean) {
        this.setState({hideUnselected: checked})
    }

    private renderLeaderBoard() {
        const {runHistory} = this.props
        const {selectedCandidates, showCandidate, iapEnabled, hideUnselected} = this.state

        return (
            <Leaderboard structures={runHistory.structures}
                         selectedCandidates={selectedCandidates}
                         hiddenCandidates={this.state.hiddenCandidates}
                         hideUnselectedCandidates={hideUnselected}
                         meta={runHistory.meta}
                         explanations={runHistory.explanations}
                         showCandidate={showCandidate}
                         iapEnabled={iapEnabled}
                         onCandidateSelection={this.onCandidateSelection}
                         onCandidateHide={this.onCandidateHide}/>
        )
    }

    private renderSearchSpace() {
        const {runHistory} = this.props
        const {selectedCandidates, hideUnselected} = this.state

        return (
            <SearchSpace structures={runHistory.structures}
                         meta={runHistory.meta}
                         explanations={runHistory.explanations}
                         selectedCandidates={selectedCandidates}
                         hideUnselectedCandidates={hideUnselected}
                         onCandidateSelection={this.onCandidateSelection}/>
        )
    }

    private renderEnsemble() {
        return (
            <Ensemble onCandidateSelection={this.onCandidateSelection} meta={this.props.runHistory.meta}/>
        )
    }

    private renderRoot() {
        const {runHistory} = this.props
        const {selectedCandidates, openTab} = this.state

        return (
            <div style={{display: 'flex'}}>
                <div style={{flexGrow: 0, flexShrink: 0, flexBasis: '275px', marginRight: '20px'}}>
                    <GeneralInformation structures={runHistory.structures}
                                        meta={runHistory.meta}
                                        selectedCandidates={selectedCandidates}
                                        onCandidateSelection={this.onCandidateSelection}/>
                </div>
                <div style={{flexGrow: 2}}>
                    <TabContext value={openTab}>
                        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                            <Tabs value={openTab} onChange={this.switchTab} TabIndicatorProps={{
                                style: {backgroundColor: Colors.HIGHLIGHT}
                            }}>
                                <Tab label="Candidates" value={'1'}/>
                                <Tab label="Search Space" value={'2'}/>
                                <Tab label="Ensembles" value={'3'}/>

                                <DivInTabs style={{marginLeft: 'auto', cursor: 'default'}}>
                                        <span className={'MuiTab-wrapper'}>
                                            Selected Candidates: {selectedCandidates.size} / {runHistory.meta.n_configs - this.state.hiddenCandidates.size}
                                        </span>
                                </DivInTabs>
                                <DivInTabs>
                                    <Button onClick={() => this.onCandidateSelection(new Set())}>
                                        Clear Selected
                                    </Button>
                                </DivInTabs>
                            </Tabs>
                        </Box>

                        <TabPanel value={'1'}>{this.renderLeaderBoard()}</TabPanel>
                        <TabPanel value={'2'}>{this.renderSearchSpace()}</TabPanel>
                        <TabPanel value={'3'}>{this.renderEnsemble()}</TabPanel>
                    </TabContext>
                </div>
            </div>
        )
    }

    private renderCandidate(renderDomain: boolean, renderML: boolean) {
        const {runHistory} = this.props
        const {iapEnabled} = this.state

        const candidate = runHistory.candidateMap.get(this.props.kwargs.get('cid'))
        const include = this.props.kwargs.get('include') as string[]
        const structure = runHistory.structures.find(s => s.configs.find(c => c.id === candidate.id) !== undefined)

        return (
            <CandidateInspections candidate={candidate} structure={structure} meta={runHistory.meta}
                                  structures={runHistory.structures}
                                  explanations={runHistory.explanations} iapEnabled={iapEnabled}
                                  renderDomain={renderDomain} renderML={renderML} include={include}
                                  onComparisonRequest={(_) => {
                                  }}/>
        )
    }

    render() {
        const {runHistory, entrypoint, jupyter} = this.props
        const {mounted} = this.state

        if (!mounted) {
            // Render loading indicator while waiting for delayed re-rendering with mounted container
            return (
                <div ref={this.container} style={{width: '100%'}}>
                    <LoadingIndicator loading={true}/>
                </div>
            )
        }

        if (!runHistory) {
            return <p>Error loading data...</p>
        }
        return (
            <JupyterContext.Provider value={jupyter}>
                {entrypoint === 'root' && this.renderRoot()}
                {entrypoint === 'search_space' && this.renderSearchSpace()}
                {entrypoint === 'ensemble' && this.renderEnsemble()}
                {entrypoint === 'leaderboard' && this.renderLeaderBoard()}
                {entrypoint === 'candidate' && this.renderCandidate(true, true)}
                {entrypoint === 'domain' && this.renderCandidate(true, false)}
                {entrypoint === 'ml' && this.renderCandidate(false, true)}
            </JupyterContext.Provider>
        )
    }

}
