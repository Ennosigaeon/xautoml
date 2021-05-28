import React from "react";
import {ReactWidget} from "@jupyterlab/apputils";
import {IRenderMime} from "@jupyterlab/rendermime-interfaces";
import {requestAPI} from "./handler";

class SearchSettings {
    constructor(public filterText: string, public availableOnly: boolean) {
    }
}

interface FilterableProductProps {
    products: Product[]
}

interface FilterableProductTableState {
    searchSettings: SearchSettings
    message: String
}

class FilterableProductTable extends React.Component<FilterableProductProps, FilterableProductTableState> {

    constructor(props: any) {
        super(props);

        this.state = {
            searchSettings: new SearchSettings('', false),
            message: undefined
        }
    }

    componentDidMount() {
        requestAPI<any>('get_example')
            .then(data => {
                this.setState({message: data["data"]})
            })
            .catch(reason => {
                this.setState({message: `The xautoml server extension appears to be missing.\n${reason}`})
            });
    }

    handleSearchSettingsChange(searchSettings: SearchSettings) {
        this.setState({
            searchSettings: searchSettings
        });
    }

    render() {
        if (this.state.message !== undefined) {
            return (<>
                <p>{this.state.message}</p>
                <SearchBar searchSettings={this.state.searchSettings}
                           onSettingsChange={(e) => this.handleSearchSettingsChange(e)}/>
                <ProductTable products={this.props.products} searchSettings={this.state.searchSettings}/>
            </>)
        } else {
            return (<p>Loading...</p>)
        }
    }
}

interface SearchBarProps {
    searchSettings: SearchSettings,
    onSettingsChange: (settings: SearchSettings) => void
}

class SearchBar extends React.Component<SearchBarProps> {

    render() {
        return (
            <div>
                <input type="text" placeholder="Search..." value={this.props.searchSettings.filterText}
                       onChange={event => {
                           this.props.searchSettings.filterText = event.target.value;
                           this.props.onSettingsChange(this.props.searchSettings)
                       }}/>
                <div>
                    <input type="checkbox" id="stock" checked={this.props.searchSettings.availableOnly}
                           onChange={event => {
                               this.props.searchSettings.availableOnly = event.target.checked;
                               this.props.onSettingsChange(this.props.searchSettings)
                           }}/>
                    <label htmlFor="stock">Only show products in stock</label>
                </div>
            </div>
        );
    }
}

interface Product {
    name: string
    price: string
    category: string
    available: boolean
}

interface ProductTableProps {
    products: Product[]
    searchSettings: SearchSettings
}

class ProductTable extends React.Component<ProductTableProps> {

    render() {
        let lastCategory: string = null
        const rows: React.ReactNode[] = []

        this.props.products.forEach((product) => {
            if (product.name.indexOf(this.props.searchSettings.filterText) === -1 ||
                (this.props.searchSettings.availableOnly && !product.available)) {
                return;
            }
            if (product.category !== lastCategory) {
                rows.push(<ProductCategoryRow category={product.category}/>)
                lastCategory = product.category
            }
            rows.push(<ProductRow product={product}/>)
        });

        return (
            <table>
                <thead>
                <tr>
                    <th>Name</th>
                    <th>Price</th>
                </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        )
    }
}

interface ProductCategoryRowProps {
    category: string
}

class ProductCategoryRow extends React.Component<ProductCategoryRowProps> {

    render() {
        return (
            <tr key={this.props.category}>
                <td colSpan={2}>{this.props.category}</td>
            </tr>
        )
    }

}

interface ProductRowProps {
    product: Product
}

class ProductRow extends React.Component<ProductRowProps> {

    render() {
        return (
            <tr style={{color: this.props.product.available ? "" : "red"}}
                key={`${this.props.product.category}_${this.props.product.name}`}>
                <td>{this.props.product.name}</td>
                <td>{this.props.product.price}</td>
            </tr>
        )
    }
}

/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'mimerenderer-xautoml';

/**
 * A widget for rendering application/xautoml.
 */
export class OutputWidget extends ReactWidget implements IRenderMime.IRenderer {
    private readonly _mimeType: string;
    private data: Product[] = undefined;

    constructor(options: IRenderMime.IRendererOptions) {
        super();
        this._mimeType = options.mimeType;
        this.addClass(CLASS_NAME);
    }

    renderModel(model: IRenderMime.IMimeModel): Promise<void> {
        // TODO model.data cast is not typesafe
        this.data = model.data[this._mimeType] as unknown as Product[];

        // Trigger call of render().
        this.onUpdateRequest(undefined);
        return this.renderPromise;
    }

    protected render() {
        return <FilterableProductTable products={this.data}/>
    }
}