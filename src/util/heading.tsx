import {HelpIcon} from "./help";
import React from "react";


interface HeadingProps {
    help?: string
}

export class Heading extends React.Component<HeadingProps> {
    render() {
        return (
            <div className={'custom-header'}>
                {this.props.children}
                {this.props.help && <div className="icon baseline"><HelpIcon help={this.props.help}/></div>}
            </div>
        )
    }
}


