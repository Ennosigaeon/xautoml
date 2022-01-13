import {CartesianGrid, Cell, ComposedChart, Scatter, XAxis, YAxis} from "recharts";
import React from "react";
import {Prediction} from "../../model";
import {Colors, prettyPrint} from "../../util";
import {LinePoint} from "../../dao";


class LabelEncoder {

    public labels: Prediction[]

    fit(data: Prediction[]): LabelEncoder {
        this.labels = [...new Set(data)]
        return this
    }

    transform(y: Prediction): number {
        return this.labels.indexOf(y)
    }
}

interface DecisionSurfaceProps {
    contour: string
    colors: string[]
    X: LinePoint[]
    y: Prediction[]

    showScatter: boolean

    width?: number
    height?: number
}


export class DecisionSurface extends React.Component<DecisionSurfaceProps, any> {

    static readonly HELP = 'Visualization of the decision surface of each ensemble member mapped into a 2D space. ' +
        'The background color indicates the predicted class in this region. In addition, a subset of the data can ' +
        'be plotted in the 2D space using a scatter plot. Each scatter dot is colored by the correct class.' +
        '\n\n' +
        'Important: The mapping of the high-dimensional input space to 2D in combination with a low sampling rate ' +
        'of the input space due computational restrictions may lead to an under-sampling and seemingly wrong' +
        'decision surfaces, e.g. constant predictions of a classifier or sample colors not being aligned with the ' +
        'decision surface.'

    static defaultProps = {
        width: 300,
        height: 300
    }


    render() {
        const {width, height, X, y, contour, colors, showScatter} = this.props

        const encoder = new LabelEncoder().fit(y)

        return (
            <ComposedChart width={width} height={height}>
                <g transform={`translate(65, 5) scale(${(width - 70) / 720}, ${(height - 40) / 720})`}
                   dangerouslySetInnerHTML={{__html: contour}}>
                </g>

                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="x" type={'number'} domain={['dataMin', 'dataMax']} tickFormatter={prettyPrint}
                       label={{value: 'Dimension 1', dy: 10}}/>
                <YAxis dataKey="y" type={'number'} domain={['dataMin', 'dataMax']} tickFormatter={prettyPrint}
                       label={{value: 'Dimension 2', angle: -90, dx: -40}}/>

                <Scatter data={X}>
                    {X.map((entry, idx) =>
                        <Cell key={`cell-${idx}`}
                              fill={showScatter ? colors[encoder.transform(y[idx])] : 'none'}
                              stroke={showScatter ? Colors.BORDER : 'none'}/>
                    )}
                </Scatter>
            </ComposedChart>
        )
    }
}
