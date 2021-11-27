import React from "react";
import {prettyPrint, Primitive} from "../util";


interface KeyValueProps {
    key_: string
    value: Primitive
    href?: string
    tight?: boolean
}

export class KeyValue extends React.PureComponent<KeyValueProps> {

    static defaultProps = {
        tight: false
    }

    render() {
        const {key_, value, href, tight} = this.props
        return (
            <div style={{margin: tight ? '2px' : '4px'}}>
                <strong>{key_}: </strong>
                {href ?
                    <a href={href} target={'_blank'} className={'hyperlink'}>{prettyPrint(value)}</a> :
                    <span>{prettyPrint(value)}</span>
                }
            </div>
        )
    }
}
