export type PolicyData = Map<string, number>
export type CandidateId = string


export class NodeDetails {

    constructor(public readonly failure_message: string,
                public readonly visits: number,
                public readonly reward: number,
                public readonly selected: boolean,
                public readonly policy: PolicyData) {
    }

    static fromJson(nodeDetails: NodeDetails): NodeDetails {
        return new NodeDetails(nodeDetails.failure_message,
            nodeDetails.visits,
            nodeDetails.reward,
            nodeDetails.selected,
            new Map<string, number>(Object.entries(nodeDetails.policy)));
    }
}

export class StructureGraphNode {
    constructor(public readonly id: number,
                public readonly label: string,
                public readonly details: Map<string, NodeDetails>,
                public readonly children?: StructureGraphNode[]) {
    }

    static fromJson(graphNode: StructureGraphNode): StructureGraphNode {
        const details: Map<string, NodeDetails> = new Map<string, NodeDetails>();
        Object.entries<NodeDetails>(graphNode.details as {})
            .forEach(k => details.set(k[0], NodeDetails.fromJson(k[1])));

        return new StructureGraphNode(graphNode.id,
            graphNode.label,
            details,
            graphNode.children?.map(d => StructureGraphNode.fromJson(d)))
    }

    getDetails(key: string): NodeDetails {
        return this.details.get(key)
    }

    shouldDisplay(key: string) {
        return this.details.has(key);
    }
}

export class XAI {
    constructor(public readonly structures: StructureGraphNode) {
    }

    static fromJson(xai: XAI) {
        return new XAI(StructureGraphNode.fromJson(xai.structures))
    }
}

export class Runtime {
    constructor(public readonly total: number, public readonly timestamp: number) {
    }

    public static fromJson(runtime: Runtime): Runtime {
        return new Runtime(runtime.total, runtime.timestamp)
    }
}

export class Config {

    public static readonly SUCCESS = 'SUCCESS'

    constructor(public readonly id: CandidateId,
                public readonly status: string,
                public readonly loss: [number, number],
                public readonly runtime: Runtime,
                public readonly config: any) {
    }

    public static fromJson(config: Config): Config {
        return new Config(config.id, config.status, config.loss, Runtime.fromJson(config.runtime), config.config)
    }
}

export class MetaInformation {
    constructor(public readonly start_time: number,
                public readonly end_time: number,
                public readonly metric: string,
                public readonly metric_sign: number,
                public readonly cutoff: number,
                public readonly wallclock_limit: number,
                public readonly n_structures: number,
                public readonly n_configs: number,
                public readonly iterations: {},
                public readonly model_dir: string) {
    }

    static fromJson(meta: MetaInformation): MetaInformation {
        return new MetaInformation(meta.start_time, meta.end_time, meta.metric, meta.metric_sign, meta.cutoff, meta.wallclock_limit, meta.n_structures, meta.n_configs, meta.iterations, meta.model_dir)
    }
}

export class Pipeline {

    constructor(public readonly steps: [string, string][]) {
    }

    static fromJson(pipeline: Pipeline): Pipeline {
        return new Pipeline(pipeline.steps)
    }
}

export class Structure {

    constructor(public readonly pipeline: Pipeline,
                public readonly budget: number,
                public readonly configspace: string) {
    }

    static fromJson(structure: Structure): Structure {
        // raw pipeline data is list of tuple and not object
        const pipeline = new Pipeline(structure.pipeline as unknown as [string, string][])
        return new Structure(pipeline, structure.budget, structure.configspace)
    }
}

export class Runhistory {
    constructor(public readonly meta: MetaInformation,
                public readonly structures: Map<CandidateId, Structure>,
                public readonly configs: Map<CandidateId, Config[]>,
                public readonly xai: XAI) {
    }

    static fromJson(runhistory: Runhistory): Runhistory {
        const configs = new Map<CandidateId, Config[]>();
        Object.entries<Config[]>(runhistory.configs as {})
            .forEach(k => configs.set(k[0], k[1].map(c => Config.fromJson(c))));

        const structures = new Map<CandidateId, Structure>();
        Object.entries<Structure>(runhistory.structures as {})
            .forEach(k => structures.set(k[0], Structure.fromJson(k[1])))

        return new Runhistory(MetaInformation.fromJson(runhistory.meta),
            structures,
            configs,
            XAI.fromJson(runhistory.xai))
    }
}
