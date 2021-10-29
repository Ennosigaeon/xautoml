import React from "react";
import {fixedPrec} from "../util";


interface KeyValueProps {
    key_: string
    value: any
    href?: string
}

export class KeyValue extends React.PureComponent<KeyValueProps> {


    render() {
        const {key_, value, href} = this.props

        let renderedValue: string | number
        if (typeof value === 'number') {
            renderedValue = fixedPrec(value, 5)
        } else if (value instanceof Date) {
            renderedValue = (value as Date).toLocaleString()
        } else {
            renderedValue = String(value)
        }

        return (
            <div style={{margin: '4px'}}>
                <strong>{key_}: </strong>
                {href ?
                    <a href={href} target={'_blank'} style={{color: 'rgb(16, 107, 163)'}}>{renderedValue}</a> :
                    <span>{renderedValue}</span>
                }

            </div>
        )
    }
}
