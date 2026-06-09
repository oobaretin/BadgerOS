import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReportFromRecon, persistReconReport } from "../reports.ts";
import type { ReconResponse } from "../detect.ts";
import db from "../db.ts";

describe("reports", () => {
  it("builds report with risk score and tags from recon results", () => {
    const response: ReconResponse = {
      type: "email",
      query: "alice@example.com",
      results: [
        {
          source: "/api/breach",
          status: "fulfilled",
          data: { hibp: [{ Name: "Example" }] },
        },
        {
          source: "/api/threat",
          status: "fulfilled",
          data: { virusTotal: { skipped: true } },
        },
      ],
    };

    const report = buildReportFromRecon(response);
    assert.equal(report.query, "alice@example.com");
    assert.equal(report.query_type, "email");
    assert.equal(report.risk_score, "medium");
    assert.ok(report.tags.includes("email"));
    assert.ok(report.tags.includes("breach"));
    assert.ok(report.modules.breach);
  });

  it("persists report to sqlite and returns id", () => {
    const before = (db.prepare("select count(*) as n from reports").get() as { n: number }).n;

    const id = persistReconReport({
      type: "domain",
      query: "example.com",
      results: [
        {
          source: "/api/whois",
          status: "fulfilled",
          data: { rdap: { ldhName: "EXAMPLE.COM" } },
        },
      ],
    });

    assert.match(id, /^[0-9a-f-]{36}$/i);

    const after = (db.prepare("select count(*) as n from reports").get() as { n: number }).n;
    assert.equal(after, before + 1);

    const row = db
      .prepare("select query, query_type from reports where id = ?")
      .get(id) as { query: string; query_type: string };
    assert.equal(row.query, "example.com");
    assert.equal(row.query_type, "domain");
  });
});
