import {normalizeComponent} from "./util";

export type PolicyData = Map<string, number>
export type CandidateId = string
export type ConfigValue = number | string | boolean
export type Prediction = number | string | boolean
export type Config = Map<string, ConfigValue>

export namespace BO {
    export class ConfigSpace {
        constructor(public readonly conditions: Condition[],
                    public readonly hyperparameters: HyperParameter[]) {

            this.conditions.forEach(con => {
                const parent = this.hyperparameters.filter(hp => hp.name === con.parent)[0]
                const child = this.hyperparameters.filter(hp => hp.name === con.child)[0]
                parent.subParameters.push(child)
            })
        }

        static fromJson(configSpace: string): ConfigSpace {
            const cs = JSON.parse(configSpace)
            const hyperparameters = (cs.hyperparameters as HyperParameter[]).map(hp => HyperParameter.fromJSON(hp))
            const conditions = (cs.conditions as Condition[]).map(con => Condition.fromJSON(con))
            return new ConfigSpace(conditions, hyperparameters)
        }

        getHyperparameters(name: string): HyperParameter[] {
            const candidates = this.hyperparameters
                .filter(hp => hp.name.startsWith(name))
            const names = new Set<string>(candidates.map(c => c.name))

            return candidates
                .filter(hp => this.conditions.filter(con => con.child === hp.name && names.has(con.parent)).length === 0)
        }
    }

    export class Condition {
        constructor(public readonly parent: string,
                    public readonly child: string,
                    public readonly values: ConfigValue[]) {
        }

        static fromJSON(condition: any): Condition {
            const values = condition.hasOwnProperty('value') ? [condition['value']] : condition['values']
            return new Condition(condition.parent, condition.child, values)
        }
    }

    export class HyperParameter {

        constructor(public readonly name: string,
                    public readonly subParameters: HyperParameter[]) {
        }

        static fromJSON(hp: any): HyperParameter {
            if (hp['type'] === 'categorical')
                return CategoricalHyperparameter.fromJSON(hp as CategoricalHyperparameter)
            else if (hp['type'] === 'constant')
                return new CategoricalHyperparameter(hp.name, [hp.value])
            else
                return NumericalHyperparameter.fromJSON(hp as NumericalHyperparameter)
        }
    }

    export class CategoricalHyperparameter extends HyperParameter {
        constructor(public readonly name: string,
                    public readonly choices: ConfigValue[]) {
            super(name, []);
        }

        static fromJSON(hp: any): CategoricalHyperparameter {
            return new CategoricalHyperparameter(hp.name, hp.choices)
        }
    }

    export class NumericalHyperparameter extends HyperParameter {
        constructor(public readonly name: string,
                    public readonly lower: number,
                    public readonly upper: number,
                    public readonly log: boolean) {
            super(name, []);
        }

        static fromJSON(hp: any): NumericalHyperparameter {
            return new NumericalHyperparameter(hp.name, hp.lower, hp.upper, hp.log)
        }
    }

    export class Explanation {

        public readonly candidates: Candidate[]

        constructor(candidates: Config[],
                    public readonly loss: number[],
                    public readonly marginalization: Map<string, Map<string, [number, number][]>>,
                    public readonly selected: number,
                    public readonly metric: string = 'Expected Improvement') {
            this.candidates = candidates.map((c, idx) =>
                new Candidate(idx.toString(), undefined, undefined, loss[idx], undefined, c, undefined, false)
            )
        }

        get(id: string, key: string = 'bad'): [number, number][] | undefined {
            const map = this.marginalization.get(id)
            if (map === undefined || map.size === 0)
                return undefined

            if (key === undefined || !map.has(key))
                return map.values().next().value
            else
                return map.get(key)
        }

        public static fromJson(explanation: Explanation): Explanation {
            return new Explanation(
                explanation.candidates.map(c => new Map<string, ConfigValue>(Object.entries(c))),
                explanation.loss,
                new Map(Object.entries(explanation.marginalization).map(([key, value]) => [key, new Map(Object.entries(value))])),
                explanation.selected,
                explanation.metric
            )
        }
    }
}

