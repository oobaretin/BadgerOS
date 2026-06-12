"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode } from "@/lib/graph";

const TYPE_COLORS: Record<string, string> = {
  email: "#185FA5",
  ip: "#854F0B",
  domain: "#3B6D11",
  username: "#534AB7",
  breach: "#993C1D",
  phone: "#888780",
  url: "#993556",
  org: "#0F6E56",
  plate: "#BA7517",
};

const NODE_RADIUS: Record<string, number> = {
  email: 20,
  domain: 16,
  ip: 14,
  username: 12,
  breach: 12,
  phone: 12,
  url: 10,
  org: 14,
  plate: 12,
};

type SimNode = GraphNode & d3.SimulationNodeDatum;
type SimLink = d3.SimulationLinkDatum<SimNode> & { label?: string };

interface Props {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
}

export function RelationshipGraph({ data, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const W = svgRef.current.clientWidth || 700;
    const H = 500;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", W)
      .attr("height", H);

    const g = svg.append("g");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => {
          g.attr("transform", event.transform.toString());
        })
    );

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#B4B2A9");

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const edges: SimLink[] = data.edges.map((e) => ({ ...e }));

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(edges)
          .id((d) => d.id)
          .distance(100)
          .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide<SimNode>().radius(30));

    const link = g
      .append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", "#B4B2A9")
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrow)");

    const linkLabel = g
      .append("g")
      .selectAll("text")
      .data(edges)
      .join("text")
      .attr("font-size", 9)
      .attr("fill", "#888780")
      .attr("text-anchor", "middle")
      .text((d) => d.label ?? "");

    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("click", (_, d) => {
        setSelected(d);
        onNodeClick?.(d);
      });

    node
      .append("circle")
      .attr("r", (d) => NODE_RADIUS[d.type] ?? 12)
      .attr("fill", (d) => TYPE_COLORS[d.type] ?? "#888")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.9);

    node
      .append("text")
      .attr("y", (d) => (NODE_RADIUS[d.type] ?? 12) + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("font-family", "monospace")
      .attr("fill", "var(--foreground)")
      .text((d) => (d.label.length > 20 ? `${d.label.slice(0, 18)}…` : d.label));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      linkLabel
        .attr("x", (d) => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
        .attr("y", (d) => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, onNodeClick]);

  if (!data.nodes.length) {
    return (
      <p className="text-sm text-muted">Not enough data to build a relationship graph yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1 text-xs text-muted">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {type}
          </div>
        ))}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full"
          style={{ height: 500, background: "var(--surface-elevated)" }}
        />
      </div>

      {selected && (
        <div className="border border-border rounded-xl bg-surface p-3 text-sm space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: TYPE_COLORS[selected.type] ?? "#888" }}
            />
            <span className="font-medium font-mono">{selected.label}</span>
            <span className="text-xs text-muted ml-auto">{selected.type}</span>
          </div>
          {Object.entries(selected.meta ?? {})
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs gap-4">
                <span className="text-muted">{k}</span>
                <span className="font-mono text-right break-all">
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
