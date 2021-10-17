import React from "react";


interface TwoColumnLayoutProps {
    widthLeft: string
    widthRight: string
}

export class TwoColumnLayout extends React.PureComponent<TwoColumnLayoutProps> {

    static defaultProps = {
        widthLeft: 'auto',
        widthRight: 'auto'
    }

    render() {
        const {widthLeft, widthRight} = this.props
        const children = React.Children.toArray(this.props.children);
        return (
            <div style={{display: 'flex'}}>
                <div style={{flex: `1 1 ${widthLeft}`, overflowX: 'hidden', margin: '5px', marginRight: '10px'}}>
                    {children[0]}
                </div>
                <div style={{flex: `1 1 ${widthRight}`, margin: '5px', marginLeft: '10px'}}>
                    {children[1]}
                </div>
            </div>
        )
    }
}
