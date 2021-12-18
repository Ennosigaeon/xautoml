import React from "react";
import {prettyPrint, Primitive} from "../util";
import {HelpIcon} from "./help";


interface KeyValueProps {
    key_: string
    value: Primitive
    help?: string
    href?: string
    tight?: boolean
    prec?: number
}

export class KeyValue extends React.PureComponent<KeyValueProps> {

    static defaultProps = {
        tight: false,
        prec: 3
    }

    render() {
        const {key_, value, help, href, tight, prec} = this.props
        return (
            <div style={{margin: tight ? '2px' : '4px'}}>
                <strong>{key_}: </strong>
                {href ?
                    <a href={href} target={'_blank'} className={'hyperlink'}>{prettyPrint(value)}</a> :
                    <span>{prettyPrint(value, prec)}</span>
                }
                {help && <div className="icon baseline"><HelpIcon help={help}/></div>}
            </div>
        )
    }
}
