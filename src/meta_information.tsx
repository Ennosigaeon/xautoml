import React from "react";
import {MetaInformation} from "./model";
import 'purecss/build/tables.css'

interface MetaInformationProps {
    meta: MetaInformation
}

export default class MetaInformationTable extends React.Component<MetaInformationProps, {}> {

    render() {
        const meta = this.props.meta
        const start = new Date(0)
        start.setUTCSeconds(meta.start_time)
        const end = new Date(0)
        end.setUTCSeconds(meta.end_time)

        return (
            <table className={'pure-table'}>
                <thead><tr>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Metric</th>
                    <th>Wallclock Limit</th>
                    <th>Cutoff Limit</th>
                    <th># Configs</th>
                    <th># Structures</th>
                    <th>Iterations</th>
                </tr></thead>
                <tbody><tr>
                    <td>{start.toString()}</td>
                    <td>{end.toString()}</td>
                    <td>{meta.metric} ({meta.metric_sign})</td>
                    <td>{meta.wallclock_limit}</td>
                    <td>{meta.cutoff}</td>
                    <td>{meta.n_configs}</td>
                    <td>{meta.n_structures}</td>
                    <td>TODO: Missing</td>
                </tr></tbody>
            </table>
        )
    }
}
