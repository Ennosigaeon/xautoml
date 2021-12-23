import {CandidateId, ConfigValue} from "../../model";
import * as d3 from "d3";

export interface HPRecord {
    cid: CandidateId
    value: ConfigValue
    performance: number
    timestamp: number
}

export interface HyperparameterHistory {
    name: string
    scale: d3.ScaleContinuousNumeric<number, number> | d3.ScaleBand<ConfigValue>
    type: 'category' | 'number'
    data: HPRecord[]
}
