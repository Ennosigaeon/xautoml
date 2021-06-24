type PolicyPayload = Map<string, any>

class StructureGraphNodePayload {
    constructor(public readonly label: string,
                public readonly failure_message: string,
                public readonly visits: number,
                public readonly reward: number,
                public readonly policy: Map<string, PolicyPayload>) {
    }
}

class StructureGraphPayload {
    constructor(public readonly id: number,
                public readonly data: StructureGraphNodePayload,
                public readonly children: StructureGraphPayload[],
                public children_: StructureGraphPayload[]) {
    }
}

class XAI {
    constructor(public readonly structures: StructureGraphPayload) {
    }
}


class Runhistory {
    constructor(public readonly structures: any,
                public readonly configs: any,
                public readonly xai: XAI) {
    }
}
