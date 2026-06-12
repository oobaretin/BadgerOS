import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGraph } from "../graph/buildGraph.ts";
import { buildReportFromRecon } from "../reports.ts";
import type { ReconResponse } from "../detect.ts";

describe("buildGraph", () => {
  it("builds nodes and edges from wrapped report modules", () => {
    const response: ReconResponse = {
      type: "email",
      query: "alice@example.com",
      results: [
        {
          source: "/api/breach",
          status: "fulfilled",
          data: {
            hibp: [{ Name: "ExampleCorp", BreachDate: "2020-01-01", DataClasses: ["Emails"] }],
          },
        },
        {
          source: "/api/whois",
          status: "fulfilled",
          data: {
            dns: { Answer: [{ type: 1, data: "93.184.216.34" }] },
          },
        },
      ],
    };

    const report = buildReportFromRecon(response);
    const graph = buildGraph(report);

    assert.equal(graph.nodes[0]?.id, "alice@example.com");
    assert.ok(graph.nodes.some((n) => n.id === "breach:ExampleCorp"));
    assert.ok(graph.nodes.some((n) => n.id === "ip:93.184.216.34"));
    assert.ok(graph.edges.some((e) => e.label === "found in"));
  });
});
