export class DeploymentModel {
    additionalFiles: string[] = [];

    constructor(
        public id: string,
        public memoryResources: number,
        public cpuResources: number,
        public deploymentDescription: string = '',
        public instanceDescription: string = '',
        public active: boolean = false,
        public configMap: string = '',
    ) {
    }
}

export enum GoDeploymentState {
    Pending = 'Pending',
    Succeeded = 'Succeeded',
    Failed = 'Failed',
    Cancelled = 'Cancelled'
}

export interface DeploymentResult {
    deploymentId: string;
    version?: number;
    deploymentState: GoDeploymentState;
    detailMessage?: string;
}

export interface ResourceLimits {
    memory: number[];
    cpu: number[];
    memoryStep: number;
    cpuStep: number;
}
