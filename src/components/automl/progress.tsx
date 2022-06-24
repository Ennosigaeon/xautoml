import React from "react";
import {Box, LinearProgress, Typography} from '@material-ui/core';
import {LinearProgressProps} from "@material-ui/core/LinearProgress/LinearProgress";


class LinearProgressWithLabel extends React.Component<LinearProgressProps, {}> {

    render() {

        return (
            <Box display="flex" alignItems="center">
                <Box width="100%" mr={1}>
                    <LinearProgress variant="determinate" {...this.props} />
                </Box>
                <Box minWidth={35}>
                    <Typography variant="body2" color="textSecondary">{`${Math.round(
                        this.props.value,
                    )}%`}</Typography>
                </Box>
            </Box>
        )
    }
}

interface ProgressBarProps {
    duration: number
}

interface ProgressBarState {
    current: number
}

export class ProgressBar extends React.Component<ProgressBarProps, ProgressBarState> {

    private timer: number = undefined

    constructor(props: ProgressBarProps) {
        super(props);
        this.state = {current: 0}
    }

    componentDidMount() {
        this.timer = setInterval(() => {
            this.setState({current: this.state.current + 1})
        }, 1000);
    }

    componentWillUnmount() {
        if (this.timer !== undefined)
            clearInterval(this.timer);
    }

    render() {
        return (
            <>
                <h2>Progress</h2>
                <LinearProgressWithLabel value={(this.state.current / this.props.duration) * 100}/>
            </>
        )
    }

}
