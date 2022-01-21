import networkx as nx
import numpy as np
from scipy.optimize import linear_sum_assignment
from sklearn.pipeline import Pipeline

from xautoml.models import CandidateId
from xautoml.similarity_flooding import similarity_flooding


def pipeline_to_networkx(pipeline: Pipeline, cid: CandidateId):
    def prefix_name(prefix, name) -> str:
        if prefix:
            return '{}:{}'.format(prefix, name)
        return name

    def convert_component(component, prefix: str, parent_nodes: list[str], edge_labels: list[str] = None) -> list[str]:

        if hasattr(component, 'choice'):
            return convert_component(component.choice, prefix, parent_nodes)

        if hasattr(component, 'column_transformer') or hasattr(component, 'transformers'):
            for p in parent_nodes:
                g.nodes[p]['splitter'] = True

            transformers = []
            for tuple_ in component.transformers:
                if len(tuple_) == 3:
                    name, transformer, cols = tuple_
                else:
                    (name, transformer), cols = tuple_, 'all'
                transformers += convert_component(transformer, prefix_name(prefix, name), parent_nodes,
                                                  [','.join([str(c) for c in cols])])

            return transformers

        if hasattr(component, 'steps'):
            prev = parent_nodes
            labels = edge_labels
            for name, step in component.steps:
                new_nodes = convert_component(step, prefix_name(prefix, name), prev, labels)
                prev = new_nodes
                labels = None
            return prev

        node = prefix_name(prefix, type(component).__name__)
        g.add_node(node,
                   edge_labels={} if edge_labels is None else {p: l for p, l in zip(parent_nodes, edge_labels)},
                   merger=len(parent_nodes) > 1,
                   cids=[cid])
        for p in parent_nodes:
            g.add_edge(p, node)

        return [node]

    g = nx.DiGraph()
    g.add_node('SOURCE', cids=[cid])
    convert_component(pipeline, '', ['SOURCE'])

    return g


def export_json(g: nx.DiGraph):
    nodes = []
    for node, data in g.nodes(data=True):
        nodes.append({
            'id': node,
            'label': node.split(':')[-1],
            'cids': data['cids'],
            'splitter': 'splitter' in data and data['splitter'],
            'merger': 'merger' in data and data['merger'],
            'edge_labels': data['edge_labels'] if 'edge_labels' in data else {},
            'parentIds': list(g.predecessors(node))
        })
    return nodes


class GraphMatching:

    @staticmethod
    def create_structure_history(graphs: list[nx.DiGraph]):
        if len(graphs) == 0:
            return []

        merged = graphs[0]
        history = [export_json(merged)]
        for graph in graphs[1:]:
            merged = GraphMatching.merge_graphs(merged, graph)
            history.append(export_json(merged))

        return merged, history

    @staticmethod
    def merge_graphs(g1: nx.DiGraph, g2: nx.DiGraph):
        equivalence_g1, equivalence_g2 = GraphMatching._compute_node_equivalence(g1, g2)
        merged = nx.DiGraph()

        # Add nodes
        for node, data in g1.nodes(data=True):
            merged.add_node(node, **data)
        for node, data in g2.nodes(data=True):
            if node not in equivalence_g2:
                merged.add_node(node, **data)
            else:
                for key, value in data.items():
                    if key in merged.nodes[node] and isinstance(merged.nodes[node][key], list):
                        merged.nodes[node][key] += value
                    else:
                        merged.nodes[node][key] = value

        # Add edges
        for edge in g1.edges:
            merged.add_edge(*edge)
        for (source, dest) in g2.edges:
            if source in equivalence_g2:
                source = equivalence_g2[source]
            if dest in equivalence_g2:
                dest = equivalence_g2[dest]
            merged.add_edge(source, dest)
        return merged

    @staticmethod
    def _compute_node_equivalence(g1: nx.DiGraph, g2: nx.DiGraph):
        helper_graph = nx.union(g1, g2, rename=('g1-', 'g2-'))
        equivalence_g1 = {}  # maps nodes from g1 to g2
        equivalence_g2 = {}  # maps nodes from g2 to g1
        len_g1 = len(g1.nodes)
        len_g2 = len(g2.nodes)
        similarity_matrix = GraphMatching._compute_node_similarity_matrix(g1, g2)
        try:
            similarity_matrix = similarity_flooding(similarity_matrix, g1, g2, alpha=0.1, n_iter=50)
        except Exception:
            pass
        edit_cost_matrix = GraphMatching._compute_edit_cost_matrix(similarity_matrix, 0.4, 0.4)
        rows, cols = linear_sum_assignment(edit_cost_matrix)
        nodes_g1 = list(g1.nodes)
        nodes_g2 = list(g2.nodes)
        for (row, col) in zip(rows, cols):
            if row >= len_g1 or col >= len_g2:
                continue

            # nodes are equivalent
            eq_g1 = nodes_g1[row]
            eq_g2 = nodes_g2[col]
            merged_helper = nx.algorithms.minors.contracted_nodes(helper_graph, 'g1-' + eq_g1, 'g2-' + eq_g2,
                                                                  self_loops=False)
            try:
                if 'g1-SOURCE' in merged_helper:
                    nx.algorithms.cycles.find_cycle(merged_helper, source='g1-SOURCE')
                if 'g2-SOURCE' in merged_helper:
                    nx.algorithms.cycles.find_cycle(merged_helper, source='g2-SOURCE')
            except nx.NetworkXNoCycle:
                equivalence_g2[eq_g2] = eq_g1
                equivalence_g1[eq_g1] = eq_g2
                helper_graph = merged_helper
        return equivalence_g1, equivalence_g2

    @staticmethod
    def _compute_node_similarity_matrix(g1: nx.DiGraph, g2: nx.DiGraph):
        similarity = np.zeros([len(g1.nodes), len(g2.nodes)])
        for idx_g1, n_g1 in enumerate(g1.nodes):
            for idx_g2, n_g2 in enumerate(g2.nodes):
                # TODO check if similar algorithm type and use 0.5
                similarity[idx_g1, idx_g2] = 1 if n_g1 == n_g2 else 0
        return similarity

    @staticmethod
    def _compute_edit_cost_matrix(similarity_matrix: np.ndarray, add_cost: float, del_cost: float, inf: float = 1000):
        n_nodes_g1, n_nodes_g2 = similarity_matrix.shape
        len_g1_plus_g2 = n_nodes_g1 + n_nodes_g2
        cost_matrix = np.zeros([len_g1_plus_g2, len_g1_plus_g2])

        # Substitution cost (top left) of transforming g2 into g1
        cost_matrix[:n_nodes_g1, :n_nodes_g2] = np.max(similarity_matrix) - similarity_matrix  # cost = 1 - similarity
        # Addition cost (top right) of adding nodes from g1
        addition = inf * np.ones([n_nodes_g1, n_nodes_g1])
        np.fill_diagonal(addition, add_cost)
        cost_matrix[:n_nodes_g1, n_nodes_g2:] = addition
        # Deletion cost (bottom left) of removing nodes from g2
        deletion = inf * np.ones([n_nodes_g2, n_nodes_g2])
        np.fill_diagonal(deletion, del_cost)
        cost_matrix[n_nodes_g1:, :n_nodes_g2] = deletion

        return cost_matrix
