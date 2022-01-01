import {CartesianGrid, Cell, ComposedChart, Scatter, XAxis, YAxis} from "recharts";
import React from "react";
import {Prediction} from "../../model";
import {Colors, prettyPrint} from "../../util";


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
    X: { x: number, y: number }[]
    y: Prediction[]

    showScatter: boolean

    width?: number
    height?: number
}


export class DecisionSurface extends React.Component<DecisionSurfaceProps, any> {

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
                <XAxis dataKey="x" type={'number'} domain={['dataMin', 'dataMax']} tickFormatter={prettyPrint}/>
                <YAxis dataKey="y" type={'number'} domain={['dataMin', 'dataMax']} tickFormatter={prettyPrint}/>

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
