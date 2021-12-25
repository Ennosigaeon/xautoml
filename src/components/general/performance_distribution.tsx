import React from 'react';
import {MetaInformation} from "../../model";
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis} from "recharts";
import {LoadingIndicator} from "../../util/loading";
import {TimelineRecord} from "./performance_timeline";
import {bin} from "d3";
import {Colors} from "../../util";

interface PerformanceDistributionProps {
    data: TimelineRecord[]
    meta: MetaInformation
    height: number
}

export default class PerformanceDistribution extends React.Component<PerformanceDistributionProps> {

    render() {
        const {data} = this.props

        const bins = bin()(data.map(d => d.performance as number))
            .map(bin => ({frequency: bin.length, performance: (bin.x0 + bin.x1) / 2}))

        console.log(bins)

        return (
            <div style={{height: this.props.height}}>
                <LoadingIndicator loading={data.length === 0}/>

                {data.length > 0 &&
                    <ResponsiveContainer>
                        <BarChart data={bins}>
                            <CartesianGrid strokeDasharray="3 3"/>

                            <XAxis dataKey="performance" label={{value: this.props.meta.metric, dy: 10}}/>
                            <YAxis label={{value: 'Frequency', angle: -90, dx: -25}}/>

                            <Bar dataKey="frequency" fill={Colors.DEFAULT}/>
                        </BarChart>
                    </ResponsiveContainer>
                }
            </div>
        );
    }
}
