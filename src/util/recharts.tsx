import React from "react";
import {Colors, prettyPrint} from "../util";

import * as d3 from 'd3'
import {TooltipProps} from "recharts";

interface HeatbarProps {
    scale: d3.ScaleSequential<string>
    marginLeft?: number
}

export class Heatbar extends React.Component<HeatbarProps, any> {
    static defaultProps = {
        marginLeft: 0
    }

    render() {
        const {marginLeft, scale} = this.props
        const [min, max] = this.props.scale.domain()

        return (
            <div
                style={{width: "100%", paddingLeft: this.props.marginLeft, marginTop: "10px", boxSizing: 'border-box'}}>
                <svg height="20" width="100%">
                    <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%"
                                  style={{stopColor: this.props.scale(min), stopOpacity: 1}}/>
                            <stop offset="100%"
                                  style={{stopColor: this.props.scale(max), stopOpacity: 1}}/>
                        </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#grad1)"/>

                    <text x={'5%'} y={'50%'} dominantBaseline={'middle'}>
                        {prettyPrint(min, 5)}
                    </text>
                    <text x={'95%'} y={'50%'} dominantBaseline={'middle'} textAnchor={'end'}>
                        {prettyPrint(max, 5)}
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
