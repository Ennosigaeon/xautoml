import {Box, Button, FormControl, FormLabel, Grid, MenuItem, Select, TextField} from "@material-ui/core";
import React from "react";
import {FileDialog, IFileBrowserFactory} from "@jupyterlab/filebrowser";
import {KernelWrapper} from "../../jupyter";
import {DataSetTable} from "../details/dataset_table";
import {IDocumentManager} from "@jupyterlab/docmanager";

export interface DataSetValues {
    inputFile: string
    target: string
}

interface DataSetProps {
    fileBrowserFactory: IFileBrowserFactory
    documentManager: IDocumentManager
    kernel: KernelWrapper
    isValid: (valid: boolean) => void
}

interface DataSetState {
    config: DataSetValues
    target_columns: string[]
    formValid: boolean
    dfPreview: string
}

export class DataSetSelector extends React.Component<DataSetProps, DataSetState> {

    constructor(props: any) {
        super(props);

        this.state = {
            config: {
                inputFile: "",
                target: ""
            },
            target_columns: undefined,
            formValid: false,
            dfPreview: undefined
        }

        this.handleInputChange = this.handleInputChange.bind(this)
        this.selectFile = this.selectFile.bind(this)
        this.onShowDataSet = this.onShowDataSet.bind(this)
        this.loadPreview = this.loadPreview.bind(this)

    }

    private formValid(formValues: DataSetValues): boolean {
        const valid = formValues.inputFile !== "" && formValues.target !== ""
        this.props.isValid(valid)
        return valid
    }

    private handleInputChange(e: React.ChangeEvent<{ name?: string; value: unknown }>) {
        const {name, value} = e.target;
        this.setState(state => {
            const formValues = {...state.config, [name]: value}
            this.setState(
                {config: formValues, formValid: this.formValid(formValues)}
            )
        })
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
            const selectedFiles: string[] = result.value.map(el => el.path);
            const file = selectedFiles[0]

            const formValues = {...this.state.config, ['inputFile']: file}
            this.setState({
                config: formValues,
                formValid: this.formValid(formValues)
            })
            this.props.kernel.executeCode<string[]>(
                `
from xautoml.gui import get_columns
get_columns('${file}')
                `
            ).then(columns => this.setState({target_columns: columns}))

            this.loadPreview(file)
        }
    }

    private loadPreview(file: string) {
        this.props.kernel.executeCode<{ preview: string }>(
            `
from xautoml.gui import dataset_preview
dataset_preview('${file}')
                `
        ).then(response => {
            this.setState({dfPreview: response.preview})
        })
    }

    private onShowDataSet() {
        this.props.documentManager.openOrReveal(this.state.config.inputFile)
    }

    render() {
        const {config} = this.state

        return (
            <div className={'lm-Widget p-Widget '}>
                <Box sx={{flexGrow: 1}}>
                    <h2>Data Set</h2>
                    <Grid container direction="row" alignContent={"center"} justifyContent={"space-around"}>
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
                                            value={config.inputFile}
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

                        {this.state.target_columns !== undefined && <Grid item>
                            <FormControl>
                                <FormLabel>Target Column</FormLabel>
                                <Select
                                    name="target"
                                    value={config.target}
                                    onChange={this.handleInputChange}
                                >
                                    {this.state.target_columns.map(c => <MenuItem key={c}
                                                                                  value={c}>{c}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>}
                    </Grid>


                    {this.state.dfPreview &&
                        <>
                            <h2>Data Set Preview</h2>
                            <DataSetTable data={this.state.dfPreview} selectedSample={undefined}/>
                            <Button variant="contained" color="primary" onClick={this.onShowDataSet}>
                                Show Complete Data Set
                            </Button>
                        </>
                    }
                </Box>
            </div>
        )
    }
}
