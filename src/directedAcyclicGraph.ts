import { DirectedGraph } from './directedGraph'
import { CycleError } from './errors'
import { type InternalEdge } from './graph'

/**
 * # DirectedAcyclicGraph
 *
 * A DirectedAcyclicGraph is builds on a [[`DirectedGraph`]] but enforces acyclicality. You cannot add an edge to a DirectedAcyclicGraph that would create a cycle.
 *
 * @typeParam T `T` is the node type of the graph. Nodes can be anything in all the included examples they are simple objects.
 */
export class DirectedAcyclicGraph<T, E = true, TI = unknown, EI = unknown> extends DirectedGraph<
  T,
  E,
  TI,
  EI
> {
  private _topologicallySortedNodes?: T[]
  protected hasCycle = false

  /**
   * Converts an existing directed graph into a directed acyclic graph.
   * Throws a {@linkcode CycleError} if the graph attempting to be converted contains a cycle.
   * @param graph The source directed graph to convert into a DAG
   */
  static fromDirectedGraph<T, E>(graph: DirectedGraph<T, E>): DirectedAcyclicGraph<T, E> {
    if (!graph.isAcyclic()) {
      throw new CycleError("Can't convert that graph to a DAG because it contains a cycle")
    }
    const toRet = new DirectedAcyclicGraph<T, E>()

    toRet.nodes = (graph as any).nodes
    toRet.adjacency = (graph as any).adjacency

    return toRet
  }

  /**
   * Adds an edge to the graph similarly to [[`DirectedGraph.addEdge`]] but maintains correctness of the acyclic graph.
   * Thows a [[`CycleError`]] if adding the requested edge would create a cycle.
   * Adding an edge invalidates the cache of topologically sorted nodes, rather than updating it.
   *
   * @param fromNodeIdentity The identity string of the node the edge should run from.
   * @param toNodeIdentity The identity string of the node the edge should run to.
   */
  addEdge(fromNodeIdentity: TI, toNodeIdentity: TI, edge: InternalEdge<E> = true): EI {
    if (this.wouldAddingEdgeCreateCycle(fromNodeIdentity, toNodeIdentity)) {
      throw new CycleError(
        `Can't add edge from ${String(fromNodeIdentity)} to ${String(
          toNodeIdentity,
        )} it would create a cycle`,
      )
    }

    // Invalidate cache of toposorted nodes
    this._topologicallySortedNodes = undefined
    return super.addEdge(fromNodeIdentity, toNodeIdentity, edge, true)
  }

  /**
   * Inserts a node into the graph and maintains topologic sort cache by prepending the node
   * (since all newly created nodes have an [[ indegreeOfNode | indegree ]] of zero.)
   *
   * @param node The node to insert
   */
  insert(node: T): TI {
    if (this._topologicallySortedNodes !== undefined) {
      this._topologicallySortedNodes = [node, ...this._topologicallySortedNodes]
    }

    return super.insert(node)
  }

  /**
   * Topologically sort the nodes using Kahn's algorithim. Uses a cache which means that repeated calls should be O(1) after the first call.
   * Non-cached calls are potentially expensive, Kahn's algorithim is O(|EdgeCount| + |NodeCount|).
   * There may be more than one valid topological sort order for a single graph,
   * so just because two graphs are the same does not mean that order of the resultant arrays will be.
   *
   * @returns An array of nodes sorted by the topological order.
   */
  topologicallySortedNodes(): T[] {
    if (this._topologicallySortedNodes !== undefined) {
      return this._topologicallySortedNodes
    }

    const nodeIndices = Array.from(this.nodes.keys())
    const nodeInDegrees = new Map(
      Array.from(this.nodes.keys()).map((n) => [n, this.indegreeOfNode(n)]),
    )

    const adjCopy = this.adjacency.map((a) => [...a])

    const toSearch = Array.from(nodeInDegrees).filter((pair) => pair[1] === 0)

    if (toSearch.length === this.nodes.size) {
      const arrayOfNodes = Array.from(this.nodes.values())
      this._topologicallySortedNodes = arrayOfNodes
      return arrayOfNodes
    }

    const toReturn: T[] = []

    while (toSearch.length > 0) {
      const n = toSearch.pop()
      if (n === undefined) {
        throw new Error('Unexpected empty array')
      }
      const curNode = this.nodes.get(n[0])
      if (curNode == null) {
        throw new Error('This should never happen')
      }
      toReturn.push(curNode)

      adjCopy[nodeIndices.indexOf(n[0])]?.forEach((edge, index) => {
        if (edge !== null) {
          adjCopy[nodeIndices.indexOf(n[0])][index] = null
          const target = nodeInDegrees.get(nodeIndices[index])
          if (target !== undefined) {
            nodeInDegrees.set(nodeIndices[index], target - 1)
            if (target - 1 === 0) {
              toSearch.push([nodeIndices[index], 0])
            }
          } else {
            throw new Error('This should never happen')
          }
        }
      })
    }

    // Update cache
    this._topologicallySortedNodes = toReturn

    // we shouldn't need to account for the error case of there being a cycle because it shouldn't
    // be possible to instantiate this class in a state (or put it in a state) where there is a cycle.

    return toReturn
  }

  /**
   * Given a starting node this returns a new [[`DirectedA`]] containing all the nodes that can be reached.
   * Throws a [[`NodeDoesntExistError`]] if the start node does not exist.
   *
   * @param startNodeIdentity The string identity of the node from which the subgraph search should start.
   */
  getSubGraphStartingFrom(startNodeIdentity: TI): DirectedAcyclicGraph<T, E> {
    return DirectedAcyclicGraph.fromDirectedGraph(super.getSubGraphStartingFrom(startNodeIdentity))
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

    // Invalidate the topologically sorted nodes cache
    this._topologicallySortedNodes = undefined
  }

  /**
   * Deletes a node from the graph, along with any edges associated with it.
   * Throws a [[`NodeDoesNotExistsError`]] if the node does not exist.
   *
   * @param nodeIdentity The identity of the node to be deleted.
   */
  remove(nodeIdentity: TI): void {
    super.remove(nodeIdentity)

    // Invalidate the topologically sorted nodes cache
    this._topologicallySortedNodes = undefined
  }
}
