import React from "react";
import {Colors, maxLabelLength} from "../util";
import * as d3 from "d3";
import {Bar, BarChart, CartesianGrid, ErrorBar, ReferenceArea, XAxis, YAxis} from "recharts";
import {ImportanceOverview} from "../dao";
import {JupyterButton} from "./jupyter-button";

interface ImportanceOverviewProps {
    overview: ImportanceOverview
    selectedRow: number

    onSelectRow: (i: number) => void
    onExportClick: () => void
}


export class ImportanceOverviewComp extends React.Component<ImportanceOverviewProps, any> {

    render() {
        const {overview, selectedRow, onSelectRow} = this.props

        if (overview === undefined)
            return <></>

        const radius = 8
        const margin = 2

        const marginTop = overview?.column_names ? maxLabelLength(overview.column_names) : 0
        const stepSize = (2 * radius) + margin

        const nColumns = overview.column_names.length
        const nRows = overview.keys.length

        const width = nColumns * stepSize
        const height = nRows * stepSize

        const rows = [...Array(nRows).keys()].map(i => {
            const activeColumns = overview.keys[i]
            return (
                <g key={`${activeColumns[0]}-${activeColumns[1]}`} onClick={() => onSelectRow(i)}
                   className={'hp-importance_row'}>
                    {selectedRow === i &&
                        <rect x={-1.25 * radius} width={width + radius}
                              y={i * stepSize - 1.25 * radius} height={2.5 * radius}
                              fill={'var(--md-grey-300)'}/>}

                    {[...Array(nColumns).keys()].map(j => {
                        const name = overview.column_names[j]
                        return <circle key={name} cx={j * stepSize} cy={i * stepSize} r={radius}
                                       fill={activeColumns.includes(name) ? Colors.SELECTED_FEATURE : Colors.ADDITIONAL_FEATURE}/>
                    })}
                    {d3.pairs<string>(activeColumns)
                        .map(([a, b]) => [overview.column_names.indexOf(a), overview.column_names.indexOf(b)])
                        .map(([a, b]) => (
                            <path d={`M ${a * stepSize} ${i * stepSize} H ${b * stepSize}`}
                                  stroke={Colors.SELECTED_FEATURE}
                                  strokeWidth={radius / 2}/>
                        ))}
                </g>
            )
        })

        const boldHeaders = selectedRow !== undefined ? overview.keys[selectedRow] : ['', '']
        const headers = [...Array(nColumns).keys()].map(i => (
            <g transform={`translate(${i * stepSize + (radius / 2)}, ${marginTop - 20})`}>
                <text transform={'rotate(-50)'}
                      className={boldHeaders.includes(overview.column_names[i]) ? 'selected-header' : ''}>
                    {overview.column_names[i]
                        .replace('data_preprocessor:feature_type:numerical_transformer:', '')
                        .replace('data_preprocessor:feature_type:categorical_transformer:', '')}</text>
            </g>))

        const errorBarImportance = overview.importance.map(i => ({
            mean: i.mean,
            std: i.std,
            idx: i.idx,
            errorBars: [Math.min(i.mean, i.std), Math.min(1 - i.mean, i.std)]
        }))

        return (
            <>
                <div style={{display: "flex", minWidth: 'auto', flexDirection: "column"}}>
                    <div style={{display: "flex", minWidth: 'auto'}}>
                        <svg width={width} height={height + marginTop} style={{overflow: "visible"}}>
                            <g transform={'translate(10, 10)'}>
                                <g transform={`translate(0, ${marginTop})`}>{rows}</g>
                                <g>{headers}</g>
                            </g>
                        </svg>
                        <BarChart data={errorBarImportance} layout={'vertical'} className={'hp-importance'}
                                  width={125} height={height + marginTop}
                                  margin={{top: marginTop - 32, bottom: 0, left: 5, right: 5}}
                                  barSize={2 * radius} barGap={margin} style={{overflow: "visible"}}>
                            <text x={125 / 2} y={marginTop - 30} textAnchor={'middle'}>Importance</text>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey={'mean'} type={'number'} orientation={'top'} domain={[0, 1]}
                                   ticks={[0, 0.25, 0.5, 0.75, 1]}/>
                            <YAxis dataKey="idx" type={"category"} interval={0} hide/>

                            {selectedRow !== undefined && <ReferenceArea x1={0} x2={1} y1={selectedRow} y2={selectedRow}
                                                                         fill={'var(--md-grey-300)'} fillOpacity={1}/>}

                            <Bar dataKey="mean"
                                 fill={Colors.DEFAULT}
                                 onClick={(d) => onSelectRow(d.idx)}
                                 isAnimationActive={selectedRow === undefined}>
                                <ErrorBar dataKey="errorBars" height={radius / 2} strokeWidth={2}
                                          stroke={Colors.HIGHLIGHT}
                                          direction="x"/>
                            </Bar>
                        </BarChart>
                    </div>
                    <JupyterButton onClick={this.props.onExportClick}/>
                </div>
            </>
        )
    }

}
