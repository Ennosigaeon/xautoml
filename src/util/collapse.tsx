import {Collapse, IconButton} from "@material-ui/core";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import React from "react";

interface CollapseProps {
    showInitial: boolean
}

interface CollapseState {
    show: boolean
}

export class CollapseComp extends React.Component<CollapseProps, CollapseState> {

    constructor(props: CollapseProps) {
        super(props);
        this.state = {show: props.showInitial}

        this.toggleShow = this.toggleShow.bind(this)
    }


    private toggleShow() {
        this.setState((state) => ({show: !state.show}))
    }

    render() {
        const children = React.Children.toArray(this.props.children);

        return (
            <div className={'container'}>
                <div style={{display: 'flex', alignItems: 'center'}}>
                    <div style={{flexGrow: 1}}>
                        {children[0]}
                    </div>
                    <IconButton style={{flexShrink: 1, maxHeight: '24px'}} size='small' onClick={this.toggleShow}>
                        {this.state.show ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                    </IconButton>
                </div>

                <Collapse in={this.state.show}>
                    <div style={{marginTop: '5px'}}>
                        {children[1]}
                    </div>
                </Collapse>
            </div>
        )
    }
}
