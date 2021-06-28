import React from "react";
import * as d3 from "d3";
import {HierarchyNode, HierarchyPointNode, TreeLayout} from "d3";
import {Animate} from "react-move";
import {easeExpInOut} from "d3-ease";

interface StructureGraphProps {
    data: StructureGraphPayload;
}

interface StructureGraphState {
    nodes: CollapsibleHierarchyPointNode<StructureGraphPayload>;
    source: CollapsibleHierarchyPointNode<StructureGraphPayload>;
}

interface CollapsibleHierarchyNode<Datum> extends HierarchyNode<Datum> {
    _children?: this[];
}

interface CollapsibleHierarchyPointNode<Datum> extends HierarchyPointNode<Datum> {
    _children?: this[];
}

interface StructureGraphElementProps {
    source: CollapsibleHierarchyPointNode<StructureGraphPayload>;
    node: CollapsibleHierarchyPointNode<StructureGraphPayload>;
    onClickHandler?: (d: CollapsibleHierarchyPointNode<StructureGraphPayload>) => void;
}

export class StructureGraphNode extends React.Component<StructureGraphElementProps, any> {

    constructor(props: StructureGraphElementProps) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }

    private handleClick() {
        if (this.props.onClickHandler) {
            this.props.onClickHandler(this.props.node);
        }
    }

    render() {
        const node = this.props.node;
        const source = this.props.source;
        const parent = node.parent ? node.parent : source;

        return (
            <Animate
                start={{x: parent.x, y: parent.y, opacity: 0, r: 1e-6}}
                update={{x: [node.x], y: [node.y], opacity: [1], r: [10], timing: {duration: 750, ease: easeExpInOut}}}
                enter={{x: [node.x], y: [node.y], opacity: [1], r: [10], timing: {duration: 750, ease: easeExpInOut}}}
            >{({x: x, y: y, opacity: opacity, r: r}) =>
                <g className={'node'} transform={`translate(${y},${x})`} onClick={this.handleClick}>
                    <circle r={r} style={{fill: node._children ? "lightsteelblue" : "#fff"}}/>
                    <text dy={"0.35em"} x={13} opacity={opacity}>{node.data.data.label}</text>
                </g>
            }
            </Animate>
        )
    }

}

export class StructureGraphEdge extends React.Component<StructureGraphElementProps, any> {

    constructor(props: StructureGraphElementProps) {
        super(props);
    }

    render() {
        const node = this.props.node;
        const parent = node.parent ? node.parent : this.props.source;

        return (
            <Animate
                start={{
                    source: {x: parent.x, y: parent.y},
                    target: {x: parent.x, y: parent.y}
                }}
                update={{
                    source: {x: [parent.x], y: [parent.y]},
                    target: {x: [node.x], y: [node.y]},
                    timing: {duration: 750, ease: easeExpInOut}
                }}
                enter={{
                    source: {x: [parent.x], y: [parent.y]},
                    target: {x: [node.x], y: [node.y]},
                    timing: {duration: 750, ease: easeExpInOut}
                }}
            >{({source: source, target: target}) =>
                <path className={'link'} d={
                    d3.linkHorizontal().x(d => d[1]).y(d => d[0])({
                        source: [source.x, source.y],
                        target: [target.x, target.y]
                    })}/>
            }
            </Animate>
        )
    }
}

export class StructureGraphComponent extends React.Component<StructureGraphProps, StructureGraphState> {

    private readonly containerRef: React.RefObject<SVGSVGElement>;
    private layout: TreeLayout<StructureGraphPayload>;
    private readonly margin: number;

    constructor(props: StructureGraphProps) {
        super(props);
        this.containerRef = React.createRef<SVGSVGElement>();
        this.margin = 20;
        this.state = {nodes: undefined, source: undefined};

        this.click = this.click.bind(this);
    }

    componentDidMount() {
        // Crude hack to actually wait for base container to be rendered in Jupyter
        window.setTimeout(() => {
            const width = this.containerRef.current?.getBoundingClientRect().width - 2 * this.margin;
            const height = this.containerRef.current?.getBoundingClientRect().height - 2 * this.margin;

            this.layout = d3.tree<StructureGraphPayload>().size([height, width]);
            const nodes: CollapsibleHierarchyNode<StructureGraphPayload> = d3.hierarchy(this.props.data, d => d.children);

            StructureGraphComponent.collapseAll(nodes);

            const root = this.layout(nodes)
            this.setState({nodes: root, source: root});
        }, 500)
    }

    private static collapseAll(d: CollapsibleHierarchyNode<StructureGraphPayload>) {
        if (d.children) {
            StructureGraphComponent.collapseNode(d)
            d.children.forEach(d2 => this.collapseAll(d2))
        }
    }

    private static collapseNode(d: CollapsibleHierarchyNode<StructureGraphPayload>) {
        if (d.children) {
            const [unvisited, visited] = d.children.reduce(([unvisited, visited], child) => {
                return child.data.data.failure_message === 'Unvisited' ? [[...unvisited, child], visited] : [unvisited, [...visited, child]];
            }, [[], []]);
            d._children = unvisited
            d.children = visited
        } else {
            d._children = []
            d.children = []
        }
    }

    private click(node: CollapsibleHierarchyPointNode<StructureGraphPayload>) {
        if (!node.children && !node._children) {
            // No children
            return;
        } else if (node._children?.length === 0) {
            // Node is expanded
            StructureGraphComponent.collapseNode(node);
        } else {
            // Node is collapsed
            node.children = node.children.concat(node._children);
            node._children = [];
        }
        this.setState({nodes: this.layout(this.state.nodes), source: node});
    }

    render() {
        if (this.state.nodes) {
            this.state.nodes.x = (this.containerRef.current?.getBoundingClientRect().height - 2 * this.margin) / 2;
            this.state.nodes.y = 0;
        }
        const nodes = this.state.nodes ? (this.state.nodes.descendants() as CollapsibleHierarchyPointNode<StructureGraphPayload>[])
            .map(d => {
                // Normalize for fixed-depth.
                d.y = d.depth * 180;
                return d
            }) : [];

        return (
            <svg className={'base-container'} ref={this.containerRef}>
                {this.state.nodes && <g transform={`translate(${this.margin},${this.margin})`}>
                    {nodes.map(d => <StructureGraphEdge key={d.data.id} source={this.state.nodes} node={d}/>)}
                    {nodes.map(d => <StructureGraphNode key={d.data.id} source={this.state.nodes} node={d}
                                                        onClickHandler={this.click}/>)}
                </g>}
            </svg>
        )
    }
}
