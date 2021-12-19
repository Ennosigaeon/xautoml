import {ConfusionMatrixData} from "../handler";
import React from "react";
import {DetailsModel} from "./details/model";
import {ErrorIndicator} from "../util/error";
import {LoadingIndicator} from "./loading";
import {Table, TableBody, TableCell, TableRow} from "@material-ui/core";
import {JupyterContext, prettyPrint} from "../util";


interface ConfusionMatrixProps {
    model: DetailsModel
}

interface ConfusionMatrixState {
    cm: ConfusionMatrixData
    loadingCM: boolean
    error: Error
}

export class ConfusionMatrix extends React.Component<ConfusionMatrixProps, ConfusionMatrixState> {

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: ConfusionMatrixProps) {
        super(props);
        this.state = {cm: undefined, loadingCM: false, error: undefined}
    }

    componentDidMount() {
        this.queryConfusionMatrix()
    }

    private queryConfusionMatrix() {
        if (this.state.loadingCM) {
            // Loading already in progress
            return
        }

        const {model} = this.props
        this.setState({loadingCM: true})
        this.context.requestConfusionMatrix(model.candidate.model_file, model.meta.data_file)
            .then(data => this.setState({cm: data, loadingCM: false}))
            .catch(error => {
                console.error(`Failed to fetch confusion matrix: \n${error.name}: ${error.message}`);
                this.setState({error: error, loadingCM: false})
            });
    }

    render() {
        const {cm, loadingCM, error} = this.state

        return (
            <>
                <ErrorIndicator error={error}/>
                {!error &&
                <>
                    <LoadingIndicator loading={loadingCM}/>
                    {cm &&
                    <Table className={'jp-RenderedHTMLCommon'}>
                        <TableBody>
                            <TableRow>
                                <TableCell component="th" rowSpan={cm.values.length + 2}
                                           style={{writingMode: "vertical-rl"}}>
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
                    }
                </>
                }
            </>
        )
    }

}
