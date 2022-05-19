import React from "react";

import {IError, IExecuteResult, IStream} from '@jupyterlab/nbformat';
import {KernelMessage} from "@jupyterlab/services";

interface OutputPanelProps {
    finish: () => void
}

interface OutputPanelState {
    messages: string[]
    numberMessages: number
}

export class OutputPanel extends React.Component<OutputPanelProps, OutputPanelState> {

    constructor(props: OutputPanelProps) {
        super(props);

        this.state = {
            messages: [],
            numberMessages: 0
        }
    }

    public addMessage(msg: KernelMessage.IIOPubMessage) {
        const msgType = msg.header.msg_type;
        // TODO use IRenderMime.IRenderer to correctly render msg

        switch (msgType) {
            case 'error':
                const error = msg.content as IError
                this.state.messages.push(error.evalue)
                break
            case 'stream':
                const text = (msg.content as IStream).text
                const renderedText = typeof text === 'string' ? text : text.join('\n')
                this.state.messages.push(renderedText)
                break
            case 'execute_result':
                const result = msg.content as IExecuteResult
                this.state.messages.push(result.data['text/plain'] as string)
                this.props.finish()
                break
            default:
                break;
        }

        this.setState({messages: this.state.messages, numberMessages: this.state.numberMessages + 1})
    }

    private static renderSingleMessage(message: string): JSX.Element {
        return (
            <div className="lm-Widget p-Widget lm-Panel p-Panel jp-OutputArea-child">
                <div className="lm-Widget p-Widget jp-OutputPrompt jp-OutputArea-prompt"></div>
                <div className="lm-Widget p-Widget jp-RenderedText jp-OutputArea-output">
                    <pre>{message}</pre>
                </div>
            </div>
        )
    }

    render() {
        return (
            <>
                <h2>Log</h2>
                <div className={'lm-Widget p-Widget jp-OutputArea jp-Cell-outputArea'}>
                    {this.state.messages.map(m => OutputPanel.renderSingleMessage(m))}
                </div>
            </>
        )
    }
}
