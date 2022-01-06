import React from "react";


interface TwoColumnLayoutProps {
    widthLeft: string
    widthRight: string

    flexShrinkLeft: string
    flexShrinkRight: string

    flexGrowLeft: string
    flexGrowRight: string
}

export class TwoColumnLayout extends React.PureComponent<TwoColumnLayoutProps> {

    static defaultProps = {
        widthLeft: 'auto',
        widthRight: 'auto',

        flexShrinkLeft: '1',
        flexShrinkRight: '1',

        flexGrowLeft: '1',
        flexGrowRight: '1'
    }

    render() {
        const {widthLeft, widthRight, flexShrinkLeft, flexShrinkRight, flexGrowLeft, flexGrowRight} = this.props
        const children = React.Children.toArray(this.props.children);
        return (
            <div style={{display: 'flex', justifyContent: 'space-around'}}>
                <div style={{flex: `${flexGrowLeft} ${flexShrinkLeft} ${widthLeft}`, overflowX: 'hidden', margin: '5px', marginRight: '10px'}}>
                    {children[0]}
                </div>
                <div style={{flex: `${flexGrowRight} ${flexShrinkRight} ${widthRight}`, margin: '5px', marginLeft: '10px', minWidth: 'auto'}}>
                    {children[1]}
                </div>
            </div>
        )
    }
}
