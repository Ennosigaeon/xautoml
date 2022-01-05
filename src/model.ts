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
                new Candidate(idx.toString(), undefined, undefined, loss[idx], undefined, c, undefined)
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
                    public readonly visits: number,
                    public readonly score: number,
                    public readonly selected: boolean,
                    public readonly policy: PolicyData) {
        }

        static fromJson(stateDetails: StateDetails): StateDetails {
            return new StateDetails(stateDetails.failure_message,
                stateDetails.visits,
                stateDetails.score,
                stateDetails.selected,
                new Map<string, number>(Object.entries(stateDetails.policy)));
        }

        isUnvisited(): boolean {
            return this.failure_message === 'Unvisited'
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
                graphNode.label,
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
    constructor(public readonly training_time: number, public readonly timestamp: number) {
    }

    public static fromJson(runtime: Runtime): Runtime {
        return new Runtime(runtime.training_time, runtime.timestamp)
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

    constructor(public readonly id: CandidateId,
                public readonly status: string,
                public readonly budget: number,
                public readonly loss: number,
                public readonly runtime: Runtime,
                public readonly config: Config,
                public readonly origin: ConfigOrigin) {
    }

    public static fromJson(candidate: Candidate): Candidate {
        const config = new Map<string, number | string>();
        Object.entries<string | number>(candidate.config as {})
            .forEach(k => config.set(k[0], k[1]));

        return new Candidate(candidate.id, candidate.status, candidate.budget, candidate.loss, Runtime.fromJson(candidate.runtime), config, candidate.origin)
    }

    subConfig(step: PipelineStep, prune: boolean): Config {
        const subConfig = new Map<string, ConfigValue>()
        Array.from(this.config.keys())
            .filter(k => k.startsWith(step.id + ':'))
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

        return new MetaInformation('dswizard', meta.start_time, meta.end_time, meta.metric, meta.is_minimization,
            meta.openml_task, meta.openml_fold, meta.n_structures, meta.n_configs,
            bestPerformance, worstPerformance, new Map<string, ConfigValue>(Object.entries(meta.config)))
    }
}

export class PipelineStep {

    public readonly name: string
    public readonly label: string
    public readonly edgeLabels: Map<string, string>

    constructor(public readonly id: string, public readonly clazz: string, public readonly parentIds: string[]) {
        this.label = normalizeComponent(this.clazz)
        this.edgeLabels = new Map<string, string>()

        const tokens = this.id.split(':')
        this.name = tokens[tokens.length - 1]
    }
}

export class Pipeline {

    constructor(public readonly steps: PipelineStep[]) {
    }

    static fromJson(pipeline: any): Pipeline {
        const [steps] = this.loadSingleStep(undefined, pipeline, [])
        return new Pipeline(steps)
    }


    private static loadSingleStep(id: string, step: any, parents: string[]): [PipelineStep[], string[]] {
        if (step.clazz.includes('Pipeline')) {
            let parents_: string[] = parents;
            const steps: PipelineStep[] = [];
            (step.args.steps as [string, any][])
                .forEach(([subId, subStep]) => {
                        const res = this.loadSingleStep(id ? `${id}:${subId}` : subId, subStep, parents_)
                        steps.push(...res[0])
                        parents_ = res[1]
                    }
                )
            return [steps, parents_]
        } else if (step.clazz.includes('ColumnTransformer')) {
            const steps: PipelineStep[] = [];
            const outParents: string[] = [];
            (step.args.transformers as [string, any, any][])
                .forEach(([subId, subPath, columns]) => {
                    const [childSteps, newParents] = this.loadSingleStep(`${id}:${subId}`, subPath, parents)
                    childSteps[0].edgeLabels.set(subId, columns.toString()) // At least one child always have to be present
                    steps.push(...childSteps)
                    outParents.push(...newParents)
                })
            return [steps, outParents]
        } else if (step.clazz.includes('FeatureUnion')) {
            const steps: PipelineStep[] = [];
            const outParents: string[] = [];
            (step.args.transformer_list as [string, any][])
                .forEach(([subId, subPath]) => {
                    const [childSteps, newParents] = this.loadSingleStep(`${id}:${subId}`, subPath, parents)
                    childSteps[0].edgeLabels.set(subId, 'all') // At least one child always have to be present
                    steps.push(...childSteps)
                    outParents.push(...newParents)
                })
            return [steps, outParents]
        } else {
            return [[new PipelineStep(id ? id : '', step.clazz, parents)], [id]]
        }
    }
}

export class Structure {

    constructor(public readonly cid: CandidateId,
                public readonly pipeline: Pipeline,
                public readonly configspace: BO.ConfigSpace,
                public readonly configs: Candidate[]) {
    }

    static fromJson(structure: Structure, defaultConfigSpace: BO.ConfigSpace): Structure {
        // raw pipeline data is list of tuple and not object
        const pipeline = Pipeline.fromJson(structure.pipeline as any)
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
        structures.map(s => s.configs.forEach(c => this.candidateMap.set(c.id, c)))
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
