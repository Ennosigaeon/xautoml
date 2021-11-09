import React from "react";
import {Alert, AlertTitle} from "@material-ui/lab";


interface WarningIndicatorProps {
    title: string
    message: string
}

export class WarningIndicator extends React.PureComponent<WarningIndicatorProps, {}> {

    render() {
        const {title, message} = this.props

        return (
            <>
                {title &&
                <Alert severity="warning">
                    <AlertTitle>{title}</AlertTitle>
                    {message}
                </Alert>
                }
            </>
        );
    }
}

export class AdditionalFeatureWarning extends React.PureComponent {

    render() {
        return <WarningIndicator
            title={'Additional Features'}
            message={'You have selected a component inside either a FeatureUnion or ColumnTransformer. ' +
            'In order to still have a functional pipeline, the output of the corresponding sibling components has to be passed to all subsequent components. ' +
            'This may affect the displayed results.'}/>
    }
}
