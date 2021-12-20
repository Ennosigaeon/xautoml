import React from "react";
import {prettyPrint} from "../util";

import * as d3 from 'd3'

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
