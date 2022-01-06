import React from "react";
import {prettyPrint, Primitive} from "../util";
import {HelpIcon} from "./help";


interface KeyValueProps {
    key_: string
    value: Primitive | JSX.Element
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
            <div style={{margin: tight ? '2px' : '4px'}} className={'key-value-pair'}>
                <strong style={{display: "inline-block", marginRight: '2px'}}>{key_}: </strong>
                {React.isValidElement(value) ? value :
                    href ?
                        <a href={href} target={'_blank'} className={'hyperlink'}>{prettyPrint(value as Primitive)}</a> :
                        <span>{prettyPrint(value as Primitive, prec)}</span>
                }
                {help && <div className="icon baseline"><HelpIcon help={help}/></div>}
            </div>
        )
    }
}
