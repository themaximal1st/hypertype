import Node from "./node.js";
// import merge from "lodash/merge.js";

// import { suggest } from "./llm.js";

// import { mergeGraphs, stringToColor } from "./utils";
// import Node from "./Node";
import { arrayContains } from "./utils.js";

export default class Hyperedge {
    constructor(nodes, hypergraph) {
        this.nodes = nodes.map(node => Node.create(node, hypergraph));
        this.hypergraph = hypergraph;
    }

    get id() {
        return Hyperedge.id(this.nodes.map(node => node.id))
    }

    get symbols() {
        return this.nodes.map(node => node.symbol);
    }

    equal(hyperedge) {
        if (hyperedge instanceof Hyperedge) {
            return this.id === hyperedge.id;
        } else if (Array.isArray(hyperedge)) {
            return this.id === Hyperedge.id(hyperedge);
        }

        return false;
    }

    get(input) {
        for (const node of this.nodes) {
            if (node.equal(input)) {
                return node;
            }
        }

        return null;
    }

    has(input) {
        if (input instanceof Node) {
            return this.symbols.includes(input.symbol);
        } else if (typeof input === "string") {
            return this.symbols.includes(input);
        } else if (input instanceof Hyperedge) {
            return arrayContains(this.symbols, input.symbols);
        } else if (Array.isArray(input)) {
            return arrayContains(this.symbols, input);
        }

        return false;
    }

    hyperedges() {
        return Object.values(this.hypergraph._hyperedges).filter(hyperedge => hyperedge.has(this));
    }

    static create(hyperedge, hypergraph) {
        if (hyperedge instanceof Hyperedge) { return hyperedge }
        return new Hyperedge(hyperedge, hypergraph);
    }

    static id(symbols) {
        return symbols.join("->");
    }

    /*
    prevNode(index) {
        if (index === 0) {
            return null;
        }
 
        return this.createNode(this.symbols[index - 1], index - 1);
    }
 
    nextNode() {
        if (index === this.length - 1) {
            return null;
        }
 
        return this.createNode(this.symbols[index + 1], index + 1);
    }
 
    startNode() {
        return this.nodes[0];
    }
 
    endNode() {
        return this.nodes[this.nodes.length - 1];
    }
 
    containsSymbol(symbol) {
        return this.symbols.includes(symbol);
    }
    */


}



class Hyperedge1 {



    async suggest(options = {}) {
        const llmOptions = merge({}, this.hypergraph.options.llm, options);
        const symbols = await suggest(this.symbol, llmOptions);
        const nodes = await Promise.all(symbols.map(symbol => Node.create(symbol, this.hypergraph)));
        return nodes.filter(node => {
            if (this.has(node)) return false;
            if (node.symbol === this.symbol) return false;
            return true;
        });
    }

    async similar(num = 3, threshold = 1.0) {
        const matches = await this.hypergraph.vectordb.search(this.symbol, num, threshold);

        const results = [];
        for (const match of matches) {
            if (match.input == this.symbol) continue;
            for (const hyperedge of this.hypergraph.hyperedges) {
                if (hyperedge.symbol == match.input) {
                    results.push({ distance: match.distance, hyperedge });
                }
            }
        }

        results.sort((a, b) => a.distance - b.distance);

        return results;
    }

    static id(nodes) {
        return nodes.map(node => Node.id(node)).join(",");
    }

    static symbol(nodes) {
        return nodes.map(node => (node instanceof Node ? node.symbol : symbol)).join(" ");
    }

    static has(nodes, hypergraph) {
        const id = Hyperedge.id(nodes);
        const hyperedge_ids = Object.keys(hypergraph._hyperedges);
        for (const hyperedge_id of hyperedge_ids) {
            if (hyperedge_id.indexOf(id) !== -1) {
                return true;
            }
        }

        return false;
    }

    static get(nodes, hypergraph) {
        const id = Hyperedge.id(nodes);
        let hyperedge = hypergraph._hyperedges[id];

        // full match
        if (hyperedge) {
            return hyperedge;
        }

        // partial match
        hyperedge = [];
        for (const n of nodes) {
            const node = Node.get(n, hypergraph);
            if (!node) { return null }
            hyperedge.push(node);
        }

        return new Hyperedge(hyperedge, hypergraph);
    }

    static async add(nodes, hypergraph) {
        const hyperedge = await Hyperedge.create(nodes, hypergraph);
        for (const node of hyperedge.nodes) {
            await Node.add(node, hypergraph);
        }

        hypergraph._hyperedges[hyperedge.id()] = hyperedge;

        return hyperedge;
    }

    static async create(nodes, hypergraph) {
        if (nodes instanceof Hyperedge) { return hyperedge }

        const edge = await Promise.all(nodes.map(node => Node.create(node, hypergraph)));
        const hyperedge = new Hyperedge(edge, hypergraph);

        await hypergraph.vectordb.add(hyperedge.symbol);
        return hyperedge;
    }
}
