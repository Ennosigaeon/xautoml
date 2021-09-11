import * as cpc from "./model";


export namespace SampleData {

    function createNumericalAxis() {
        return new cpc.Axis('3', 'Accuracy', cpc.Type.NUMERICAL, new cpc.Domain(0.15, 1))
    }

    function createConditionalAxis() {
        const axis1 = cpc.Axis.Categorical('1_1_1', 'Type', [
            new cpc.Choice('1_1_1_1', 'Quality'),
            new cpc.Choice('1_1_1_2', 'Intermediate'),
            new cpc.Choice('1_1_1_3', 'Speed', [
                cpc.Axis.Numerical('1_1_1_3_1', 'alpha', new cpc.Domain(0, 1)),
                cpc.Axis.Numerical('1_1_1_3_2', 'beta', new cpc.Domain(0, 1))
            ]),
        ])
        const axis2 = cpc.Axis.Numerical('1_1_2', 'Holdout', new cpc.Domain(0.001, 0.999))
        const axis3 = cpc.Axis.Numerical('1_1_3', 'EstimatorNumber', new cpc.Domain(1, 4))

        return cpc.Axis.Categorical('1', 'Configuration', [
            new cpc.Choice('1_1', 'ModelPool', [axis1, axis2, axis3]),
            new cpc.Choice('1_2', 'Disabled')
        ])
    }

    export function createModel(): cpc.Model {
        return new cpc.Model('dataset',
            '',
            [createConditionalAxis(), createNumericalAxis()],
            new Array<cpc.Line>());
    }
}
