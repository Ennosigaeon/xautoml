import React from "react";


export class TwoColumnLayout extends React.PureComponent {

    render() {
        const children = React.Children.toArray(this.props.children);
        return (
            <div style={{display: 'flex'}}>
                <div style={{flex: '1 1 auto', overflowX: 'auto', margin: '5px', marginRight: '10px'}}>
                    {children[0]}
                </div>
                <div style={{margin: '5px', marginLeft: '10px', flexBasis: '15%'}}>
                    {children[1]}
                </div>
            </div>
        )
    }
}
