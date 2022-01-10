import React from "react";
import {Colors, prettyPrint} from "../util";

import * as d3 from 'd3'
import {TooltipProps} from "recharts";
import {v4 as uuidv4} from "uuid";

interface HeatbarProps {
    scale: d3.ScaleSequential<string>
    label: string
    marginLeft?: number
}

export class Heatbar extends React.Component<HeatbarProps, any> {
    static defaultProps = {
        marginLeft: 0
    }

    render() {
        const {marginLeft, scale, label} = this.props
        const [min, max] = this.props.scale.domain()

        const nSteps = 10
        const step = (max - min) / nSteps

        const id = `gradient-${uuidv4()}`

        return (
            <div
                style={{width: "100%", paddingLeft: marginLeft, marginTop: "10px", boxSizing: 'border-box'}}>
                <svg height="20" width="100%">
                    <defs>
                        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
                            {Array.from(Array(10).keys()).map(idx => {
                                return <stop offset={`${idx * 100 / nSteps}%`}
                                             style={{stopColor: scale(min + idx * step), stopOpacity: 1}}/>
                            })}
                        </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`}/>

                    <text x={'5%'} y={'50%'} dominantBaseline={'middle'}>
                        {prettyPrint(min, 5)}
                    </text>
                    <text x={'95%'} y={'50%'} dominantBaseline={'middle'} textAnchor={'end'}>
                        {prettyPrint(max, 5)}
                    </text>
                    <text x={'50%'} y={'50%'} dominantBaseline={'middle'} textAnchor={'middle'}>
                        {label}
                    </text>
                </svg>
            </div>
        )
    }
}


export class MinimalisticTooltip extends React.PureComponent<TooltipProps<any, any>> {
    render() {
        const {active, payload} = this.props

        if (active && payload && payload.length) {
            return (
                <div className="recharts-default-tooltip" style={{
                    margin: '0px',
                    padding: '10px',
                    backgroundColor: '#fff',
                    border: `1px solid ${Colors.ADDITIONAL_FEATURE}`,
                    whiteSpace: 'nowrap'
                }}>
                    <p className="label">{prettyPrint(payload[0].value, 3)}</p>
                </div>
            )
        }
        return null
    }
}
