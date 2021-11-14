import React from "react";
import {fixedPrec} from "../util";


interface KeyValueProps {
    key_: string
    value: any
    href?: string
    tight?: boolean
}

export class KeyValue extends React.PureComponent<KeyValueProps> {

    static defaultProps = {
        tight: false
    }

    render() {
        const {key_, value, href, tight} = this.props

        let renderedValue: string | number
        if (typeof value === 'number') {
            renderedValue = fixedPrec(value, 5)
        } else if (value instanceof Date) {
            renderedValue = (value as Date).toLocaleString()
        } else {
            renderedValue = String(value)
        }

        return (
            <div style={{margin: tight ? '2px' : '4px'}}>
                <strong>{key_}: </strong>
                {href ?
                    <a href={href} target={'_blank'} className={'hyperlink'}>{renderedValue}</a> :
                    <span>{renderedValue}</span>
                }

            </div>
        )
    }
}
