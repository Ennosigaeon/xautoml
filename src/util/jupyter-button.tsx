import React, {CSSProperties} from "react";
import {Button} from "@material-ui/core";

// @ts-ignore
import JupyterLogo from '../../style/jupyter.svg';

interface JupyterButtonProps {
    onClick: (event: React.MouseEvent) => void
    style?: CSSProperties | undefined
}

export class JupyterButton extends React.Component<JupyterButtonProps, {}> {

    render() {
        const {onClick, style} = this.props

        return (
            <Button className={'jupyter-button'}
                    onClick={onClick}
                    style={style}>
                Continue in <div style={{marginLeft: '-5px'}} dangerouslySetInnerHTML={{__html: JupyterLogo}}/>
            </Button>
        );
    }
}
