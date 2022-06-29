import React from "react";
import {Grid} from "@material-ui/core";


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
                        <button
                            className="jp-Dialog-button jp-mod-accept jp-mod-styled"
                            onClick={this.props.onXAutoML}
                        >
                            Show In XAutoML
                        </button>
                    </Grid>
                    <Grid item>
                        <button
                            className="jp-Dialog-button jp-mod-accept jp-mod-styled"
                            onClick={this.props.onDeploy}
                        >
                            Deploy
                        </button>
                    </Grid>
                    <Grid item>
                        <button
                            className="jp-Dialog-button jp-mod-reject jp-mod-styled"
                            onClick={this.props.onReset}
                        >
                            Reset
                        </button>
                    </Grid>
                </Grid>
            </>
        )
    }
}
