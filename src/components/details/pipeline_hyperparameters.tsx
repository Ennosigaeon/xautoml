import {Candidate, Config, ConfigValue, Structure} from "../../model";
import React from "react";
import {Table, TableBody, TableCell, TableRow} from "@material-ui/core";
import {prettyPrint} from "../../util";


interface ConfigurationTableProps {
    config: Config
    twoColumns: boolean
}

export class HyperparameterTable extends React.Component<ConfigurationTableProps> {

    renderSingleColumn() {
        const configTable: [string, ConfigValue][] = []
        Array.from(this.props.config.entries())
            .forEach(([name, value]) => {
                configTable.push([name, value])
            })
        return configTable.map(([name, value]) =>
            <TableRow key={name}>
                <TableCell component="th"
                           scope="row">{name}</TableCell>
                <TableCell align="right">{prettyPrint(value, 5)}</TableCell>
            </TableRow>
        )
    }

    renderTwoColumns() {
        const configTable: [[string, ConfigValue][], [string, ConfigValue][]] = [[], []]
        Array.from(this.props.config.entries())
            .forEach(([name, value], idx) => {
                configTable[idx % 2].push([name, value])
            })
        // Ensure that left and right array have exactly the same amount of elements
        if (configTable[0].length != configTable[1].length)
            configTable[1].push(["", ""])

        return configTable[0]
            .map(([name, value], idx) => {
                const name2 = configTable[1][idx][0]
                const value2 = configTable[1][idx][1]

                return (
                    <TableRow key={name}>
                        <TableCell component="th"
                                   scope="row">{name}</TableCell>
                        <TableCell align="right">{prettyPrint(value, 5)}</TableCell>

                        <TableCell component="th"
                                   scope="row">{name2}</TableCell>
                        <TableCell align="right">{prettyPrint(value2, 5)}</TableCell>
                    </TableRow>
                )
            })
    }


    render() {
        if (this.props.config.size === 0)
            return <p>No Configuration</p>
        else
            return (
                <Table className={'jp-RenderedHTMLCommon'}>
                    <TableBody>
                        {this.props.twoColumns ? this.renderTwoColumns() : this.renderSingleColumn()}
                    </TableBody>
                </Table>
            )
    }

}


interface ConfigurationProps {
    candidate: Candidate
    structure: Structure
}

export class PipelineHyperparameters extends React.Component<ConfigurationProps> {

    render() {
        const {candidate, structure} = this.props
        return (
            <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap'}}>
                {structure.pipeline
                    .slice(1)
                    .map(step =>
                        <div key={step.label}>
                            <h4>{step.label}</h4>
                            <HyperparameterTable config={candidate.subConfig(step, true)} twoColumns={false}/>
                        </div>
                    )
                }
            </div>
        );
    }
}
