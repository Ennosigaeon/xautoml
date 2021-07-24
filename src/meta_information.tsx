import React from "react";
import {MetaInformation} from "./model";
import 'purecss/build/tables.css'
import {Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow} from "@material-ui/core";

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
            <TableContainer component={Paper}>
                <Table aria-label="simple table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Start Time</TableCell>
                            <TableCell>End Time</TableCell>
                            <TableCell>Metric</TableCell>
                            <TableCell>Wallclock Limit</TableCell>
                            <TableCell>Cutoff Limit</TableCell>
                            <TableCell># Configs</TableCell>
                            <TableCell># Structures</TableCell>
                            <TableCell>Iterations</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell>{start.toString()}</TableCell>
                            <TableCell>{end.toString()}</TableCell>
                            <TableCell>{meta.metric} ({meta.metric_sign})</TableCell>
                            <TableCell>{meta.wallclock_limit}</TableCell>
                            <TableCell>{meta.cutoff}</TableCell>
                            <TableCell>{meta.n_configs}</TableCell>
                            <TableCell>{meta.n_structures}</TableCell>
                            <TableCell>TODO: Missing</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        )
    }
}
