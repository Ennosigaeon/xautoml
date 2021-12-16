import React from "react";
import {Animate} from "react-move";
import {easeExpInOut} from "d3-ease";
import * as d3ag from "d3-dag";
import {Dag, DagLink, DagNode} from "d3-dag";
import {FlexibleSvg} from "../util/flexible-svg";
import {linkHorizontal} from "d3";
import {v4 as uuidv4} from 'uuid';
import memoize from "memoize-one";
import {prettyPrint, Primitive} from "../util";

interface GraphElementProps {
    nodeWidth: number
    nodeHeight: number
    className?: string;
}

interface GraphNodeProps<Datum> extends GraphElementProps {
    node: DagNode<Datum>;

    isRoot?: boolean
    isTerminal?: boolean
    highlight?: boolean

    onClickHandler?: (d: Datum, e?: React.MouseEvent) => void;
    onAlternativeClickHandler?: (d: Datum, e?: React.MouseEvent) => void;
}

export class GraphNode<Datum> extends React.Component<GraphNodeProps<Datum>, {}> {

    static defaultProps = {
        className: '',

        isRoot: false,
        isTerminal: false,
        highlight: false,

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
        const {node, className, nodeWidth, nodeHeight, isRoot, isTerminal, highlight} = this.props;
        const parent = node

        const round = isRoot || isTerminal
        const offset = isRoot ? nodeWidth / 2 - nodeHeight : -nodeWidth / 2
        const size = round ? [nodeHeight, nodeHeight] : [nodeWidth, nodeHeight]
        return (
            <Animate
                start={{x: parent.x, y: parent.y}}
                update={{x: [node.x], y: [node.y], timing: {duration: 500, ease: easeExpInOut}}}
                enter={{x: [node.x], y: [node.y], timing: {duration: 500, ease: easeExpInOut}}}
            >{({x: x, y: y}) =>
                <g className={`hierarchical-tree_node ${className} ${highlight ? 'selected' : ''}`}
                   transform={`translate(${y}, ${x})`}
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
    link: DagLink<Datum>
    label: Primitive
    highlight?: boolean
}

export class GraphEdge<Datum> extends React.Component<GraphEdgeProps<Datum>, any> {

    static defaultProps = {
        className: '',
        highlight: false,
        label: (undefined as Primitive)
    }

    render() {
        const {link, label, className, nodeWidth, highlight} = this.props;

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
                    timing: {duration: 500, ease: easeExpInOut}
                }}
                enter={{
                    source: {x: [link.source.y + nodeWidth], y: [link.source.x]},
                    target: {x: [link.target.y], y: [link.target.x]},
                    timing: {duration: 500, ease: easeExpInOut}
                }}
            >{({source: source, target: target}) => {
                const id = `edge-${uuidv4()}`
                const labelSpace = target.x - source.x
                return <>
                    <path
                        id={id}
                        transform={`translate(${-nodeWidth / 2}, 0)`}
                        className={`hierarchical-tree_link ${className} ${highlight ? 'selected' : ''}`}
                        d={
                            linkHorizontal().x(d => d[0]).y(d => d[1])({
                                source: [source.x, source.y],
                                target: [target.x, target.y]
                            })}/>
                    {(label !== undefined && (labelSpace > 10)) &&
                        <text className={'hierarchical-tree_link-label'} dy={source.y < target.y ? 10 : -5}
                              fill={'black'}>
                            <textPath xlinkHref={`#${id}`} startOffset={'60%'} textAnchor={'middle'}>
                                {labelSpace > 40 ? prettyPrint(label) : '[...]'}
                                <title>{prettyPrint(label)}</title>
                            </textPath>
                        </text>
                    }
                </>
            }
            }
            </Animate>
        )
    }
}


interface HierarchicalTreeProps<Datum> {
    nodeHeight: number
    nodeWidth: number

    data: Datum | Datum[]
    render: (node: Dag<Datum>) => JSX.Element
    count?: number
    containsTerminalNodes?: boolean
}

interface HierarchicalTreeState {
    width: number
}

export class HierarchicalTree<Datum> extends React.Component<HierarchicalTreeProps<Datum>, HierarchicalTreeState> {

    private previousCount: number = -1

    constructor(props: HierarchicalTreeProps<Datum>) {
        super(props);
        this.state = {width: null}

        this.updateContainer = this.updateContainer.bind(this)
        this.doLayout = this.doLayout.bind(this)
    }

    static defaultProps = {
        count: 1,
        containsTerminalNodes: false
    }

    private updateContainer(container: React.RefObject<any>) {
        container.current.style.overflow = 'hidden'
        this.setState({width: container.current.clientWidth})
    }

    private doLayout(width: number, _: number): any {
        // @ts-ignore
        const root = this.props.data instanceof Array ? d3ag.dagStratify()(this.props.data) : d3ag.dagHierarchy()(this.props.data)

        // Layout without size first to calculate new height
        const layout = d3ag
            .sugiyama()
            .coord(d3ag.coordCenter())
            .size(null)
            .nodeSize(() => [this.props.nodeHeight, this.props.nodeWidth])

        if (width) {
            // @ts-ignore
            // noinspection JSSuspiciousNameCombination
            const newHeight = layout(root).width
            const padding = this.props.containsTerminalNodes ? 2 * (this.props.nodeWidth - this.props.nodeHeight) : 0
            // Adjust layout to actual width and new height
            return [root, layout.size([newHeight, width + padding])]
        } else
            return [root, layout]
    }

    private layout = memoize(this.doLayout);

    render() {
        if (this.props.data === undefined)
            return <></>

        // Pass number of nodes to force recalculation if data has changed
        const [root, layout] = this.layout(this.state.width, this.props.count)
        this.previousCount = this.props.count

        // noinspection JSSuspiciousNameCombination
        const height = layout(root).width;

        return (
            <FlexibleSvg height={height} onContainerChange={this.updateContainer}>
                <g transform={`translate(${this.props.containsTerminalNodes ? -(this.props.nodeWidth - this.props.nodeHeight) : 0},0)`}>
                    {root && this.props.render(root)}
                </g>
            </FlexibleSvg>
        )
    }
}
