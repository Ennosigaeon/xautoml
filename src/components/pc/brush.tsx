import React from 'react';

interface SVGBrushProps {
    extent: [[number, number], [number, number]]
    svg: React.RefObject<SVGSVGElement>

    onBrushStart: (event: BrushEvent) => void
    onBrush: (event: BrushEvent) => void
    onBrushEnd: (event: BrushEvent) => void
}

interface SVGBrushState {
    selection: DOMRect
}

export interface BrushEvent {
    type: 'start' | 'brush' | 'end',
    selection: DOMRect,
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

        (e.target as Element).setPointerCapture(e.pointerId);
        this.initialPosition = this.getPosition(e);
        this.props.onBrushStart({
            type: 'start',
            selection: this.state.selection,
            sourceEvent: e
        });

        e.preventDefault()
        e.stopPropagation()
    };

    private handleBrushMove(e: React.PointerEvent<SVGRectElement>) {
        if (this.initialPosition) {
            const {extent: [[x0, y0], [x1, y1]]} = this.props;

            const y = this.getPosition(e);
            const minY = Math.max(Math.min(this.initialPosition, y), y0)
            const maxY = Math.min(Math.max(this.initialPosition, y), y1)

            const selection: DOMRect = new DOMRect(x0, minY, x1 - x0, maxY - minY)

            this.setState({selection});
            this.props.onBrush({
                type: 'brush',
                selection: selection,
                sourceEvent: e
            });
        }
    }

    private handleBrushEnd(e: React.MouseEvent) {
        const move = this.getPosition(e);
        let selection = this.state.selection
        if (this.initialPosition && Math.abs(this.initialPosition - move) < 10) {
            // Delete selection from previous brushing
            if (this.state.selection?.height > 10)
                SVGBrush.preventClick()
            this.setState({selection: undefined})
            selection = undefined
        } else
            SVGBrush.preventClick()

        this.props.onBrushEnd({
            type: 'end',
            selection: selection,
            sourceEvent: e
        })
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
        const {extent: [[x0, y0], [x1, y1]], svg} = this.props;
        const {selection} = this.state;

        return (
            <>
                {svg !== undefined &&
                    <g className="brush" ref={this.container}>
                        <rect className="pc-brush-overlay"
                              x={x0} y={y0}
                              width={x1 - x0} height={y1 - y0}
                              onPointerDown={this.handleBrushStart}
                              onPointerMove={this.handleBrushMove}
                              onPointerUp={this.handleBrushEnd}
                        />

                        {selection && <rect className="pc-brush-selection"
                                            x={selection.x} y={selection.y}
                                            width={selection.width} height={selection.height}
                        />}
                    </g>
                }
            </>
        );
    }
}
