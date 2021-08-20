import React from "react";
import {Button} from "@material-ui/core";

// @ts-ignore
import JupyterLogo from '../../style/jupyter.svg';

interface JupyterButtonProps {
    onClickHandler: (event: React.MouseEvent) => void
}

export class JupyterButton extends React.Component<JupyterButtonProps, {}> {

    render() {
        const {onClickHandler} = this.props

        return (
            <Button className={'jupyter-button'}
                    onClick={onClickHandler}
                    style={{marginTop: '14px'}}>
                Continue in <div dangerouslySetInnerHTML={{__html: JupyterLogo}}/>
            </Button>
        );
    }
}
