import React from "react";


interface TwoColumnLayoutProps {
    widthLeft: string
    widthRight: string

    flexShrinkLeft: string
    flexShrinkRight: string
}

export class TwoColumnLayout extends React.PureComponent<TwoColumnLayoutProps> {

    static defaultProps = {
        widthLeft: 'auto',
        widthRight: 'auto',

        flexShrinkLeft: '1',
        flexShrinkRight: '1'
    }

    render() {
        const {widthLeft, widthRight, flexShrinkLeft, flexShrinkRight} = this.props
        const children = React.Children.toArray(this.props.children);
        return (
            <div style={{display: 'flex'}}>
                <div style={{flex: `1 ${flexShrinkLeft} ${widthLeft}`, overflowX: 'hidden', margin: '5px', marginRight: '10px'}}>
                    {children[0]}
                </div>
                <div style={{flex: `1 ${flexShrinkRight} ${widthRight}`, margin: '5px', marginLeft: '10px', minWidth: 'auto'}}>
                    {children[1]}
                </div>
            </div>
        )
    }
}
