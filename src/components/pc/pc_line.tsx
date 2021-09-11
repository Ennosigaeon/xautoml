// import * as d3 from "d3";
// import * as cpc from "./model";
// import {CPC} from "./CPC";
// import {CPCChoice} from "./CPCChoice";
// import {CPCAxis} from "./CPCAxis";
// import React from "react";
// import {fixedPrec} from "../../util";
//
// interface CPCLineProps {
//     cpc: CPC
//     line: cpc.Line
// }
//
//
// interface CPCLineStats {
//     selected: boolean
// }
//
// export class CPCLine extends React.Component<CPCLineProps, CPCLineStats> {
//
//     private static LAST_Y: number;
//
//     private first: any;
//
//     constructor(props: CPCLineProps) {
//         super(props)
//         this.state = {selected: false}
//     }
//
//     getId(): string {
//         return this.props.line.id
//     }
//
//     getSelections(): Array<cpc.LinePoint> {
//         return this.props.line.points;
//     };
//
//     render() {
//         CPCLine.LAST_Y = 0;
//         this.first = true;
//
//         const d3Path = d3.path();
//         this.layout(this.getSelections(), d3Path);
//
//         const selectedClass = this.state.selected ? 'selected' : ''
//
//         // TODO $(`.line_tick[data-id='${this.id}']`).show(); for selected paths
//         return (
//             <path id={this.getId()} className={`line ${selectedClass}`} d={d3Path.toString()}/>
//         )
//     };
//
//     layout(points: Array<cpc.LinePoint>, path: d3.Path): d3.Path {
//         let choice: CPCChoice;
//         let axis: CPCAxis;
//         let x, y;
//
//
//         for (let point of points) {
//             axis = this.props.cpc.findAxis(point.axis);
//             if (!axis) {
//                 continue;
//             }
//             if (axis.isCategorical()) {
//                 choice = this.props.cpc.findChoice(point.value as string);
//                 choice.pushIntersectingLine(this);
//                 if (choice.isExpanded()) {
//                     if (point.children) {
//                         this.layout(point.children, path);
//                     }
//                     continue;
//                 }
//                 x = choice.getX();
//                 y = choice.getY();
//             } else {
//                 x = axis.getX();
//                 y = axis.getY(point.value as number);
//
//                 // render text as HTML
//                 let pp = d3.select("#" + this.props.cpc.getId()).append("div");
//                 pp.attr("class", `line_tick line_tick_boxed ${CPCLine.LAST_Y < y ? "down" : "up"}`);
//                 pp.attr("data-id", this.getId);
//                 pp.attr("style", `left: ${x}px; top: ${y}px;`);
//                 pp.html(String(fixedPrec(Number(point.value))));
//             }
//
//             if (this.first) {
//                 path.moveTo(x, y);
//                 this.first = false;
//             } else {
//                 path.lineTo(x, y);
//             }
//             CPCLine.LAST_Y = y;
//         }
//         return path
//     };
//
// }
