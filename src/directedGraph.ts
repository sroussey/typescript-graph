import { NodeDoesntExistError } from './errors'
import { Graph } from './graph'

/**
 * # DirectedGraph
 *
 * A DirectedGraph is similar a [[`Graph`]] but with additional functionality.
 *
 * @typeParam T `T` is the node type of the graph. Nodes can be anything in all the included examples they are simple objects.
 */
export class DirectedGraph<T, E = true, TI = unknown> extends Graph<T, E, TI> {
  /** Caches if the graph contains a cycle. If `undefined` then it is unknown. */
  protected hasCycle: boolean = false

  /**
   * Returns `true` if there are no cycles in the graph.
   * This relies on a cached value so calling it multiple times without adding edges to the graph should be O(1) after the first call.
   * Non-cached calls are potentially expensive, the implementation is based on Kahn's algorithim which is O(|EdgeCount| + |NodeCount|).
   */
  isAcyclic(): boolean {
    if (this.hasCycle !== undefined) {
      return !this.hasCycle
    }

    const nodeIndices = Array.from(this.nodes.keys())
    const nodeInDegrees = new Map(
      Array.from(this.nodes.keys()).map((n) => [n, this.indegreeOfNode(n)]),
    )

    const toSearch = Array.from(nodeInDegrees).filter((pair) => pair[1] === 0)

    let visitedNodes = 0

    while (toSearch.length > 0) {
      const cur = toSearch.pop()
      if (cur === undefined) {
        continue
      }

      const nodeIndex = nodeIndices.indexOf(cur[0])
      this.adjacency[nodeIndex].forEach((hasAdj, index) => {
        if (hasAdj !== null) {
          const currentInDegree = nodeInDegrees.get(nodeIndices[index])
          if (currentInDegree !== undefined) {
            nodeInDegrees.set(nodeIndices[index], currentInDegree - 1)
            if (currentInDegree - 1 === 0) {
              toSearch.push([nodeIndices[index], currentInDegree - 1])
            }
          }
        }
      })

      visitedNodes++
    }

    this.hasCycle = !(visitedNodes === this.nodes.size)

    return visitedNodes === this.nodes.size
  }

  /**
   * The indegree of a node is the number of edges that point to it. This will always be an integer.
   *
   * Throws a [[`NodeDoesntExistError`]] the node does not exist.
   *
   * @param nodeID The string of the node identity of the node to calculate indegree for.
   */
  indegreeOfNode(nodeID: TI): number {
    const nodeIdentities = Array.from(this.nodes.keys())
    const indexOfNode = nodeIdentities.indexOf(nodeID)

    if (indexOfNode === -1) {
      throw new NodeDoesntExistError(nodeID)
    }

    return this.adjacency.reduce<number>((carry, row) => {
      return carry + (row[indexOfNode] == null ? 0 : 1)
    }, 0)
  }

  /**
   * Add a directed edge to the graph.
   *
   * @param fromNodeIdentity The identity string of the node the edge should run from.
   * @param toNodeIdentity The identity string of the node the edge should run to.
   * @param skipUpdatingCyclicality This boolean indicates if the cache of the cyclicality of the graph should be updated.
   * If `false` is passed the cached will be invalidated because we can not assure that a cycle has not been created.
   */
  addEdge(
    fromNodeIdentity: TI,
    toNodeIdentity: TI,
    edge?: E,
    skipUpdatingCyclicality: boolean = false,
  ): void {
    if (!this.hasCycle && !skipUpdatingCyclicality) {
      this.hasCycle = this.wouldAddingEdgeCreateCycle(fromNodeIdentity, toNodeIdentity)
    } else if (skipUpdatingCyclicality) {
      this.hasCycle = false
    }

    super.addEdge(fromNodeIdentity, toNodeIdentity, edge)
  }

  /**
   * Depth first search to see if one node is reachable from another following the directed edges.
   *
   * __Caveat:__ This will return false if `startNode` and `endNode` are the same node and the is not a cycle or a loop edge connecting them.
   *
   * @param startNode The string identity of the node to start at.
   * @param endNode The string identity of the node we are attempting to reach.
   */
  canReachFrom(startNode: TI, endNode: TI): boolean {
    const nodeIdentities = Array.from(this.nodes.keys())
    const startNodeIndex = nodeIdentities.indexOf(startNode)
    const endNodeIndex = nodeIdentities.indexOf(endNode)

    if (this.adjacency[startNodeIndex][endNodeIndex] != null) {
      return true
    }

    return this.adjacency[startNodeIndex].reduce<boolean>((carry, edge, index) => {
      if (carry || edge === null) {
        return carry
      }

      return this.canReachFrom(nodeIdentities[index], endNode)
    }, false)
  }

