import React from "react";
import {ReactWidget} from "@jupyterlab/apputils";
import {IRenderMime} from "@jupyterlab/rendermime-interfaces";

import * as d3 from "d3"

interface Product {
    name: string
    price: string
    category: string
    available: boolean
}

interface CirclesProps {
    count?: number
}

interface CirclesState {
    positions: number[][]
}

class Circles extends React.Component<CirclesProps, CirclesState> {

    private timerId: number;
    private readonly svgRef: React.RefObject<any>

    static defaultProps = {
        count: 10
    }

    constructor(props: any) {
        super(props);
        this.svgRef = React.createRef<HTMLOrSVGElement>();
    }

    private generateDataset() {
        const positions: number[][] = Array.from(Array(this.props.count).keys()).map(_ =>
            [Math.random(), Math.random()]
        );
        this.setState({positions: positions})
    }

    componentDidMount() {
        this.generateDataset()
        this.timerId = setInterval(() => this.generateDataset(), 2000);
    }

    componentDidUpdate(prevProps: Readonly<CirclesProps>, prevState: Readonly<CirclesState>, snapshot?: any) {
        const svgElement = d3.select(this.svgRef.current)
        svgElement.selectAll('circle')
            .data(this.state.positions)
            .join('circle')
            .attr("cx", d => `${d[0] * 100}%`)
            .attr("cy", d => `${d[1] * 100}%`)
            .attr("r", 3)
    }

    componentWillUnmount() {
        clearInterval(this.timerId);
    }

    render() {
        return (
            <svg style={{border: "2px solid gold"}} ref={this.svgRef}/>
        )
    }
}

/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'mimerenderer-xautoml';

/**
 * A widget for rendering application/xautoml.
 */
export class OutputWidget extends ReactWidget implements IRenderMime.IRenderer {
    private readonly _mimeType: string;
    private data: Product[] = undefined;

    constructor(options: IRenderMime.IRendererOptions) {
        super();
        this._mimeType = options.mimeType;
        this.addClass(CLASS_NAME);
    }

    renderModel(model: IRenderMime.IMimeModel): Promise<void> {
        // TODO model.data cast is not typesafe
        this.data = model.data[this._mimeType] as unknown as Product[];

        // Trigger call of render().
        this.onUpdateRequest(undefined);
        return this.renderPromise;
    }

    protected render() {
        return <Circles/>
    }
}