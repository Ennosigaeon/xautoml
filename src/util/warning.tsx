import React from "react";
import {Alert, AlertTitle} from "@material-ui/lab";


interface WarningIndicatorProps {
    title?: string
    message: string
}

export class WarningIndicator extends React.PureComponent<WarningIndicatorProps> {

    static defaultProps = {
        title: ''
    }

    render() {
        const {title, message} = this.props

        return (
            <Alert severity="warning" style={{margin: '5px'}}>
                {title && <AlertTitle>{title}</AlertTitle>}
                {message}
            </Alert>
        )
    }
}

interface CommonWarningsProps {
    additionalFeatures: boolean
    downsampled: boolean
}

export class CommonWarnings extends React.PureComponent<CommonWarningsProps> {

    render() {
        const {additionalFeatures, downsampled} = this.props

        const warnings = []

        if (additionalFeatures)
            warnings.push('You have selected a component inside either a FeatureUnion or ColumnTransformer. ' +
                'In order to still have a functional pipeline, the output of the corresponding sibling components has to be passed to all subsequent components. ' +
                'Additional features are displayed in lighter colors.')
        if (downsampled)
            warnings.push('To increase the performance, the data set has been downsampled to 5000 samples.')

        return (
            <>
                {warnings.length > 0 && <WarningIndicator message={'\n'.concat(...warnings)}/>}
            </>
        )

    }
}
