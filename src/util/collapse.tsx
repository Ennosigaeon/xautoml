import {Collapse, IconButton, SvgIcon, Tooltip} from "@material-ui/core";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import React from "react";

interface CollapseProps {
    showInitial: boolean
    className?: string
    help?: string
}

interface CollapseState {
    show: boolean
}

export class CollapseComp extends React.Component<CollapseProps, CollapseState> {

    static defaultProps = {
        className: 'container'
    }

    constructor(props: CollapseProps) {
        super(props);
        this.state = {show: props.showInitial}

        this.toggleShow = this.toggleShow.bind(this)
    }


    private toggleShow(e: React.MouseEvent) {
        this.setState((state) => ({show: !state.show}))
        e.stopPropagation()
    }

    render() {
        const children = React.Children.toArray(this.props.children);

        return (
            <div className={this.props.className}>
                <div style={{display: 'flex', alignItems: 'center'}}>
                    <div style={{flexGrow: 1}}>
                        {children[0]}
                    </div>
                    {this.props.help &&
                    <Tooltip title={
                        <div className={'collapse-tooltip'}>{this.props.help}</div>
                    }>
                        <SvgIcon>
                            <path fill={'rgba(0, 0, 0, 0.54)'}
                                  d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
                        </SvgIcon>
                    </Tooltip>
                    }
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
