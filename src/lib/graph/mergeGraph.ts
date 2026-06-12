import type { GraphData, GraphEdge, GraphNode } from "./types";

function edgeKey(edge: GraphEdge): string {
  return `${edge.source}|${edge.target}|${edge.label ?? ""}`;
}

export function mergeGraphData(existing: GraphData, incoming: GraphData): GraphData {
  const nodeMap = new Map<string, GraphNode>(existing.nodes.map((n) => [n.id, n]));

  for (const node of incoming.nodes) {
    const prev = nodeMap.get(node.id);
    if (!prev) {
      nodeMap.set(node.id, node);
      continue;
    }
    nodeMap.set(node.id, {
      ...prev,
      label: prev.label || node.label,
      meta: { ...prev.meta, ...node.meta },
    });
  }

  const seenEdges = new Set(existing.edges.map(edgeKey));
  const edges: GraphEdge[] = [...existing.edges];

  for (const edge of incoming.edges) {
    const key = edgeKey(edge);
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    edges.push(edge);
  }

  return { nodes: [...nodeMap.values()], edges };
}
