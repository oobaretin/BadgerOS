import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeGraphData } from "../graph/mergeGraph.ts";

describe("mergeGraphData", () => {
  it("deduplicates nodes by id and merges meta", () => {
    const base = {
      nodes: [{ id: "a", label: "A", type: "domain" as const, meta: { source: "dns" } }],
      edges: [{ source: "root", target: "a", label: "A record" }],
    };
    const incoming = {
      nodes: [{ id: "a", label: "A", type: "domain" as const, meta: { country: "US" } }],
      edges: [{ source: "root", target: "a", label: "A record" }],
    };

    const merged = mergeGraphData(base, incoming);
    assert.equal(merged.nodes.length, 1);
    assert.equal(merged.nodes[0]?.meta.source, "dns");
    assert.equal(merged.nodes[0]?.meta.country, "US");
    assert.equal(merged.edges.length, 1);
  });

  it("appends unique edges only", () => {
    const base = {
      nodes: [
        { id: "root", label: "root", type: "email" as const, meta: {} },
        { id: "ip:1.1.1.1", label: "1.1.1.1", type: "ip" as const, meta: {} },
      ],
      edges: [{ source: "root", target: "ip:1.1.1.1", label: "resolves to" }],
    };
    const incoming = {
      nodes: [
        { id: "root", label: "root", type: "domain" as const, meta: {} },
        { id: "ip:1.1.1.1", label: "1.1.1.1", type: "ip" as const, meta: {} },
        { id: "org:Cloudflare", label: "Cloudflare", type: "org" as const, meta: {} },
      ],
      edges: [
        { source: "root", target: "ip:1.1.1.1", label: "resolves to" },
        { source: "ip:1.1.1.1", target: "org:Cloudflare", label: "hosted by" },
      ],
    };

    const merged = mergeGraphData(base, incoming);
    assert.equal(merged.nodes.length, 3);
    assert.equal(merged.edges.length, 2);
  });
});
