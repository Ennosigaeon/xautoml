import React from "react";
import {Animate} from "react-move";
import {easeExpInOut} from "d3-ease";
import * as d3 from "d3";
import {HierarchyNode, HierarchyPointNode, TreeLayout} from "d3";

export interface CollapsibleNode<Datum> extends HierarchyNode<Datum> {
    _children?: this[];
}

export interface CollapsiblePointNode<Datum> extends HierarchyPointNode<Datum> {
    _children?: this[];
}

interface GraphElementProps<Datum> {
    node: CollapsiblePointNode<Datum>;
    nodeWidth: number
    nodeHeight: number
    className?: string;
}

interface GraphNodeProps<Datum> extends GraphElementProps<Datum> {
    onClickHandler?: (d: CollapsiblePointNode<Datum>) => void;
    onAlternativeClickHandler?: (d: CollapsiblePointNode<Datum>) => void;
}

export class GraphNode<Datum> extends React.Component<GraphNodeProps<Datum>, {}> {

    static defaultProps = {
        className: '',
        onClickHandler: () => {
        },
        onAlternativeClickHandler: () => {
        }
    }

    constructor(props: GraphNodeProps<Datum>) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }

    private handleClick(e: React.MouseEvent) {
        const {node} = this.props
        if (e.ctrlKey && this.props.onAlternativeClickHandler) {
            this.props.onAlternativeClickHandler(node);
        } else if (this.props.onClickHandler) {
            this.props.onClickHandler(node);
        }
    }

    render() {
        const {node, className, nodeWidth, nodeHeight} = this.props;
        const parent = node.parent;

        return (
            <Animate
                start={{x: parent.x, y: parent.y, opacity: 0, r: 1e-6}}
                update={{x: [node.x], y: [node.y], opacity: [1], r: [10], timing: {duration: 750, ease: easeExpInOut}}}
                enter={{x: [node.x], y: [node.y], opacity: [1], r: [10], timing: {duration: 750, ease: easeExpInOut}}}
            >{({x: x, y: y, opacity: opacity, r: r}) =>
                <g className={`hierarchical-tree_node ${className}`} transform={`translate(${y},${x})`}
                   onClick={this.handleClick}>
                    <foreignObject x={0} y={-nodeHeight / 2} width={nodeWidth} height={nodeHeight}>
                        <div className={`hierarchical-tree_node-container`}>
                            <div className={`hierarchical-tree_node-content`}>
                                {this.props.children}
                            </div>
                        </div>
                    </foreignObject>
                </g>
            }
            </Animate>
        )
    }
}

export class GraphEdge<Datum> extends React.Component<GraphElementProps<Datum>, any> {

    static defaultProps = {
        className: ''
    }

    render() {
        const {node, className, nodeWidth} = this.props;
        const parent = node.parent

        if (parent === node)
            return <></>

        return (
            <Animate
                start={{
                    source: {x: parent.x, y: parent.y + nodeWidth},
                    target: {x: parent.x, y: parent.y}
                }}
                update={{
                    source: {x: [parent.x], y: [parent.y + nodeWidth]},
                    target: {x: [node.x], y: [node.y]},
                    timing: {duration: 750, ease: easeExpInOut}
                }}
                enter={{
                    source: {x: [parent.x], y: [parent.y + nodeWidth]},
                    target: {x: [node.x], y: [node.y]},
                    timing: {duration: 750, ease: easeExpInOut}
                }}
            >{({source: source, target: target}) =>
                <path
                    className={`hierarchical-tree_link ${className}`}
                    d={
                        d3.linkHorizontal().x(d => d[1]).y(d => d[0])({
                            source: [source.x, source.y],
                            target: [target.x, target.y]
                        })}/>
            }
            </Animate>
        )
    }
}


interface HierarchicalTreeProps<Datum> {
    nodeHeight: number
    nodeWidth: number

    data: CollapsibleNode<Datum>
    render: (node: CollapsiblePointNode<Datum>) => JSX.Element
}

export class HierarchicalTree<Datum> extends React.Component<HierarchicalTreeProps<Datum>, {}> {
    private readonly containerRef: React.RefObject<SVGSVGElement> = React.createRef<SVGSVGElement>();
    private readonly layout: TreeLayout<Datum> = d3.tree<Datum>().size([1, 1]);
    private readonly margin: number = 20;

    private calcHeight(root: CollapsibleNode<Datum>): number {
        if (!root) {
            return 50
        }

        const {nodeWidth, nodeHeight} = this.props

        const nodeCount = new Array<number>(Math.max(...root.descendants().map(d => d.depth)) + 1).fill(0);
        root.descendants().map(d => nodeCount[d.depth]++);
        const maxNodes = Math.max(...nodeCount);
        const newHeight = maxNodes * (1.1 * nodeHeight + this.margin) + 2 * this.margin;

        (root.descendants() as CollapsiblePointNode<Datum>[])
            .map(d => {
                d.y = d.depth * (nodeWidth + 75);
                d.x = d.x * (newHeight - 2 * this.margin);
                return d;
            })

        if (this.containerRef.current) {
            const currentHeight = this.containerRef.current.clientHeight
            if (currentHeight > newHeight) {
                window.setTimeout(() => {
                    this.containerRef.current.setAttribute('height', newHeight.toString());
                }, 400);
                // Return old height as height is going to be changed after animation
                return currentHeight
            }
        }
        return newHeight
    }


    render() {
        if (this.props.data === undefined)
            return <></>

        const root = this.layout(this.props.data)
        root.parent = root
        const height = this.calcHeight(root)

        return (
            <svg className={'hierarchical-tree'} ref={this.containerRef} height={height}>
                {root && <g transform={`translate(${this.margin},${this.margin})`}>
                    {this.props.render(root)}
                </g>}
            </svg>
        )
    }
}
