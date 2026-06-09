import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractPivots } from "../deepResearch/extractPivots.ts";
import type { ReconResponse } from "../detect.ts";

function mockResponse(partial: Partial<ReconResponse>): ReconResponse {
  return {
    type: "domain",
    query: "example.com",
    results: [],
    ...partial,
  };
}

describe("extractPivots", () => {
  it("pivots email domain for corporate addresses", () => {
    const primary = mockResponse({
      type: "email",
      query: "alice@acme-corp.com",
      results: [],
    });

    const pivots = extractPivots(primary);
    assert.ok(pivots.some((p) => p.type === "domain" && p.value === "acme-corp.com"));
  });

  it("skips free email provider domain pivots", () => {
    const primary = mockResponse({
      type: "email",
      query: "alice@gmail.com",
      results: [],
    });

    const pivots = extractPivots(primary);
    assert.equal(pivots.length, 0);
  });

  it("extracts subdomains from certificate transparency", () => {
    const primary = mockResponse({
      type: "domain",
      query: "github.com",
      results: [
        {
          source: "/api/whois",
          status: "fulfilled",
          data: {
            certificates: [{ name_value: "api.github.com\n*.github.com" }],
            dns: { Answer: [{ data: "140.82.121.4" }] },
            mx: { Answer: [{ data: "10 alt1.aspmx.l.google.com." }] },
          },
        },
      ],
    });

    const pivots = extractPivots(primary);
    assert.ok(pivots.some((p) => p.value === "api.github.com"));
    assert.ok(pivots.some((p) => p.value === "140.82.121.4"));
    assert.ok(pivots.every((p) => p.value !== "github.com"));
  });

  it("extracts hostnames from IP quick scan", () => {
    const primary = mockResponse({
      type: "ip",
      query: "8.8.8.8",
      results: [
        {
          source: "/api/ip",
          status: "fulfilled",
          data: {
            target: "8.8.8.8",
            quickScan: { hostnames: ["dns.google"] },
          },
        },
      ],
    });

    const pivots = extractPivots(primary);
    assert.ok(pivots.some((p) => p.value === "dns.google"));
  });
});
