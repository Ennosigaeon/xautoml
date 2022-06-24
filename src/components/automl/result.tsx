import React from "react";
import {Button, Grid} from "@material-ui/core";


interface ResultProps {
    onReset: () => void
    onXAutoML: () => void
    onDeploy: () => void
}

interface ResultState {

}

export class Result extends React.Component<ResultProps, ResultState> {
    render() {
        return (
            <>
                <h2>Results</h2>
                <Grid container direction="row" alignContent={"center"} justifyContent={"space-evenly"} spacing={2}>
                    <Grid item>
                        <Button variant="contained" color="primary" onClick={this.props.onXAutoML}>Show In XAutoML</Button>
                    </Grid>
                    <Grid item>
                        <Button variant="contained" color="primary" onClick={this.props.onDeploy}>Deploy</Button>
                    </Grid>
                    <Grid item>
                        <Button variant="contained" color="secondary" onClick={this.props.onReset}>Reset</Button>
                    </Grid>
                </Grid>
            </>
        )
    }
}
