import React from "react";
import {Animate} from "react-move";
import {easeExpInOut} from "d3-ease";
import * as d3ag from "d3-dag";
import {Dag, DagLink, DagNode} from "d3-dag";
import {FlexibleSvg} from "../util/flexible-svg";
import {linkHorizontal} from "d3";
import memoize from "memoize-one";

interface GraphElementProps {
    nodeWidth: number
    nodeHeight: number
    className?: string;
}

interface GraphNodeProps<Datum> extends GraphElementProps {
    node: DagNode<Datum>;

    isRoot?: boolean
    isTerminal?: boolean

    onClickHandler?: (d: Datum, e?: React.MouseEvent) => void;
    onAlternativeClickHandler?: (d: Datum, e?: React.MouseEvent) => void;
}

export class GraphNode<Datum> extends React.Component<GraphNodeProps<Datum>, {}> {

    static defaultProps = {
        className: '',

        isRoot: false,
        isTerminal: false,

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
            this.props.onAlternativeClickHandler(node.data, e);
        } else if (this.props.onClickHandler) {
            this.props.onClickHandler(node.data, e);
        }
    }

    render() {
        const {node, className, nodeWidth, nodeHeight, isRoot, isTerminal} = this.props;
        const parent = node

        const round = isRoot || isTerminal
        const offset = isRoot ? nodeWidth / 2 - nodeHeight : -nodeWidth / 2
        const size = round ? [nodeHeight, nodeHeight] : [nodeWidth, nodeHeight]

        return (
            <Animate
                start={{x: parent.x, y: parent.y}}
                update={{x: [node.x], y: [node.y], timing: {duration: 750, ease: easeExpInOut}}}
                enter={{x: [node.x], y: [node.y], timing: {duration: 750, ease: easeExpInOut}}}
            >{({x: x, y: y}) =>
                <g className={`hierarchical-tree_node ${className}`} transform={`translate(${y}, ${x})`}
                   onClick={this.handleClick}>
                    <foreignObject x={offset} y={-nodeHeight / 2} width={size[0]} height={size[1]}>
                        <div className={`hierarchical-tree_node-container`}>
                            <div
                                className={`hierarchical-tree_node-content ${round ? 'hierarchical-tree_node-content-round' : ''}`}>
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


interface GraphEdgeProps<Datum> extends GraphElementProps {
    link: DagLink<Datum>;
    highlight?: boolean
}

export class GraphEdge<Datum> extends React.Component<GraphEdgeProps<Datum>, any> {

    static defaultProps = {
        className: '',
        highlight: false
    }

    render() {
        const {link, className, nodeWidth, highlight} = this.props;

        // noinspection JSSuspiciousNameCombination
        return (
            <Animate
                start={{
                    source: {x: link.source.y + nodeWidth, y: link.source.x},
                    target: {x: link.target.y, y: link.target.x}
                }}
                update={{
                    source: {x: [link.source.y + nodeWidth], y: [link.source.x]},
                    target: {x: [link.target.y], y: [link.target.x]},
                    timing: {duration: 750, ease: easeExpInOut}
                }}
                enter={{
                    source: {x: [link.source.y + nodeWidth], y: [link.source.x]},
                    target: {x: [link.target.y], y: [link.target.x]},
                    timing: {duration: 750, ease: easeExpInOut}
                }}
            >{({source: source, target: target}) =>
                <path
                    transform={`translate(${-nodeWidth / 2}, 0)`}
                    className={`hierarchical-tree_link ${className} ${highlight ? 'selected' : ''}`}
                    d={
                        linkHorizontal().x(d => d[0]).y(d => d[1])({
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

    data: Datum
    render: (node: Dag<Datum>) => JSX.Element
    count?: number
}

interface HierarchicalTreeState {
    width: number
    height: number
}

export class HierarchicalTree<Datum> extends React.Component<HierarchicalTreeProps<Datum>, HierarchicalTreeState> {

    private previousCount: number = -1

    constructor(props: HierarchicalTreeProps<Datum>) {
        super(props);
        this.state = {width: null, height: null}

        this.updateContainer = this.updateContainer.bind(this)
        this.doLayout = this.doLayout.bind(this)
    }

    static defaultProps = {
        count: 1
    }

    private updateContainer(container: React.RefObject<any>) {
        this.setState({width: container.current.clientWidth})
    }

    private doLayout(width: number, height: number, count: number): any {
        const root = d3ag.dagHierarchy()(this.props.data)

        const dimensions: [number, number] | null = (height && width) && (count == this.previousCount) ? [height, width] : null
        const layout = d3ag
            .sugiyama()
            .coord(d3ag.coordCenter())
            .size(dimensions)
            .nodeSize(() => [this.props.nodeHeight, this.props.nodeWidth])
        return [root, layout]
    }

    private layout = memoize(this.doLayout);

    render() {
        if (this.props.data === undefined)
            return <></>

        // Pass number of nodes to force recalculation if data has changed
        const [root, layout] = this.layout(this.state.width, this.state.height, this.props.count)
        this.previousCount = this.props.count

        // noinspection JSSuspiciousNameCombination
        const height = layout(root).width;
        if (this.state.height !== height)
            this.setState({height: height})

        return (
            <FlexibleSvg height={height} onContainerChange={this.updateContainer}>
                {root && this.props.render(root)}
            </FlexibleSvg>
        )
    }
}