export namespace RL {
    export class StateDetails {

        constructor(public readonly failure_message: string,
                    public readonly score: number,
                    public readonly selected: boolean,
                    public readonly policy: PolicyData) {
        }

        static fromJson(stateDetails: StateDetails): StateDetails {
            return new StateDetails(stateDetails.failure_message,
                stateDetails.score,
                stateDetails.selected,
                new Map<string, number>(Object.entries(stateDetails.policy)));
        }

        isUnvisited(): boolean {
            return this.failure_message === 'Unvisited' || this.policy.get('visits') === 0
        }

        isFailure(): boolean {
            return !!this.failure_message && !this.isUnvisited()
        }
    }

    export class Explanation {
        constructor(public readonly id: string,
                    public readonly label: string,
                    public readonly details: Map<string, StateDetails>,
                    public readonly children?: Explanation[]) {
        }

        static fromJson(graphNode: Explanation): Explanation {
            if (Object.keys(graphNode).length === 0)
                return undefined

            const details: Map<string, StateDetails> = new Map<string, StateDetails>();
            Object.entries<StateDetails>(graphNode.details as {})
                .forEach(k => details.set(k[0], StateDetails.fromJson(k[1])));

            return new Explanation(graphNode.id,
                normalizeComponent(graphNode.label),
                details,
                graphNode.children?.map(d => Explanation.fromJson(d)))
        }

        getDetails(key: string): StateDetails {
            return this.details.get(key)
        }

        shouldDisplay(key: string) {
            return this.details.has(key);
        }
    }

}

export class Explanations {
    constructor(public readonly structures: RL.Explanation,
                public readonly configs: Map<CandidateId, BO.Explanation>) {
    }

    static fromJson(xai: Explanations): Explanations {
        return new Explanations(RL.Explanation.fromJson(xai.structures),
            xai.configs !== undefined ? new Map(Object.entries(xai.configs).map(([key, value]) => [key, BO.Explanation.fromJson(value)])) : new Map()
        )
    }
}

export class Runtime {
    constructor(public readonly training_time: number,
                public readonly timestamp: number,
                public readonly prediction_time: number) {
    }

    public static fromJson(runtime: Runtime): Runtime {
        return new Runtime(runtime.training_time, runtime.timestamp, runtime.prediction_time)
    }
}

export type ConfigOrigin =
    'Default'
    | 'Initial design'
    | 'Sobol'
    | 'Local Search'
    | 'Random Search (sorted)'
    | 'Random Search'
    | 'Hyperopt'

export class Candidate {

    public static readonly SUCCESS = 'SUCCESS'

    // Computed after creating all candidates
    public index: number = 0

    constructor(public readonly id: CandidateId,
                public readonly status: string,
                public readonly budget: number,
                public readonly loss: number,
                public readonly runtime: Runtime,
                public readonly config: Config,
                public readonly origin: ConfigOrigin,
                public readonly filled: boolean) {
    }

    public static fromJson(candidate: Candidate): Candidate {
        const config = new Map<string, number | string>();
        Object.entries<string | number>(candidate.config as {})
            .forEach(k => config.set(k[0], k[1]));

        return new Candidate(candidate.id, candidate.status, candidate.budget, candidate.loss, Runtime.fromJson(candidate.runtime), config, candidate.origin, candidate.filled)
    }

    subConfig(step: PipelineStep, prune: boolean): Config {
        const subConfig = new Map<string, ConfigValue>()
        Array.from(this.config.keys())
            .filter(k => k.startsWith(step.config_prefix + ':'))
            .forEach(key => {
                const tokens = key.split(':')
                subConfig.set(prune ? tokens[tokens.length - 1] : key, this.config.get(key))
            })
        return subConfig
    }
}

