import React from "react";
import {IconButton} from "@material-ui/core";
import {ArrowForwardIos} from "@material-ui/icons";


interface OverlayProps {
    title: string
    onClose: () => void
}

interface OverlayState {
}

export class Overlay extends React.Component<OverlayProps, OverlayState> {

    render() {
        return (
            <div className={'overlay-container container'}>
                <div style={{display: "flex", marginBottom: '10px'}}>
                    <IconButton style={{flexShrink: 1, maxHeight: '18px'}} size='small' onClick={this.props.onClose}>
                        <ArrowForwardIos/>
                    </IconButton>
                    <h3 style={{margin: 0, lineHeight: '24px', textAlign: 'center'}}>{this.props.title}</h3>
                </div>

                {this.props.children}
            </div>
        )
    }
}
