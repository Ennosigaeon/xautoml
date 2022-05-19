import React from "react";
import {Button, Grid} from "@material-ui/core";


interface ResultProps {

}

interface ResultState {

}

export class Result extends React.Component<ResultProps, ResultState> {
    render() {
        return (
            <>
                <h2>Results</h2>
                <p>The results are available in the file system</p>

                <Grid container direction="row" alignContent={"center"} justifyContent={"space-evenly"} spacing={2}>
                    <Grid item>
                        <Button variant="contained" color="primary">Show In XAutoML</Button>
                    </Grid>
                    <Grid item>
                        <Button variant="contained" color="primary">Deploy</Button>
                    </Grid>
                    <Grid item>
                        <Button variant="contained" color="secondary">Reset</Button>
                    </Grid>
                </Grid>
            </>
        )
    }
}
