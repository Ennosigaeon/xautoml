import React from "react";
import {Alert, AlertTitle} from "@material-ui/lab";


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
                    <AlertTitle>{error.name}</AlertTitle>
                    {error.message}
                </Alert>
                }
            </>
        );
    }
}
