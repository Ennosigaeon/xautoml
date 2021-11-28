import React from "react";
import {ConfigValue, Runhistory} from "../model";
import {CollapseComp} from "../util/collapse";
import {KeyValue} from "../util/KeyValue";

interface MetaInformationProps {
    rh: Runhistory
}

export default class MetaInformationTable extends React.Component<MetaInformationProps, {}> {

    render() {
        const {meta} = this.props.rh
        const start = new Date(0)
        start.setUTCSeconds(meta.start_time)
        const end = new Date(0)
        end.setUTCSeconds(meta.end_time)

        const configValues: [string, ConfigValue][] = []
        meta.config.forEach((value, key) => configValues.push([key, value]))

        return (
            <>
                <CollapseComp showInitial={true}
                              help={'View the most important settings and statistics for this optimization run.'}>
                    <h4>Optimization Overview</h4>
                    <>
                        <KeyValue key_={'Data Set'} value={`Task ${meta.openml_task} on Fold ${meta.openml_fold}`}
                                  href={`https://www.openml.org/t/${meta.openml_task}`}/>
                        <KeyValue key_={'Start Time'} value={start}/>
                        <KeyValue key_={'End Time'} value={end}/>
                        <KeyValue key_={'Metric'} value={meta.metric}/>
                        <KeyValue key_={'Best Performance'} prec={4} value={this.props.rh.bestPerformance}/>
                        <KeyValue key_={'Total Nr. Configs.'} value={meta.n_configs}/>
                        <KeyValue key_={'Unique Structures'} value={meta.n_structures}/>
                    </>
                </CollapseComp>

                <CollapseComp showInitial={false} help={'View additional settings for this optimization run.'}>
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
