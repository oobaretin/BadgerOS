export type NodeType =
  | "email"
  | "ip"
  | "domain"
  | "username"
  | "breach"
  | "phone"
  | "plate"
  | "url"
  | "org";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  meta: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
