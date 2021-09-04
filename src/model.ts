export type PolicyData = Map<string, number>
export type CandidateId = string
export type ConfigValue = number | string | boolean
export type Config = Map<string, ConfigValue>


export class BanditDetails {

    constructor(public readonly failure_message: string,
                public readonly visits: number,
                public readonly reward: number,
                public readonly selected: boolean,
                public readonly policy: PolicyData) {
    }

    static fromJson(nodeDetails: BanditDetails): BanditDetails {
        return new BanditDetails(nodeDetails.failure_message,
            nodeDetails.visits,
            nodeDetails.reward,
            nodeDetails.selected,
            new Map<string, number>(Object.entries(nodeDetails.policy)));
    }
}

export class HierarchicalBandit {
    constructor(public readonly id: number,
                public readonly label: string,
                public readonly details: Map<string, BanditDetails>,
                public readonly children?: HierarchicalBandit[]) {
    }

    static fromJson(graphNode: HierarchicalBandit): HierarchicalBandit {
        const details: Map<string, BanditDetails> = new Map<string, BanditDetails>();
        Object.entries<BanditDetails>(graphNode.details as {})
            .forEach(k => details.set(k[0], BanditDetails.fromJson(k[1])));

        return new HierarchicalBandit(graphNode.id,
            graphNode.label,
            details,
            graphNode.children?.map(d => HierarchicalBandit.fromJson(d)))
    }

    getDetails(key: string): BanditDetails {
        return this.details.get(key)
    }

    shouldDisplay(key: string) {
        return this.details.has(key);
    }
}

export class Explanations {
    constructor(public readonly structures: HierarchicalBandit) {
    }

    static fromJson(xai: Explanations) {
        return new Explanations(HierarchicalBandit.fromJson(xai.structures))
    }
}

export class Runtime {
    constructor(public readonly total: number, public readonly timestamp: number) {
    }

    public static fromJson(runtime: Runtime): Runtime {
        return new Runtime(runtime.total, runtime.timestamp)
    }
}

export class Candidate {

    public static readonly SUCCESS = 'SUCCESS'

    constructor(public readonly id: CandidateId,
                public readonly status: string,
                public readonly budget: number,
                public readonly loss: [number, number],
                public readonly runtime: Runtime,
                public readonly config: Config) {
    }

    public static fromJson(candidate: Candidate): Candidate {
        const config = new Map<string, number | string>();
        Object.entries<string | number>(candidate.config as {})
            .forEach(k => config.set(k[0], k[1]));

        return new Candidate(candidate.id, candidate.status, candidate.budget, candidate.loss, Runtime.fromJson(candidate.runtime), config)
    }
}

export class MetaInformation {
    constructor(public readonly framework: string,
                public readonly start_time: number,
                public readonly end_time: number,
                public readonly metric: string,
                public readonly metric_sign: number,
                public readonly cutoff: number,
                public readonly openml_task: number,
                public readonly openml_fold: number,
                public readonly wallclock_limit: number,
                public readonly n_structures: number,
                public readonly n_configs: number,
                public readonly iterations: {},
                public readonly model_dir: string,
                public readonly data_file: string) {
    }

    static fromJson(meta: MetaInformation): MetaInformation {
        return new MetaInformation('dswizard', meta.start_time, meta.end_time, meta.metric, meta.metric_sign, meta.cutoff, meta.openml_task, meta.openml_fold, meta.wallclock_limit, meta.n_structures, meta.n_configs, meta.iterations, meta.model_dir, meta.data_file)
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

    constructor(public readonly cid: CandidateId,
                public readonly pipeline: Pipeline,
                public readonly configspace: string,
                public readonly configs: Candidate[]) {
    }

    static fromJson(structure: Structure): Structure {
        // raw pipeline data is list of tuple and not object
        const pipeline = new Pipeline(structure.pipeline as unknown as [string, string][])
        const configs = structure.configs.map(c => Candidate.fromJson(c))
        return new Structure(structure.cid, pipeline, structure.configspace, configs)
    }
}

export class Runhistory {
    constructor(public readonly meta: MetaInformation,
                public readonly structures: Structure[],
                public readonly explanations: Explanations) {
    }

    static fromJson(runhistory: Runhistory): Runhistory {
        const structures = runhistory.structures.map(s => Structure.fromJson(s))

        return new Runhistory(MetaInformation.fromJson(runhistory.meta),
            structures,
            Explanations.fromJson(runhistory.explanations))
    }
}
