import React, {CSSProperties} from "react";
import {Button} from "@material-ui/core";

// @ts-ignore
import JupyterLogo from '../../style/jupyter.svg';

interface JupyterButtonProps {
    onClickHandler: (event: React.MouseEvent) => void
    style?: CSSProperties | undefined
}

export class JupyterButton extends React.Component<JupyterButtonProps, {}> {

    render() {
        const {onClickHandler, style} = this.props

        return (
            <Button className={'jupyter-button'}
                    onClick={onClickHandler}
                    style={style}>
                Continue in <div dangerouslySetInnerHTML={{__html: JupyterLogo}}/>
            </Button>
        );
    }
}
