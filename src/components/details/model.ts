import {Candidate} from "../../model";

export class DetailsModel {

    constructor(public readonly candidate: Candidate,
                public component: string,
                public algorithm: string,
                public selectedSample: number = undefined) {
    }

}
