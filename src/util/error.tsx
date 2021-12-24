import React from "react";
import {Alert} from "@material-ui/lab";
import {ServerError} from "../jupyter";


interface ErrorIndicatorProps {
    error: Error
}

export class ErrorIndicator extends React.PureComponent<ErrorIndicatorProps, {}> {

    render() {
        const {error} = this.props

        return (
            <>
                {error &&
                    <Alert severity="error">
                        <strong>{error.name}</strong>
                        <p dangerouslySetInnerHTML={{__html: error.message}}/>
                        {error instanceof ServerError &&
                            <details>
                                <summary>Stacktrace</summary>
                                <pre>{error.traceback}</pre>
                            </details>
                        }
                    </Alert>
                }
            </>
        );
    }
}
