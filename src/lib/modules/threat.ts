import { enrichMalwareBazaarFromUrlhaus, queryUrlhausHost } from "@/lib/abuseCh";
import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";
import type { InputType } from "@/lib/detect";

async function scanMozillaObservatory(host: string) {
  return fetchJson(
    `https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(host)}`,
    { method: "POST" },
    28_000
  );
}

async function runDomainThreat(target: string, resolvedFrom: string | null = null) {
  const encoded = encodeURIComponent(target);
  const url = target.startsWith("http") ? target : `http://${target}`;

  const [vt, otx, urlscan, phishtank, mozilla, urlhaus] = await Promise.all([
    hasEnv("VIRUSTOTAL_API_KEY")
      ? fetchJson(`https://www.virustotal.com/api/v3/domains/${encoded}`, {
          headers: { "x-apikey": process.env.VIRUSTOTAL_API_KEY! },
        })
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    hasEnv("ALIENVAULT_KEY")
      ? fetchJson(
          `https://otx.alienvault.com/api/v1/indicators/domain/${encoded}/general`,
          { headers: { "X-OTX-API-KEY": process.env.ALIENVAULT_KEY! } }
        )
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    hasEnv("URLSCAN_KEY")
      ? fetchJson(`https://urlscan.io/api/v1/search/?q=domain:${encoded}&size=5`, {
          headers: { "API-Key": process.env.URLSCAN_KEY! },
        })
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    hasEnv("PHISHTANK_KEY")
      ? fetchJson("https://checkurl.phishtank.com/checkurl/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `url=${encodeURIComponent(url)}&format=json&app_key=${process.env.PHISHTANK_KEY}`,
        })
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    scanMozillaObservatory(target),

    hasEnv("ABUSECH_AUTH_KEY")
      ? queryUrlhausHost(target)
      : Promise.resolve(skippedSource("Set ABUSECH_AUTH_KEY (auth.abuse.ch)")),
  ]);

  const malwareBazaar =
    hasEnv("ABUSECH_AUTH_KEY") && !(urlhaus as { skipped?: boolean }).skipped
      ? await enrichMalwareBazaarFromUrlhaus(urlhaus)
      : skippedSource("Set ABUSECH_AUTH_KEY or no URLhaus URLs to correlate");

  return {
    source: "Threat Intelligence",
    target,
    resolvedFrom,
    virusTotal: vt.data,
    alienVault: otx.data,
    urlScan: urlscan.data,
    phishTank: phishtank.data,
    mozillaObservatory: mozilla.data,
    urlhaus,
    malwareBazaar,
    clearbitLogo: `https://logo.clearbit.com/${target}`,
  };
}

async function runIpThreat(ip: string) {
  const encoded = encodeURIComponent(ip);

  const [vt, otx, urlhaus] = await Promise.all([
    hasEnv("VIRUSTOTAL_API_KEY")
      ? fetchJson(`https://www.virustotal.com/api/v3/ip_addresses/${encoded}`, {
          headers: { "x-apikey": process.env.VIRUSTOTAL_API_KEY! },
        })
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    hasEnv("ALIENVAULT_KEY")
      ? fetchJson(
          `https://otx.alienvault.com/api/v1/indicators/IPv4/${encoded}/general`,
          { headers: { "X-OTX-API-KEY": process.env.ALIENVAULT_KEY! } }
        )
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    hasEnv("ABUSECH_AUTH_KEY")
      ? queryUrlhausHost(ip)
      : Promise.resolve(skippedSource("Set ABUSECH_AUTH_KEY (auth.abuse.ch)")),
  ]);

  const malwareBazaar =
    hasEnv("ABUSECH_AUTH_KEY") && !(urlhaus as { skipped?: boolean }).skipped
      ? await enrichMalwareBazaarFromUrlhaus(urlhaus)
      : skippedSource("Set ABUSECH_AUTH_KEY or no URLhaus URLs to correlate");

  return {
    source: "Threat Intelligence",
    target: ip,
    resolvedFrom: null,
    virusTotal: vt.data,
    alienVault: otx.data,
    urlScan: skippedSource("urlscan requires a domain target"),
    phishTank: skippedSource("PhishTank requires a URL target"),
    mozillaObservatory: skippedSource("Mozilla Observatory requires a domain target"),
    urlhaus,
    malwareBazaar,
  };
}

export async function runThreatIntel(query: string, inputType: InputType = "domain") {
  if (inputType === "ip") {
    return runIpThreat(query);
  }

  if (inputType === "email") {
    const domain = query.split("@")[1]?.toLowerCase();
    if (!domain) {
      return {
        source: "Threat Intelligence",
        error: "Could not extract domain from email",
      };
    }
    return runDomainThreat(domain, query);
  }

  return runDomainThreat(query);
}
