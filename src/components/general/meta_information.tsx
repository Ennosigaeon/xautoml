import React from "react";
import {ConfigValue, MetaInformation} from "../../model";
import {CollapseComp} from "../../util/collapse";
import {KeyValue} from "../../util/KeyValue";
import {prettyPrint} from "../../util";

interface MetaInformationProps {
    meta: MetaInformation
}

export default class MetaInformationTable extends React.Component<MetaInformationProps, {}> {

    render() {
        const {meta} = this.props
        const start = new Date(0)
        start.setUTCSeconds(meta.start_time)
        const end = new Date(0)
        end.setUTCSeconds(meta.end_time)

        const configValues: [string, ConfigValue][] = []
        meta.config.forEach((value, key) => configValues.push([key, value]))

        return (
            <>
                <CollapseComp name={'optimization-statistics'} showInitial={true}
                              help={'View the most important settings and statistics for this optimization run.'}>
                    <h4>Optimization Overview</h4>
                    <>
                        <KeyValue key_={'Framework'} value={meta.framework}/>
                        {meta.openml_task !== undefined && meta.openml_fold !== undefined &&
                            <KeyValue key_={'Data Set'} value={`Task ${meta.openml_task} on Fold ${meta.openml_fold}`}
                                      href={`https://www.openml.org/t/${meta.openml_task}`}/>
                        }
                        <KeyValue key_={'Start Time'} value={start}/>
                        <KeyValue key_={'End Time'} value={end}/>
                        <KeyValue key_={'Metric'} value={meta.metric}/>
                        <KeyValue key_={'Best Performance'} prec={4} value={meta.bestPerformance}/>
                        <KeyValue key_={'Total Nr. Candidates'} value={meta.n_configs}/>
                        <KeyValue key_={'Unique Structures'} value={meta.n_structures}/>
                    </>
                </CollapseComp>

                <CollapseComp name={'optimization-settings'} showInitial={false}
                              help={'View additional settings for this optimization run.'}>
                    <h4>Optimization Configuration</h4>
                    <>
                        {configValues.map(([key, value]) =>
                            <div className={'overview-row'} key={key}>
                                {key}: {prettyPrint(value)}
                            </div>
                        )}
                    </>
                </CollapseComp>
            </>
        )
    }
}
