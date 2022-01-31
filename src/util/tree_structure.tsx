import React from "react";
import {Animate} from "react-move";
import {easeExpInOut} from "d3-ease";
import * as d3ag from "d3-dag";
import {Dag, DagLink, DagNode} from "d3-dag";
import {FlexibleSvg} from "./flexible-svg";
import {linkHorizontal} from "d3";
import {v4 as uuidv4} from 'uuid';
import memoize from "memoize-one";
import {prettyPrint, Primitive} from "../util";

const ANIMATION_DURATION = 300

interface GraphElementProps {
    nodeWidth: number
    nodeHeight: number
    className?: string;
}

interface GraphNodeProps<Datum> extends GraphElementProps {
    node: DagNode<Datum>;

    virtual?: boolean
    highlight?: boolean

    onClick?: (d: Datum, e?: React.MouseEvent) => void;
    onAlternativeClick?: (d: Datum, e?: React.MouseEvent) => void;
}

export class GraphNode<Datum> extends React.Component<GraphNodeProps<Datum>, {}> {

    static defaultProps = {
        className: '',

        virtual: false,
        highlight: false,

        onClick: () => {
        },
        onAlternativeClick: () => {
        }
    }

    constructor(props: GraphNodeProps<Datum>) {
        super(props);
        this.handleClick = this.handleClick.bind(this);
    }

    private handleClick(e: React.MouseEvent) {
        const {node} = this.props
        if (e.ctrlKey) {
            this.props.onAlternativeClick(node.data, e);
        } else if (this.props.onClick) {
            this.props.onClick(node.data, e);
        }
    }

    render() {
        const {node, className, nodeWidth, nodeHeight, virtual, highlight} = this.props;
        const parent = node

        const width = virtual ? nodeHeight : nodeWidth
        return (
            <Animate
                start={{x: parent.x, y: parent.y}}
                update={{x: [node.x], y: [node.y], timing: {duration: ANIMATION_DURATION, ease: easeExpInOut}}}
                enter={{x: [node.x], y: [node.y], timing: {duration: ANIMATION_DURATION, ease: easeExpInOut}}}
            >{({x: x, y: y}) =>
                <g className={`hierarchical-tree_node ${className} ${highlight ? 'selected' : ''}`}
                   transform={`translate(${y}, ${x})`}>
                    <foreignObject x={0} y={-nodeHeight / 2} width={width} height={nodeHeight}>
                        <div className={`hierarchical-tree_node-container`}>
                            <div onClick={this.handleClick}
                                 className={`hierarchical-tree_node-content ${virtual ? 'hierarchical-tree_node-content-virtual' : ''}`}>
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
    startOffset?: number
}

export class GraphEdge<Datum> extends React.Component<GraphEdgeProps<Datum>, any> {

    static defaultProps = {
        className: '',
        highlight: false,
        startOffset: 0,
        label: (undefined as Primitive)
    }

    render() {
        const {link, label, className, nodeWidth, highlight, startOffset} = this.props;

        let labelOffset = -5
        if (label !== undefined) {
            const idx = link.source.children()
                .sort((a, b) => a.x - b.x)
                .findIndex(c => c === link.target)
            if (idx >= link.source.children().length / 2)
                labelOffset = 10
        }

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
                    timing: {duration: ANIMATION_DURATION, ease: easeExpInOut}
                }}
                enter={{
                    source: {x: [link.source.y + nodeWidth], y: [link.source.x]},
                    target: {x: [link.target.y], y: [link.target.x]},
                    timing: {duration: ANIMATION_DURATION, ease: easeExpInOut}
                }}
            >{({source: source, target: target}) => {
                const id = `edge-${uuidv4()}`
                const labelSpace = target.x - source.x
                return <>
                    <path
                        id={id}
                        className={`hierarchical-tree_link ${className} ${highlight ? 'selected' : ''}`}
                        d={
                            linkHorizontal().x(d => d[0]).y(d => d[1])({
                                source: [source.x, source.y + startOffset],
                                target: [target.x, target.y]
                            })}/>
                    {(label !== undefined && (labelSpace > 10)) &&
                        <text className={'hierarchical-tree_link-label'} dy={labelOffset}
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
                <g transform={`translate(${-this.props.nodeWidth / 2},0)`}>
                    {root && this.props.render(root)}
                </g>
            </FlexibleSvg>
        )
    }
}
