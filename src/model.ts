export type PolicyData = Map<string, number>

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


export class Runhistory {
    constructor(public readonly structures: any,
                public readonly configs: any,
                public readonly xai: XAI) {
    }

    static fromJson(runhistory: Runhistory): Runhistory {
        return new Runhistory(runhistory.structures, runhistory.configs, XAI.fromJson(runhistory.xai))
    }
}
