import React from "react";
import * as d3 from "d3";
import {BaseType, HierarchyNode, HierarchyPointNode, TreeLayout} from "d3";

interface StructureGraphProps {
    data: StructureGraphPayload
}

interface StructureGraphState {
    loaded: boolean;
}

interface CollapsibleHierarchyNode<Datum> extends HierarchyNode<Datum> {
    x0?: number;
    y0?: number;
    _children?: this[];
}

interface CollapsibleHierarchyPointNode<Datum> extends HierarchyPointNode<Datum> {
    x0?: number;
    y0?: number;
    _children?: this[];
}

type SelectionType = d3.Selection<BaseType, CollapsibleHierarchyPointNode<StructureGraphPayload>, BaseType, CollapsibleHierarchyPointNode<StructureGraphPayload>>;

export class StructureGraphComponent extends React.Component<StructureGraphProps, StructureGraphState> {

    private readonly containerRef: React.RefObject<SVGSVGElement>;
    private layout: TreeLayout<StructureGraphPayload>;
    private root: CollapsibleHierarchyNode<StructureGraphPayload>;
    private margin: number;

    constructor(props: StructureGraphProps) {
        super(props);
        this.containerRef = React.createRef<SVGSVGElement>();
        this.margin = 20;
        this.state = {loaded: false};
    }

    componentDidMount() {
        // Crude hack to actually wait for base container to be rendered in Jupyter
        window.setTimeout(() => {
            const width = this.containerRef.current?.getBoundingClientRect().width - 2 * this.margin;
            const height = this.containerRef.current?.getBoundingClientRect().height - 2 * this.margin;

            this.layout = d3.tree<StructureGraphPayload>().size([height, width]);
            this.root = d3.hierarchy(this.props.data, d => d.children);
            this.root.x0 = height / 2;
            this.root.y0 = 0;

            StructureGraphComponent.collapseAll(this.root);

            this.setState({loaded: true})
        }, 500)
    }

    componentDidUpdate(prevProps: Readonly<StructureGraphProps>, prevState: Readonly<any>, snapshot?: any) {
        if (this.state.loaded) {
            this.renderTree(this.layout(this.root));
        }
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

    private renderTree(source: CollapsibleHierarchyPointNode<StructureGraphPayload>) {
        const treeData = this.layout(this.root) as CollapsibleHierarchyPointNode<StructureGraphPayload>;

        const duration = 750;
        const svg = d3.select(this.containerRef.current).select('g');

        const nodes = treeData.descendants() as CollapsibleHierarchyPointNode<StructureGraphPayload>[];
        const links = treeData.descendants().slice(1) as CollapsibleHierarchyPointNode<StructureGraphPayload>[];

        // Normalize for fixed-depth.
        nodes.forEach(d => d.y = d.depth * 180);

        // Update the nodes...
        const node = (svg.selectAll('g.node') as SelectionType)
            .data(nodes, d => d.data.id);

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr("transform", () => `translate(${source.y0},${source.x0})`)
            .on('click', (event, d) => this.click(d));

        // Add Circle for the nodes
        nodeEnter.append('circle')
            .attr('class', 'node')
            .attr('r', 1e-6)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff"); // Currently collapsed?

        // Add labels for the nodes
        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", 13)
            .text(d => d.data.data.label);


        // UPDATE
        // @ts-ignore
        const nodeUpdate = nodeEnter.merge(node);

        // Transition to the proper position for the node
        nodeUpdate.transition()
            .duration(duration)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        // Update the node attributes and style
        nodeUpdate.select('circle.node')
            .attr('r', 10)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff") // Currently collapsed?
            .attr('cursor', 'pointer');

        // Remove any exiting nodes
        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", () => `translate(${source.y},${source.x})`)
            .remove();

        // On exit reduce the node circles size to 0
        nodeExit.select('circle')
            .attr('r', 1e-6);

        // On exit reduce the opacity of text labels
        nodeExit.select('text')
            .style('fill-opacity', 1e-6);

        // Update the links...
        const link = (svg.selectAll('path.link') as SelectionType)
            .data(links, d => d.data.id);

        // Enter any new links at the parent's previous position.
        const linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .attr('d', () =>
                d3.linkHorizontal().x(d => d[1]).y(d => d[0])({
                    source: [source.x0, source.y0],
                    target: [source.x0, source.y0]
                })
            );

        // UPDATE
        // @ts-ignore
        const linkUpdate = linkEnter.merge(link);

        // Transition back to the parent element position
        linkUpdate.transition()
            .duration(duration)
            .attr('d', d =>
                d3.linkHorizontal().x(d => d[1]).y(d => d[0])({
                    source: [d.x, d.y],
                    target: [d.parent.x, d.parent.y]
                }));

        // Remove any exiting links
        link.exit().transition()
            .duration(duration)
            .attr('d', () =>
                d3.linkHorizontal().x(d => d[1]).y(d => d[0])({
                    source: [source.x, source.y],
                    target: [source.x, source.y]
                })
            )
            .remove();

        // Store the old positions for transition.
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
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
        this.renderTree(node);
    }

    render() {
        return (
            <svg className={'base-container'} style={{"minHeight": "640px"}} ref={this.containerRef}>
                <g transform={`translate(${this.margin},${this.margin})`}/>
            </svg>
        )
    }
}
