import React from "react";
import {ReactWidget} from "@jupyterlab/apputils";

class SearchSettings {
    constructor(public filterText: string, public availableOnly: boolean) {
    }
}

interface FilterableProductTableState {
    searchSettings: SearchSettings
    products: Product[]
}

class FilterableProductTable extends React.Component<{}, FilterableProductTableState> {

    constructor(props: any) {
        super(props);

        this.state = {
            searchSettings: new SearchSettings('', false),
            products: []
        }
    }

    componentDidMount() {
        this.setState({
            products: [
                {category: 'Sporting Goods', price: '$49.99', available: true, name: 'Football'},
                {category: 'Sporting Goods', price: '$9.99', available: true, name: 'Baseball'},
                {category: 'Sporting Goods', price: '$29.99', available: false, name: 'Basketball'},
                {category: 'Electronics', price: '$99.99', available: true, name: 'iPod Touch'},
                {category: 'Electronics', price: '$399.99', available: false, name: 'iPhone 5'},
                {category: 'Electronics', price: '$199.99', available: true, name: 'Nexus 7'}
            ]
        })
    }

    handleSearchSettingsChange(searchSettings: SearchSettings) {
        this.setState({
            searchSettings: searchSettings
        });
    }

    render() {
        return (
            <>
                <SearchBar searchSettings={this.state.searchSettings}
                           onSettingsChange={(e) => this.handleSearchSettingsChange(e)}/>
                <ProductTable products={this.state.products} searchSettings={this.state.searchSettings}/>
            </>
        )
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

export class DemoWidget extends ReactWidget {

    constructor() {
        super();
    }

    render(): JSX.Element {
        return <FilterableProductTable/>;
    }
}