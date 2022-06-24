import React, {CSSProperties} from "react";
import {Button} from "@material-ui/core";

// @ts-ignore
import JupyterLogo from '../../style/jupyter.svg';

interface JupyterButtonProps {
    onClick: (event: React.MouseEvent) => void
    active?: boolean
    style?: CSSProperties | undefined
}

export class JupyterButton extends React.Component<JupyterButtonProps, {}> {

    static defaultProps = {
        active: true
    }

    render() {
        const {onClick, active, style} = this.props


        return (
            <>
                {active &&
                    <Button className={'jupyter-button'}
                            onClick={onClick}
                            style={style}>
                        Continue in <div style={{marginLeft: '-5px'}} dangerouslySetInnerHTML={{__html: JupyterLogo}}/>
                    </Button>
                }
            </>
        )
    }
}
