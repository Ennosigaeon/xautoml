import React from "react";

interface DatasetTableProps {
    data: string
    selectedSample: number | undefined
    onSampleClick: (idx: number) => void
}


export class DataSetTable extends React.Component<DatasetTableProps> {

    private readonly dfTableRef = React.createRef<HTMLDivElement>()
    private static selectedClassName = 'selected-config'

    constructor(props: DatasetTableProps) {
        super(props);

        this.handleSampleClick = this.handleSampleClick.bind(this)
    }

    componentDidMount() {
        this.registerClickListener()
    }

    componentDidUpdate(prevProps: Readonly<DatasetTableProps>, prevState: Readonly<{}>, snapshot?: any) {
        this.registerClickListener()
    }

    private registerClickListener() {
        if (!!this.dfTableRef.current) {
            [...this.dfTableRef.current.getElementsByTagName('tr')].forEach(tr => {
                tr.onclick = this.handleSampleClick

                // Highlight previously selected row
                if (this.props.selectedSample !== undefined &&
                    this.props.selectedSample === Number.parseInt(tr.firstElementChild.textContent)) {
                    tr.classList.add(DataSetTable.selectedClassName)
                }
            })
        }
    }

    private handleSampleClick(event: MouseEvent) {
        const row = event.target instanceof HTMLTableRowElement ? event.target : (event.target as HTMLTableCellElement).parentElement
        const idx = Number.parseInt(row.firstElementChild.textContent)

        if (isNaN(idx))
            // Abort processing as no valid row selected
            return

        // Highlight selected row
        row.parentElement.querySelectorAll(`.${DataSetTable.selectedClassName}`)
            .forEach(el => el.classList.remove(DataSetTable.selectedClassName))
        row.classList.add(DataSetTable.selectedClassName)

        this.props.onSampleClick(idx)
    }

    render() {
        return (
            <div style={{overflowX: 'auto'}}>
                <div className={'jp-RenderedHTMLCommon raw-dataset'} ref={this.dfTableRef}
                     dangerouslySetInnerHTML={{__html: this.props.data}}/>
            </div>
        );
    }
}
