import React from "react";
import {CollapseComp} from "../../util/collapse";
import {
    Box,
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
} from "@material-ui/core";
import {KernelWrapper} from "../../jupyter";


export interface OptimizerConfiguration {
    timeout: number
    runtime: number
    optimizer: string
    metric: string
    config: string
}

interface ClassifierConfigProps {
    kernel: KernelWrapper
    isValid: (valid: boolean) => void
}

interface ClassifierConfigState {
    config: OptimizerConfiguration
}

export class ClassifierConfiguration extends React.Component<ClassifierConfigProps, ClassifierConfigState> {

    constructor(props: ClassifierConfigProps) {
        super(props);

        this.state = {
            config: {
                timeout: 10,
                runtime: 10,
                optimizer: "dswizard",
                metric: "accuracy",
                config: "{}"
            }
        }

        this.handleInputChange = this.handleInputChange.bind(this)
        this.validateConfig = this.validateConfig.bind(this)
    }

    private handleInputChange(e: React.ChangeEvent<{ name?: string; value: unknown }>) {
        const {name, value} = e.target;
        this.setState(state => {
            const config = {...state.config, [name]: value}
            this.setState({config: config})
        })
    }

    private validateConfig(e: React.ChangeEvent<{ name?: string; value: unknown }>) {
        this.props.kernel.executeCode<boolean[]>(`
from xautoml.gui import validate_configuration
validate_configuration('''${e.target.value}''')
        `).then(valid => this.props.isValid(valid[0]))
        this.handleInputChange(e)
    }

    render() {
        const {config} = this.state

        return (
            <>
                <Box sx={{flexGrow: 1}}>
                    <Grid container direction="column" alignContent={"center"} spacing={2} className={'no-margin'}>
                        <CollapseComp showInitial={false} help={
                            'Provide additional configuration to fine-tune the optimization procedure'}>
                            <h2>Optimizer Configuration</h2>

                            <Grid container direction="column" spacing={2}>
                                <Grid item>
                                    <FormControl>
                                        <FormLabel>Optimizer</FormLabel>
                                        <RadioGroup
                                            name="optimizer"
                                            value={config.optimizer}
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
                                            label={'seconds'}
                                            value={config.runtime}
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
                                            label={'seconds'}
                                            value={config.timeout}
                                            onChange={this.handleInputChange}
                                        />
                                    </FormControl>
                                </Grid>

                                <Grid item>
                                    <FormControl>
                                        <FormLabel>Cost Metric</FormLabel>
                                        <Select
                                            name="metric"
                                            value={config.metric}
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
                                            cols={40}
                                            minRows={5}
                                            value={config.config}
                                            onChange={this.validateConfig}
                                        />
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </CollapseComp>
                    </Grid>
                </Box>
            </>
        );
    }
}
