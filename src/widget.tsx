import {ReactWidget} from '@jupyterlab/apputils';
import React, {ReactNode} from 'react';

/**
 * React component for a counter.
 *
 * @returns The React component
 */

interface FancyBorderProps {
    color: string
    children: ReactNode
}

class FancyBorder extends React.Component<FancyBorderProps> {

    render() {
        return (
            <div className={'FancyBorder FancyBorder-' + this.props.color}>
                {this.props.children}    </div>
        );
    }
}

interface CounterComponentProps {
    count: number;
    onCountChange: (counter: number) => void;
}

class CounterComponent extends React.Component<CounterComponentProps> {

    render() {
        return (
            <div>
                <FancyBorder color={"red"}><p>You clicked {this.props.count} times!</p></FancyBorder>
                <button onClick={() => this.props.onCountChange(this.props.count + 1)}
                >Increment
                </button>
            </div>
        );
    }
}

interface ClockComponentProps {
    firstName?: string;
    lastName: string;
    count: number;
}

interface ClockComponentState {
    date: Date;
}

class ClockComponent extends React.Component<ClockComponentProps, ClockComponentState> {

    timerId: number;

    constructor(props: ClockComponentProps) {
        super(props);
        this.state = {date: new Date()};
    }

    static defaultProps = {
        firstName: "Sandy"
    }

    componentDidMount() {
        this.timerId = setInterval(() => this.setState({date: new Date()}), 1000);
    }

    componentWillUnmount() {
        clearInterval(this.timerId);
    }

    renderName(): string {
        return this.props.firstName + " " + this.props.lastName
    }

    render() {
        return (<div>
            <h1>Hello, {this.renderName()}!</h1>
            <h2>It is {this.state.date.toLocaleTimeString()}.</h2>
            {this.props.count > 0 ?
                <ul>
                    {Array.from(Array(this.props.count).keys()).map(n => <li key={n.toString()}>{n}</li>)}
                </ul> :
                <p>No elements</p>
            }
        </div>)
    }

}

interface ReactRootState {
    count: number;
}

class ReactRoot extends React.Component<{}, ReactRootState> {

    constructor(props: any) {
        super(props);
        this.state = {count: 0}
        this.propagateCount = this.propagateCount.bind(this);
    }

    propagateCount(count: number) {
        this.setState({count: count})
    }

    componentDidUpdate(prevProps: Readonly<{}>, prevState: Readonly<ReactRootState>, snapshot?: any) {
        document.title = `You clicked ${this.state.count} times`;
    }

    render(): JSX.Element {
        return <div>
            <CounterComponent count={this.state.count} onCountChange={this.propagateCount}/>
            <ClockComponent lastName={"Bar"} count={this.state.count}/>
            <button onClick={() => this.propagateCount(0)}>Reset</button>
        </div>;
    }
}


export class TestWidget extends ReactWidget {

    constructor() {
        super();
        this.addClass('jp-ReactWidget');
    }

    render(): JSX.Element {
        return <div>
            <ReactRoot/>
        </div>;
    }
}
