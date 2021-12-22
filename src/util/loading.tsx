import React from "react";

interface LoadingIndicatorProps {
    loading: boolean
}

export class LoadingIndicator extends React.Component<LoadingIndicatorProps, {}> {
    render() {
        return (
            <>
                {this.props.loading && <div className={'jp-SpinnerContent'}/>}
            </>
        )
    }
}
