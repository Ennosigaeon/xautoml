import React from "react";
import {LoadingIndicator} from "./loading";
import ResizeObserver from "resize-observer-polyfill";

interface FlexibleSvgProps {
    height: number
    onContainerChange?: (container: React.RefObject<HTMLDivElement>) => void

    _svg?: React.ForwardedRef<SVGSVGElement>
}

interface FlexibleSvgState {
    width: number
}

export class FlexibleSvg extends React.Component<FlexibleSvgProps, FlexibleSvgState> {

    private resizeObserver: ResizeObserver
    private readonly container: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

    constructor(props: FlexibleSvgProps) {
        super(props);
        this.state = {width: 0}
    }

    componentDidMount() {
        const width = this.container.current.clientWidth
        this.setState({width: width})

        this.resizeObserver = new ResizeObserver(entries => {
            const newWidth = Math.max(...entries.map(e => e.contentRect.width))
            if (Math.abs(this.state.width - newWidth) > 30) {
                this.setState({width: newWidth})
                if (this.props.onContainerChange)
                    this.props.onContainerChange(this.container)
            }
        })
        this.resizeObserver.observe(this.container.current)

        if (this.props.onContainerChange)
            this.props.onContainerChange(this.container)
    }

    componentWillUnmount() {
        this.resizeObserver?.disconnect()
    }

    render() {
        const {height, children, _svg} = this.props
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
                <svg className={`flexible-svg`} preserveAspectRatio={"xMinYMin meet"} xmlns="http://www.w3.org/2000/svg"
                     viewBox={`0 0 ${width} ${height + 1}`} ref={_svg}>
                    {children}
                </svg>
            </div>
        )
    }
}

interface RefableFlexibleSvgProps extends FlexibleSvgProps {
    children?: React.ReactNode;
}

export const RefableFlexibleSvg = React.forwardRef<SVGSVGElement, RefableFlexibleSvgProps>((props, ref) =>
    <FlexibleSvg _svg={ref} {...props}/>
)
