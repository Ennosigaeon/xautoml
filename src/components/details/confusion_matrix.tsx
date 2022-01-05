import {ConfusionMatrixData} from "../../dao";
import React from "react";
import {Table, TableBody, TableCell, TableRow} from "@material-ui/core";
import {prettyPrint} from "../../util";


interface ConfusionMatrixProps {
    cm: ConfusionMatrixData
}

export class ConfusionMatrix extends React.Component<ConfusionMatrixProps> {

    render() {
        const {cm} = this.props

        return (
            <Table className={'jp-RenderedHTMLCommon'}>
                <TableBody>
                    <TableRow>
                        <TableCell component="th" rowSpan={cm.values.length + 2}
                                   style={{writingMode: "vertical-rl", minWidth: "16px"}}>
                            True Classes
                        </TableCell>
                        <TableCell component="th" scope="row" colSpan={cm.classes.length + 1}>
                            Predicted Class
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell component="th" scope="row"/>
                        {cm.classes.map(clazz =>
                            <TableCell key={clazz} component="th" scope="row" align="right">{clazz}</TableCell>
                        )}
                    </TableRow>

                    {cm.values.map((row, idx) => (
                        <TableRow key={cm.classes[idx]}>
                            <TableCell component="th" scope="col">{cm.classes[idx]}</TableCell>

                            {row.map(cell => <TableCell align="right">{prettyPrint(cell, 5)}</TableCell>)}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )
    }

}
