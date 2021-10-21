import React from "react";
import {ConfigValue, MetaInformation} from "../model";
import {CollapseComp} from "../util/collapse";

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

        const configValues: [string, ConfigValue][] = []
        meta.configuration.forEach((value, key) => configValues.push([key, value]))

        return (
            <>
                <CollapseComp showInitial={true}>
                    <h4>Optimization Overview</h4>
                    <>
                        <div className={'overview-row'}>
                            Data Set: <a href={`https://www.openml.org/t/${meta.openml_task}`}
                                         target={'_blank'}>Task {meta.openml_task} on Fold {meta.openml_fold}</a>
                        </div>
                        <div className={'overview-row'}>
                            Start Time: {start.toLocaleString()}
                        </div>
                        <div className={'overview-row'}>
                            End Time: {end.toLocaleString()}
                        </div>
                        <div className={'overview-row'}>
                            Metric: {meta.metric}
                        </div>
                        <div className={'overview-row'}>
                            {/* TODO */}
                            Best Performance: 0.9
                        </div>
                        <div className={'overview-row'}>
                            Total Nr. Configs: {meta.n_configs}
                        </div>
                        <div className={'overview-row'}>
                            Unique Structures: {meta.n_structures}
                        </div>
                    </>
                </CollapseComp>

                <CollapseComp showInitial={false}>
                    <h4>Optimization Configuration</h4>
                    <>
                        {configValues.map(([key, value]) =>
                            <div className={'overview-row'} key={key}>
                                {key}: {value.toString()}
                            </div>
                        )}
                    </>
                </CollapseComp>
            </>
        )
    }
}
