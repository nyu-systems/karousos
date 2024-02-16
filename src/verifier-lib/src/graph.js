const assert = require('assert');
const findCycle = require('find-cycle/directed')

// The graph we use for consistent ordering verification

class Graph {

    constructor() {
        // The edges in the graph. Map from nodes to the nodes that they have edges to
        this.edges = {};
        // A node that has in-degree 0. Needed by find_cycle to check acyclicity 
        this.first;
    }

    addFirst(v1) {
        if (this.first == undefined) {
            this.first = v1;
        }
    }

    //add edge v1 -> v2
    addEdge(v1, v2) {
        // initialize first if it is not initialized
        if (this.first == undefined) {
            this.first = v1;
        }
        // add v2 to edges[v1]
        if (this.edges[v1] == undefined) {
            this.edges[v1] = [v2];
        } else {
            this.edges[v1].push(v2)
        }
    }

    //check acyclic with find_cycle
    checkAcyclic(print) {
        try {
            const startNodes = [this.first]
            const getConnectedNodes = node => this.edges[node]
            var cycle = findCycle(startNodes, getConnectedNodes);
            assert(cycle == null);
        } catch (err) {
            console.log("Error: Found cycle. The cycle is:");
            console.log(cycle.toString());
            process.exit()
        }
        return;
    }
}

exports.Graph = Graph;