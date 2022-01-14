import {Candidate, Structure} from "../../model";

export type ComparisonType =
    'performance'
    | 'feature_importance'
    | 'lime'
    | 'global_surrogate'
    | 'hp_importance'
    | 'configuration'

export class DetailsModel {

    constructor(public readonly structure: Structure,
                public readonly candidate: Candidate,
                public readonly component: string,
                public readonly algorithm: string,
                public readonly selectedSample: number) {
    }

}
