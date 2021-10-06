import {HierarchicalBandit} from "../model";
import React from "react";
import {Animate} from "react-move";
import {easeExpInOut} from "d3-ease";
import * as d3 from "d3";
import {HierarchyNode, HierarchyPointNode} from "d3";

export interface CollapsibleNode<Datum> extends HierarchyNode<Datum> {
    _children?: this[];
}

export interface CollapsiblePointNode<Datum> extends HierarchyPointNode<Datum> {
    _children?: this[];
}

interface GraphElementProps {
    source: CollapsiblePointNode<HierarchicalBandit>;
    node: CollapsiblePointNode<HierarchicalBandit>;
    nodeWidth: number
    nodeHeight: number
    className?: string;
}

interface GraphNodeProps extends GraphElementProps {
    onClickHandler?: (d: CollapsiblePointNode<HierarchicalBandit>) => void;
    onAlternativeClickHandler?: (d: CollapsiblePointNode<HierarchicalBandit>) => void;
}

export class GraphNode extends React.Component<GraphNodeProps, {}> {

    static defaultProps = {
        className: '',
        onClickHandler: () => {
        },
        onAlternativeClickHandler: () => {
        }
    }

    constructor(props: GraphNodeProps) {
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
        const {node, source, className, nodeWidth, nodeHeight} = this.props;
        const parent = node.parent ? node.parent : source;

        return (
            <Animate
                start={{x: parent.x, y: parent.y, opacity: 0, r: 1e-6}}
                update={{x: [node.x], y: [node.y], opacity: [1], r: [10], timing: {duration: 750, ease: easeExpInOut}}}
                enter={{x: [node.x], y: [node.y], opacity: [1], r: [10], timing: {duration: 750, ease: easeExpInOut}}}
            >{({x: x, y: y, opacity: opacity, r: r}) =>
                <g className={`bandit-explanation_node ${className}`} transform={`translate(${y},${x})`}
                   onClick={this.handleClick}>
                    <foreignObject x={0} y={-nodeHeight / 2} width={nodeWidth} height={nodeHeight}>
                        {this.props.children}
                    </foreignObject>
                </g>
            }
            </Animate>
        )
    }
}

export class GraphEdge extends React.Component<GraphElementProps, any> {

    static defaultProps = {
        className: ''
    }

    render() {
        const {node, className, source, nodeWidth} = this.props;
        const parent = node.parent ? node.parent : source;

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
                    className={className}
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
