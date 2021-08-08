import React from "react";
import {Candidate} from "../model";

interface DataSetDetailsProps {
    candidate: Candidate
    component: string
}

interface DataSetDetailsState {

}


export class DataSetDetailsComponent extends React.Component<DataSetDetailsProps, DataSetDetailsState> {
    render() {
        return (
            <>
                <h5>{this.props.candidate.id} ({this.props.component})</h5>
            </>
        )
    }
}