  /**
   * Checks if adding the specified edge would create a cycle.
   * Returns true in O(1) if the graph already contains a known cycle, or if `fromNodeIdentity` and `toNodeIdentity` are the same.
   *
   * @param fromNodeIdentity The string identity of the node the edge is from.
   * @param toNodeIdentity The string identity of the node the edge is to.
   */
  wouldAddingEdgeCreateCycle(fromNodeIdentity: TI, toNodeIdentity: TI): boolean {
    return (
      this.hasCycle ||
      fromNodeIdentity === toNodeIdentity ||
      this.canReachFrom(toNodeIdentity, fromNodeIdentity)
    )
  }

  /**
   * Given a starting node this returns a new [[`DirectedGraph`]] containing all the nodes that can be reached.
   * Throws a [[`NodeDoesntExistError`]] if the start node does not exist.
   *
   * @param startNodeIdentity The string identity of the node from which the subgraph search should start.
   */
  getSubGraphStartingFrom(startNodeIdentity: TI): DirectedGraph<T, E> {
    const nodeIndices = Array.from(this.nodes.keys())
    const initalNode = this.nodes.get(startNodeIdentity)

    if (initalNode == null) {
      throw new NodeDoesntExistError(startNodeIdentity)
    }

    const recur = (startNodeIdentity: TI, nodesToInclude: T[]): T[] => {
      let toReturn = [...nodesToInclude]
      const nodeIndex = nodeIndices.indexOf(startNodeIdentity)
      this.adjacency[nodeIndex].forEach((hasAdj, index) => {
        if (
          hasAdj !== null &&
          nodesToInclude.find((n) => this.nodeIdentity(n) === nodeIndices[index]) == null
        ) {
          const newNode = this.nodes.get(nodeIndices[index])

          if (newNode != null) {
            toReturn = [...recur(nodeIndices[index], toReturn), newNode]
          }
        }
      })

      return toReturn
    }

    const newGraph = new DirectedGraph<T, E>(this.nodeIdentity)
    const nodeList = recur(startNodeIdentity, [initalNode])
    const includeIdents = nodeList.map((t) => this.nodeIdentity(t))
    Array.from(this.nodes.values()).forEach((n) => {
      if (includeIdents.includes(this.nodeIdentity(n))) {
        newGraph.insert(n)
      }
    })
    newGraph.adjacency = this.subAdj(nodeList)
    return newGraph
  }

  private subAdj(include: T[]): Array<Array<E | null>> {
    const includeIdents = include.map((t) => this.nodeIdentity(t))
    const nodeIndices = Array.from(this.nodes.keys())

    return this.adjacency.reduce<Array<Array<E | null>>>((carry, cur, index) => {
      if (includeIdents.includes(nodeIndices[index])) {
        return [...carry, cur.filter((_, index) => includeIdents.includes(nodeIndices[index]))]
      } else {
        return carry
      }
    }, [])
  }

  /**
   * Returns all edges in the graph as an array of tuples.
   */
  getEdges(): Array<[fromNodeIdentity: TI, toNodeIdentity: TI, edge: E]> {
    return super.getEdges()
  }

  /**
   * Deletes an edge between two nodes in the graph.
   * Throws a [[`NodeDoesNotExistsError`]] if either of the nodes do not exist.
   *
   * @param fromNodeIdentity The identity of the from node
   * @param toNodeIdentity The identity of the to node
   */
  removeEdge(fromNodeIdentity: TI, toNodeIdentity: TI): void {
    super.removeEdge(fromNodeIdentity, toNodeIdentity)

    // Invalidate the cycle cache as the graph structure has changed
    this.hasCycle = false
  }

  /**
   * Deletes a node from the graph, along with any edges associated with it.
   * Throws a [[`NodeDoesNotExistsError`]] if the node does not exist.
   *
   * @param nodeIdentity The identity of the node to be deleted.
   */
  remove(nodeIdentity: TI): void {
    super.remove(nodeIdentity)

    // Invalidate the cycle cache as the graph structure has changed
    this.hasCycle = false
  }
}
