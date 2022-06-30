import React from 'react';
import {DeploymentModel, DeploymentResult, GoDeploymentState} from "./model";
import {LoadingIndicator} from "../../util/loading";
import {IAPService} from "./service";
import {ErrorIndicator} from "../../util/error";

interface Props {
    config: DeploymentModel
}

interface State {
    result: DeploymentResult
    error: Error
}

export class WaitingComponent extends React.Component<Props, State> {

    constructor(props: Props) {
        super(props);
        this.state = {
            result: undefined,
            error: undefined
        }

        IAPService.createDeployment(this.props.config).then(result => this.setState({result: result}))
            .catch(error => this.setState({error: error}))
    }

    render() {
        const {result, error} = this.state

        let title = '';
        let message = '';
        if (result) {
            switch (result.deploymentState) {
                case GoDeploymentState.Succeeded:
                    title = `Deployment ${result.deploymentId} has been successfully deployed with version ${result.version}`;
                    break;
                case GoDeploymentState.Pending:
                    title = `Deployment ${result.deploymentId} is being created with version ${result.version}`;
                    message = 'Update the table with the instances to get the current state.';
                    break;
                case GoDeploymentState.Failed:
                case GoDeploymentState.Cancelled:
                    title = `Deployment ${result.deploymentId} failed ${result.version ? 'with version ' + result.version : ''}`;
                    message = result.detailMessage;
                    break;
            }
        }

        return (
            <>
                <LoadingIndicator loading={result === undefined && error === undefined}/>
                <ErrorIndicator error={error}/>
                {title !== '' &&
                    <div style={{margin: '1px'}}>
                        <h3>{title}</h3>
                        <div>{message}</div>
                    </div>
                }
            </>
        )
    }
}
