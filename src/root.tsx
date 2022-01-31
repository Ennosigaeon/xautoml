import React from "react";
import {ReactWidget} from "@jupyterlab/apputils";
import {IRenderMime} from "@jupyterlab/rendermime-interfaces";
import {CandidateId, RunHistory} from "./model";
import {Colors, JupyterContext} from "./util";
import {Leaderboard} from "./components/leaderboard";
import {Jupyter} from "./jupyter";
import {LoadingIndicator} from "./util/loading";
import {Box, Button, Tab, Tabs} from "@material-ui/core";
import {TabContext} from "@material-ui/lab";
import {TabPanel} from "./util/tabpanel";
import {SearchSpace} from "./components/search_space";
import {GeneralInformation} from "./components/optimization_overview";
import {Ensemble} from "./components/ensemble";


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
    private runHistory: RunHistory = undefined;

    constructor(options: IRenderMime.IRendererOptions, jupyter: Jupyter) {
        super();
        this._mimeType = options.mimeType;
        this.jupyter = jupyter

        this.addClass(CLASS_NAME);
    }

    renderModel(model: IRenderMime.IMimeModel): Promise<void> {
        try {
            this.runHistory = RunHistory.fromJson(model.data[this._mimeType] as unknown as RunHistory);
        } catch (e) {
            console.error('Failed to parse runHistory', e)
        }

        // Trigger call of render().
        this.onUpdateRequest(undefined);
        return this.renderPromise;
    }

    protected render() {
        if (!this.runHistory)
            return <p>Error loading data...</p>
        return <ReactRoot runHistory={this.runHistory} jupyter={this.jupyter}/>
    }
}

interface ReactRootProps {
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
            hideUnselected: false
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

    render() {
        const {runHistory, jupyter} = this.props
        const {selectedCandidates, showCandidate, mounted, openTab, hideUnselected} = this.state

        class DivInTabs extends React.Component<any> {
            render() {
                let {children, style} = this.props;
                return <div style={style} className={'MuiButtonBase-root MuiTab-root MuiTab-textColorInherit'}
                            onClick={e => e.stopPropagation()} children={children}/>;
            }
        }

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
                                    {/*<DivInTabs>*/}
                                    {/*    <label className={'MuiFormControlLabel-root'}>*/}
                                    {/*        <Checkbox checked={hideUnselected}*/}
                                    {/*                  onChange={this.toggleHideUnselected}/>*/}
                                    {/*        <span>Hide&nbsp;Unselected</span>*/}
                                    {/*    </label>*/}
                                    {/*</DivInTabs>*/}
                                    {/*<DivInTabs>*/}
                                    {/*    <Button onClick={this.resetHidden}>Clear Hidden</Button>*/}
                                    {/*</DivInTabs>*/}
                                </Tabs>
                            </Box>

                            <TabPanel value={'1'}>
                                <Leaderboard structures={runHistory.structures}
                                             selectedCandidates={selectedCandidates}
                                             hiddenCandidates={this.state.hiddenCandidates}
                                             hideUnselectedCandidates={hideUnselected}
                                             meta={runHistory.meta}
                                             explanations={runHistory.explanations}
                                             showCandidate={showCandidate}
                                             onCandidateSelection={this.onCandidateSelection}
                                             onCandidateHide={this.onCandidateHide}/>
                            </TabPanel>
                            <TabPanel value={'2'}>
                                <SearchSpace structures={runHistory.structures}
                                             meta={runHistory.meta}
                                             explanations={runHistory.explanations}
                                             selectedCandidates={selectedCandidates}
                                             hideUnselectedCandidates={hideUnselected}
                                             onCandidateSelection={this.onCandidateSelection}/>
                            </TabPanel>
                            <TabPanel value={'3'}>
                                <Ensemble onCandidateSelection={this.onCandidateSelection} meta={runHistory.meta}/>
                            </TabPanel>
                        </TabContext>
                    </div>
                </div>
            </JupyterContext.Provider>
        )
    }

}
