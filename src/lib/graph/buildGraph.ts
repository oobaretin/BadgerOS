import type { ReconReport } from "@/lib/buildReport";
import type { GraphData, GraphEdge, GraphNode, NodeType } from "./types";

export type { GraphData, GraphEdge, GraphNode, NodeType } from "./types";

const ROOT_NODE_TYPES = new Set<NodeType>([
  "email",
  "ip",
  "domain",
  "username",
  "phone",
  "plate",
]);

function rootNodeType(queryType: string): NodeType {
  return ROOT_NODE_TYPES.has(queryType as NodeType) ? (queryType as NodeType) : "domain";
}

function moduleData(report: ReconReport, key: string): Record<string, unknown> | undefined {
  const mod = report.modules[key] as { data?: Record<string, unknown> } | undefined;
  return mod?.data;
}

function hibpBreaches(hibp: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(hibp)) return hibp as Array<Record<string, unknown>>;
  if (hibp && typeof hibp === "object") {
    const breaches = (hibp as { breaches?: unknown }).breaches;
    if (Array.isArray(breaches)) return breaches as Array<Record<string, unknown>>;
  }
  return [];
}

function splitCertNames(nameValue: unknown): string[] {
  if (typeof nameValue !== "string" || !nameValue.trim()) return [];
  return [...new Set(nameValue.split(/\n/).map((s) => s.trim()).filter(Boolean))];
}

