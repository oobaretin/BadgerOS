import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectInputType, sanitizeInput, normalizeQuery } from "../detect.ts";
import { getRoutesForQuery } from "../routes.ts";
import { getSourceStatus } from "../sourceStatus.ts";
import type { ReconSourceResult } from "../detect.ts";

describe("detectInputType", () => {
  it("detects email", () => {
    assert.equal(detectInputType("user@example.com"), "email");
  });

  it("detects ipv4", () => {
    assert.equal(detectInputType("8.8.8.8"), "ip");
  });

  it("detects ipv6", () => {
    assert.equal(detectInputType("2001:4860:4860::8888"), "ip");
  });

  it("detects domain and strips protocol", () => {
    assert.equal(detectInputType("https://github.com/repo"), "domain");
    assert.equal(sanitizeInput("https://www.github.com/path"), "github.com");
  });

  it("detects username", () => {
    assert.equal(detectInputType("johndoe"), "username");
  });

  it("detects phone numbers", () => {
    assert.equal(detectInputType("4155552671"), "phone");
    assert.equal(detectInputType("+14155552671"), "phone");
  });

  it("detects VIN and plates", () => {
    assert.equal(detectInputType("1HGBH41JXMN109186"), "plate");
    assert.equal(detectInputType("ABC1234"), "plate");
    assert.equal(detectInputType("AB12CDE"), "plate");
  });
});

describe("getRoutesForQuery", () => {
  it("routes email to breach and threat", () => {
    assert.deepEqual(getRoutesForQuery("email"), ["/api/breach", "/api/threat"]);
  });

  it("routes ip to ip and threat", () => {
    assert.deepEqual(getRoutesForQuery("ip"), ["/api/ip", "/api/threat"]);
  });

  it("routes domain to whois ip threat", () => {
    assert.deepEqual(getRoutesForQuery("domain"), [
      "/api/whois",
      "/api/ip",
      "/api/threat",
    ]);
  });

  it("routes phone to phone module only", () => {
    assert.deepEqual(getRoutesForQuery("phone"), ["/api/phone"]);
  });

  it("routes plate to plate and vin modules", () => {
    assert.deepEqual(getRoutesForQuery("plate"), ["/api/plate", "/api/vin"]);
  });
});

describe("normalizeQuery", () => {
  it("lowercases domain", () => {
    assert.equal(normalizeQuery("domain", "GitHub.COM"), "github.com");
  });

  it("strips phone formatting", () => {
    assert.equal(normalizeQuery("phone", "+1 (415) 555-2671"), "14155552671");
  });

  it("normalizes VIN to uppercase", () => {
    assert.equal(normalizeQuery("plate", "1hgbh41jxmn109186"), "1HGBH41JXMN109186");
  });
});

describe("getSourceStatus", () => {
  it("marks skipped hibp as clean when no breaches", () => {
    const result: ReconSourceResult = {
      source: "/api/breach",
      status: "fulfilled",
      data: {
        source: "Breach Intelligence",
        reputation: { reputation: "none" },
        hibp: { skipped: true, reason: "No API key configured" },
        breachDirectory: { skipped: true, reason: "No API key configured" },
      },
    };
    assert.equal(getSourceStatus(result), "clean");
  });
});
