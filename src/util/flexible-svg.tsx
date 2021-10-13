import React from "react";
import {LoadingIndicator} from "../components/loading";

interface FlexibleSvgProps {
    height: number
    onContainerChange?: (container: React.RefObject<any>) => void
}

interface FlexibleSvgState {
    width: number
}

export class FlexibleSvg extends React.Component<FlexibleSvgProps, FlexibleSvgState> {

    private readonly container: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    constructor(props: FlexibleSvgProps) {
        super(props);
        this.state = {width: 0}
    }

    componentDidMount() {
        const width = this.container.current.clientWidth
        this.setState({width: width})

        if (this.props.onContainerChange)
            this.props.onContainerChange(this.container)
    }

    render() {
        const {height, children} = this.props
        const {width} = this.state

        if (!width) {
            // Render loading indicator while waiting for delayed re-rendering with mounted container
            return (
                <div ref={this.container} style={{width: '100%'}}>
                    <LoadingIndicator loading={true}/>
                </div>
            )
        }

        return (
            <div className={'flexible-svg-container'} ref={this.container}
                 style={{paddingBottom: `${(height / width) * 100}%`}}>
                <svg className={`flexible-svg`} preserveAspectRatio={"xMinYMin meet"}
                     viewBox={`0 0 ${width} ${height}`}>
                    {children}
                </svg>
            </div>
        )
    }
}
