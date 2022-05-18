import {ReactWidget} from '@jupyterlab/apputils';
import {
    Box,
    Button,
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    TextareaAutosize,
    TextField
} from '@material-ui/core';

import React from 'react';
import {TwoColumnLayout} from "./util/layout";
import {IFileBrowserFactory, FileDialog} from "@jupyterlab/filebrowser";

interface FormValues {
    timeout: number
    runtime: number
    optimizer: string
    metric: string
    config: string
    inputFile: string
    target: string
}

interface ClassificationRootState {
    formValues: FormValues
}

interface ClassificationRootProps {
    fileBrowserFactory: IFileBrowserFactory
}

class ClassificationRoot extends React.Component<ClassificationRootProps, ClassificationRootState> {

    constructor(props: ClassificationRootProps) {
        super(props);
        this.state = {
            formValues: {
                timeout: 10,
                runtime: 30,
                optimizer: "dswizard",
                metric: "accuracy",
                config: "{}",
                inputFile: "",
                target: "..."
            }
        }

        this.handleInputChange = this.handleInputChange.bind(this)
        this.handleSliderChange = this.handleSliderChange.bind(this)
        this.selectFile = this.selectFile.bind(this)
    }

    private handleInputChange(e: React.ChangeEvent<{ name?: string; value: unknown }>) {
        const {name, value} = e.target;
        this.setState(state => this.setState(
            {formValues: {...state.formValues, [name]: value}}
        ))
    }

    private handleSliderChange(name: string) {
        return (e: React.ChangeEvent<{}>, value: number | number[]) => {
            this.setState(state => this.setState(
                {formValues: {...state.formValues, [name]: value}}
            ))
        }
    }

    private async selectFile() {
        const fileBrowser = this.props.fileBrowserFactory.createFileBrowser('dswizard-classification');
        const fileDialog = FileDialog.getOpenFiles({
            manager: fileBrowser.model.manager,
            filter: value => {
                return value.mimetype === 'text/csv'
            },
            title: 'Select'
        });

        const result = await fileDialog;
        if (result.button.accept) {
            const additionalFiles: string[] = result.value.map(el => el.path);
            this.setState({formValues: {...this.state.formValues, ['inputFile']: additionalFiles[0]}})
        }
    }

    render() {
        const {formValues} = this.state;
        return (
            <div>
                <TwoColumnLayout>
                    <div className={'lm-Widget p-Widget '}>
                        <form>
                            <Box sx={{flexGrow: 1}}>
                                <Grid container direction="column" alignContent={"center"} spacing={2}>
                                    <Grid item>
                                        <h1>AutoML Classification</h1>
                                    </Grid>

                                    <hr style={{minWidth: '80%'}}/>
                                    <Grid item>
                                        <h2>Data Set</h2>
                                    </Grid>
                                    <Grid item>
                                        <FormControl>
                                            <FormLabel>Data Set</FormLabel>

                                            <Grid container direction="row" justifyContent={"space-between"}
                                                  alignContent={"center"}
                                                  spacing={2}>
                                                <Grid item xs={6}>
                                                    <TextField
                                                        id="input-file"
                                                        name="inputFile"
                                                        type="text"
                                                        value={formValues.inputFile}
                                                        onChange={this.handleInputChange}
                                                    />
                                                </Grid>

                                                <Grid item xs={6}>
                                                    <Button variant="contained" color="primary"
                                                            onClick={this.selectFile}>
                                                        Select
                                                    </Button>
                                                </Grid>
                                            </Grid>
                                        </FormControl>
                                    </Grid>

                                    <Grid item>
                                        <FormControl>
                                            <FormLabel>Target Column</FormLabel>
                                            <Select
                                                name="target"
                                                value={formValues.target}
                                                onChange={this.handleInputChange}
                                            >
                                                <MenuItem key="..." value="...">...</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <hr style={{minWidth: '80%'}}/>
                                    <Grid item>
                                        <h2>Optimizer Configuration</h2>
                                    </Grid>
                                    <Grid item>
                                        <FormControl>
                                            <FormLabel>Optimizer</FormLabel>
                                            <RadioGroup
                                                name="optimizer"
                                                value={formValues.optimizer}
                                                onChange={this.handleInputChange}
                                                row
                                            >
                                                <FormControlLabel
                                                    key="dswizard"
                                                    value="dswizard"
                                                    control={<Radio size="small"/>}
                                                    label="dswizard"
                                                />
                                                <FormControlLabel
                                                    key="auto-sklearn"
                                                    value="auto-sklearn"
                                                    control={<Radio size="small"/>}
                                                    label="auto-sklearn"
                                                />
                                                <FormControlLabel
                                                    key="tpot"
                                                    value="tpot"
                                                    control={<Radio size="small"/>}
                                                    label="tpot"
                                                />
                                            </RadioGroup>
                                        </FormControl>
                                    </Grid>

                                    <Grid item>
                                        <FormControl>
                                            <FormLabel>Optimization Duration</FormLabel>
                                            <TextField
                                                id="runtime"
                                                name="runtime"
                                                type="number"
                                                value={formValues.runtime}
                                                onChange={this.handleInputChange}
                                            />
                                        </FormControl>
                                    </Grid>

                                    <Grid item>
                                        <FormControl>
                                            <FormLabel>Evaluation Timeout</FormLabel>
                                            <TextField
                                                id="timeout"
                                                name="timeout"
                                                type="number"
                                                value={formValues.timeout}
                                                onChange={this.handleInputChange}
                                            />
                                        </FormControl>
                                    </Grid>

                                    <Grid item>
                                        <FormControl>
                                            <FormLabel>Cost Metric</FormLabel>
                                            <Select
                                                name="metric"
                                                value={formValues.metric}
                                                onChange={this.handleInputChange}
                                            >
                                                <MenuItem key="accuracy" value="accuracy">Accuracy</MenuItem>
                                                <MenuItem key="roc_auc" value="roc_auc">ROC AUC</MenuItem>
                                                <MenuItem key="f1 " value="f1">f1</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid item>
                                        <FormControl>
                                            <FormLabel>Additional Configuration</FormLabel>
                                            <TextareaAutosize
                                                name="config"
                                                minLength={40}
                                                minRows={5}
                                                value={formValues.config}
                                                onChange={this.handleInputChange}
                                            />
                                        </FormControl>
                                    </Grid>
                                    <Grid item>
                                        <Button variant="contained" color="primary" type="submit">
                                            Submit
                                        </Button>
                                    </Grid>
                                </Grid>
                            </Box>
                        </form>
                    </div>

                </TwoColumnLayout>
            </div>
        );
    }
}

export class ClassificationWidget extends ReactWidget {
    /**
     * Constructs a new CounterWidget.
     */
    constructor(private readonly fileBrowserFactory: IFileBrowserFactory) {
        super();
    }

    render(): JSX.Element {
        return <ClassificationRoot fileBrowserFactory={this.fileBrowserFactory}/>;
    }
}


class TimeSeriesRoot extends React.Component<{}> {
    render() {
        return (
            <div>
                <p>Timeseries forecasting not implemented yet. Check
                    <a href={'https://github.com/Ennosigaeon/auto-sktime'} target={'_blank'}>auto-sktime</a>
                    for latest updates.
                </p>
            </div>
        );
    }
}

export class TimeSeriesWidget extends ReactWidget {
    /**
     * Constructs a new CounterWidget.
     */
    constructor() {
        super();
    }

    render(): JSX.Element {
        return <TimeSeriesRoot/>;
    }
}