export class MetaInformation {
    constructor(public readonly framework: string,
                public readonly start_time: number,
                public readonly end_time: number,
                public readonly metric: string,
                public readonly is_minimization: boolean,
                public readonly openml_task: number,
                public readonly openml_fold: number,
                public readonly n_structures: number,
                public readonly n_configs: number,
                public readonly bestPerformance: number,
                public readonly worstPerformance: number,
                public readonly config: Map<string, ConfigValue>) {
    }

    static fromJson(meta: MetaInformation, losses: number[]): MetaInformation {
        const bestPerformance = meta.is_minimization ? Math.min(...losses) : Math.max(...losses)
        const worstPerformance = meta.is_minimization ? Math.max(...losses) : Math.min(...losses)

        return new MetaInformation(meta.framework, meta.start_time, meta.end_time, meta.metric, meta.is_minimization,
            meta.openml_task, meta.openml_fold, meta.n_structures, meta.n_configs,
            bestPerformance, worstPerformance, new Map<string, ConfigValue>(Object.entries(meta.config)))
    }
}

export type Pipeline = PipelineStep[]

export class PipelineStep {
    constructor(public readonly id: string,
                public readonly label: string,
                public readonly step_name: string,
                public readonly config_prefix: string,
                public readonly splitter: boolean,
                public readonly merger: boolean,
                public readonly parallel_paths: string[],
                public readonly edge_labels: Map<string, string>,
                public readonly cids: CandidateId[],
                public readonly parentIds: string[]) {
    }

    isSelected(selectedCandidates: Set<CandidateId>) {
        return this.cids.filter(id => selectedCandidates.has(id)).length > 0
    }

    getLabel(parent: string): string {
        // parent id may have been changed to omit "transparent" steps like pipeline or column transformer.
        if (this.edge_labels.size === 1)
            return this.edge_labels.values().next().value
        return this.edge_labels.get(parent)
    }

    static fromJson(data: any) {
        return new PipelineStep(data.id,
            normalizeComponent(data.label),
            data.step_name,
            data.config_prefix,
            data.splitter, data.merger,
            data.parallel_paths,
            new Map<string, string>(Object.entries(data.edge_labels)),
            data.cids,
            data.parentIds)
    }
}

export class Structure {

    constructor(public readonly cid: CandidateId,
                public readonly pipeline: Pipeline,
                public readonly configspace: BO.ConfigSpace,
                public readonly configs: Candidate[]) {
    }

    static fromJson(structure: Structure, defaultConfigSpace: BO.ConfigSpace): Structure {
        const pipeline = structure.pipeline.map(s => PipelineStep.fromJson(s))
        const configs = structure.configs.map(c => Candidate.fromJson(c))
        const configSpace = structure.configspace ?
            BO.ConfigSpace.fromJson(structure.configspace as any) : defaultConfigSpace

        if (!configSpace)
            throw new Error(`Neither configspace nor default_configspace provided for structure ${structure.cid}`)

        return new Structure(structure.cid, pipeline, configSpace, configs)
    }
}

export class RunHistory {

    public readonly candidateMap = new Map<CandidateId, Candidate>()

    constructor(public readonly meta: MetaInformation,
                public readonly structures: Structure[],
                public readonly explanations: Explanations) {

        const array: Candidate[] = []
        structures.map(s => s.configs.forEach(c => {
            this.candidateMap.set(c.id, c)
            array.push(c)
        }))

        array.sort((a, b) => a.runtime.timestamp - b.runtime.timestamp)
            .forEach((c, idx) => c.index = idx)
    }

    static fromJson(runhistory: RunHistory): RunHistory {
        // @ts-ignore
        const default_configspace = runhistory.default_configspace ? BO.ConfigSpace.fromJson(runhistory.default_configspace as any) : undefined

        const structures = runhistory.structures.map(s => Structure.fromJson(s, default_configspace))
        const losses = [].concat(...structures.map(s => s.configs.map(c => c.loss)))

        return new RunHistory(MetaInformation.fromJson(runhistory.meta, losses),
            structures, Explanations.fromJson(runhistory.explanations))
    }
}