export function buildGraph(report: ReconReport): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  function addNode(id: string, label: string, type: NodeType, meta: Record<string, unknown> = {}) {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, label, type, meta });
  }

  function addEdge(source: string, target: string, label?: string) {
    edges.push({ source, target, label });
  }

  const root = report.query;
  const rootType = rootNodeType(report.query_type);
  addNode(root, root, rootType, report.summary);

  const breach = moduleData(report, "breach");
  if (breach) {
    for (const item of hibpBreaches(breach.hibp)) {
      const name = String(item.Name ?? item.name ?? "Unknown breach");
      const bid = `breach:${name}`;
      addNode(bid, name, "breach", {
        date: item.BreachDate ?? item.date,
        dataClasses: item.DataClasses ?? item.dataClasses,
      });
      addEdge(root, bid, "found in");
    }

    const rep = breach.reputation as Record<string, unknown> | undefined;
    const profiles = (rep?.details as { profiles?: unknown } | undefined)?.profiles;
    if (Array.isArray(profiles)) {
      for (const platform of profiles) {
        const platformName = typeof platform === "string" ? platform : String(platform);
        const uid = `username:${platformName}:${root}`;
        addNode(uid, `${root.split("@")[0]} on ${platformName}`, "username", { platform: platformName });
        addEdge(root, uid, "profile on");
      }
    }

    const hunter = breach.hunter as {
      data?: { status?: string; result?: string; score?: number };
    } | null;
    if (hunter?.data?.status && report.query_type === "email") {
      addNode(
        `hunter:${report.query}`,
        `Hunter: ${hunter.data.result ?? hunter.data.status}`,
        "org",
        { score: hunter.data.score, source: "hunter.io" }
      );
      addEdge(root, `hunter:${report.query}`, "verified by");
    }
  }

  const ip = moduleData(report, "ip");
  if (ip) {
    const geo = ip.geo as Record<string, unknown> | undefined;
    if (geo?.query) {
      const ipid = `ip:${geo.query}`;
      addNode(ipid, String(geo.query), "ip", {
        isp: geo.isp,
        org: geo.org,
        country: geo.country,
      });
      addEdge(root, ipid, "resolves to");

      if (geo.org) {
        const orgid = `org:${geo.org}`;
        addNode(orgid, String(geo.org), "org", { country: geo.country });
        addEdge(ipid, orgid, "hosted by");
      }
    }

    const shodan = ip.shodan as { hostnames?: string[] } | undefined;
    shodan?.hostnames?.forEach((h) => {
      const did = `domain:${h}`;
      addNode(did, h, "domain", {});
      addEdge(root, did, "hostname");
    });
  }

  const whois = moduleData(report, "whois");
  if (whois) {
    const certs = whois.certificates as Array<{ name_value?: string }> | null;
    certs?.slice(0, 8).forEach((c) => {
      for (const sub of splitCertNames(c.name_value)) {
        if (sub !== root) {
          const sid = `domain:${sub}`;
          addNode(sid, sub, "domain", { source: "crt.sh" });
          addEdge(root, sid, "subdomain");
        }
      }
    });

    const dns = whois.dns as { Answer?: Array<{ type?: number; data?: string }> } | undefined;
    dns?.Answer?.forEach((a) => {
      if (a.type === 1 && a.data) {
        const ipid = `ip:${a.data}`;
        addNode(ipid, a.data, "ip", { source: "dns" });
        addEdge(root, ipid, "A record");
      }
    });

    const hunter = whois.hunter as {
      data?: { emails?: Array<{ value?: string; type?: string; confidence?: number }> };
    } | null;
    hunter?.data?.emails?.slice(0, 8).forEach((entry) => {
      const email = entry.value?.trim();
      if (!email) return;
      const eid = `email:${email.toLowerCase()}`;
      addNode(eid, email, "email", {
        source: "hunter.io",
        type: entry.type,
        confidence: entry.confidence,
      });
      addEdge(root, eid, "email at");
    });

    const domainsdb = whois.domainsdb as {
      domains?: Array<{ domain?: string; country?: string }>;
    } | null;
    domainsdb?.domains?.slice(0, 6).forEach((entry) => {
      const domain = entry.domain?.trim();
      if (!domain || domain === root) return;
      const did = `domain:${domain}`;
      addNode(did, domain, "domain", { source: "domainsdb", country: entry.country });
      addEdge(root, did, "related domain");
    });
  }

  const username = moduleData(report, "username");
  if (username) {
    const detected = username.detected as Array<{ found?: boolean; platform?: string; url?: string }> | undefined;
    detected
      ?.filter((p) => p.found)
      .forEach((p) => {
        const uid = `username:${p.platform}`;
        addNode(uid, `${report.query} @ ${p.platform}`, "username", {
          url: p.url,
          platform: p.platform,
        });
        addEdge(root, uid, "found on");
      });

    const verified = username.verified as Array<{ found?: boolean; platform?: string; url?: string }> | undefined;
    verified
      ?.filter((p) => p.found)
      .forEach((p) => {
        const uid = `username:${p.platform}:verified`;
        addNode(uid, `${report.query} @ ${p.platform}`, "username", {
          url: p.url,
          platform: p.platform,
          verification: "api",
        });
        addEdge(root, uid, "verified on");
      });
  }

  const threat = moduleData(report, "threat");
  if (threat) {
    const urlScan = threat.urlScan as { results?: Array<Record<string, unknown>> } | undefined;
    urlScan?.results?.slice(0, 5).forEach((r) => {
      const page = r.page as { url?: string; domain?: string } | undefined;
      const pageUrl = page?.url;
      if (!pageUrl) return;
      const uid = `url:${pageUrl}`;
      const verdicts = r.verdicts as { overall?: { score?: number } } | undefined;
      addNode(uid, page?.domain || pageUrl, "url", { score: verdicts?.overall?.score });
      addEdge(root, uid, "scanned");
    });

    const urlhaus = threat.urlhaus as {
      urls?: Array<{ id?: string; url?: string; threat?: string; tags?: string[] }>;
    } | null;
    urlhaus?.urls?.slice(0, 5).forEach((entry) => {
      const pageUrl = entry.url?.trim();
      if (!pageUrl) return;
      const uid = `url:${pageUrl}`;
      addNode(uid, pageUrl, "url", {
        source: "urlhaus",
        threat: entry.threat,
        tags: entry.tags,
      });
      addEdge(root, uid, "malicious URL");
    });
  }

  return { nodes, edges };
}
