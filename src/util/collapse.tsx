import {Collapse, IconButton} from "@material-ui/core";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import React from "react";
import {HelpIcon} from "./help";
import {JupyterContext} from "../util";

interface CollapseProps {
    showInitial: boolean
    name?: string
    className?: string
    help?: string
}

interface CollapseState {
    show: boolean
}

export class CollapseComp extends React.Component<CollapseProps, CollapseState> {

    static defaultProps = {
        className: 'container',
        name: undefined as string,
        showInitial: false
    }

    static contextType = JupyterContext;
    context: React.ContextType<typeof JupyterContext>;

    constructor(props: CollapseProps, context: React.ContextType<typeof JupyterContext>) {
        super(props, context);
        this.context.collapsedState.setIfNotPresent(this.props.name, this.props.showInitial)
        this.state = {show: this.context.collapsedState.get(this.props.name)}

        this.toggleShow = this.toggleShow.bind(this)
    }


    private toggleShow(e: React.MouseEvent) {
        this.setState((state) => {
            this.context.collapsedState.set(this.props.name, !state.show)
            return {show: !state.show}
        })
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
                    {this.props.help && <HelpIcon help={this.props.help}/>}
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
