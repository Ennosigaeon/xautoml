import React from 'react';
import {Layout} from "./model";
import * as d3 from "d3";

interface SVGBrushProps {
    layout: Layout
    svg: React.RefObject<SVGSVGElement>

    onBrushStart: (event: BrushEvent) => void
    onBrush: (event: BrushEvent) => void
    onBrushEnd: (event: BrushEvent) => void
}

interface SVGBrushState {
    selection: [number, number]
}

export interface BrushEvent {
    type: 'start' | 'brush' | 'end',
    selection: [number, number],
    sourceEvent: React.MouseEvent
}

export class SVGBrush extends React.Component<SVGBrushProps, SVGBrushState> {
    static defaultProps = {
        onBrushStart: (_: BrushEvent) => {
        },
        onBrush: (_: BrushEvent) => {
        },
        onBrushEnd: (_: BrushEvent) => {
        },
    };

    private readonly container: React.RefObject<SVGGElement> = React.createRef<SVGGElement>();

    private initialPosition: number
    private point: SVGPoint

    constructor(props: SVGBrushProps) {
        super(props);
        this.state = {selection: undefined};

        this.initialPosition = undefined;

        this.handleBrushStart = this.handleBrushStart.bind(this)
        this.handleBrushMove = this.handleBrushMove.bind(this)
        this.handleBrushEnd = this.handleBrushEnd.bind(this)
    }

    private handleBrushStart(e: React.PointerEvent<SVGRectElement>) {
        if (this.point === undefined)
            this.point = this.props.svg.current.createSVGPoint();

        const scale = (this.props.layout.yScale as d3.ScaleContinuousNumeric<number, number>);
        (e.target as Element).setPointerCapture(e.pointerId);
        this.initialPosition = scale.invert(this.getPosition(e));
        this.props.onBrushStart({
            type: 'start',
            selection: [this.initialPosition, this.initialPosition],
            sourceEvent: e
        });

        e.preventDefault()
        e.stopPropagation()
    };

    private handleBrushMove(e: React.PointerEvent<SVGRectElement>) {
        if (this.initialPosition) {
            const scale = (this.props.layout.yScale as d3.ScaleContinuousNumeric<number, number>)

            const y = this.getPosition(e);
            const capped = Math.max(Math.min(y, scale.range()[1]), scale.range()[0])
            const minY = Math.min(this.initialPosition, scale.invert(capped))
            const maxY = Math.max(this.initialPosition, scale.invert(capped))

            const selection: [number, number] = [minY, maxY]

            this.setState({selection});
            this.props.onBrush({
                type: 'brush',
                selection: selection,
                sourceEvent: e
            });
        }
    }

    private handleBrushEnd(e: React.MouseEvent) {
        const scale = (this.props.layout.yScale as d3.ScaleContinuousNumeric<number, number>)
        const move = this.getPosition(e);
        let selection = this.state.selection

        if (selection != undefined) {
            // Delete selection from previous brushing if only click
            if (Math.abs(scale(this.initialPosition) - move) < 10)
                selection = undefined

            this.setState({selection: selection})
            SVGBrush.preventClick()
            this.props.onBrushEnd({
                type: 'end',
                selection: selection,
                sourceEvent: e
            })

        }
        this.initialPosition = undefined;
    }

    private static preventClick() {
        // capture onClick event to prevent collapsing axis
        window.addEventListener('click', (e) => e.stopPropagation(),
            {once: true, capture: true})
    }

    private getPosition(event: React.MouseEvent) {
        this.point.x = event.clientX
        this.point.y = event.clientY
        return this.point.matrixTransform(this.container.current.getScreenCTM().inverse()).y
    }

    render() {
        const {layout, svg} = this.props;
        const {selection} = this.state;
        const scale = layout.yScale as d3.ScaleContinuousNumeric<number, number>

        return (
            <>
                {svg !== undefined &&
                    <g className="brush" ref={this.container}>
                        <rect className="pc-brush-overlay"
                              x={layout.x} y={layout.y}
                              width={layout.width} height={layout.height}
                              onPointerDown={this.handleBrushStart}
                              onPointerMove={this.handleBrushMove}
                              onPointerUp={this.handleBrushEnd}
                        />

                        {selection && <rect className="pc-brush-selection"
                                            x={layout.x} y={scale(selection[1])}
                                            width={layout.width} height={scale(selection[0]) - scale(selection[1])}/>
                        }
                    </g>
                }
            </>
        );
    }
}
