import { fetchJson, resolveDomainToIp } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";
import type { InputType } from "@/lib/detect";

export async function runIpIntel(query: string, inputType: InputType = "ip") {
  let target = query;
  let resolvedFrom: string | null = null;

  if (inputType === "domain") {
    const ip = await resolveDomainToIp(query);
    if (ip) {
      target = ip;
      resolvedFrom = query;
    }
  }

  const [geo, abuse, shodan, interdb] = await Promise.all([
    fetchJson(
      `http://ip-api.com/json/${encodeURIComponent(target)}?fields=status,country,regionName,city,zip,lat,lon,isp,org,as,query`
    ),

    hasEnv("ABUSEIPDB_API_KEY")
      ? fetchJson(
          `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(target)}&maxAgeInDays=90&verbose`,
          {
            headers: {
              Key: process.env.ABUSEIPDB_API_KEY!,
              Accept: "application/json",
            },
          }
        )
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    hasEnv("SHODAN_API_KEY")
      ? fetchJson(
          `https://api.shodan.io/shodan/host/${encodeURIComponent(target)}?key=${process.env.SHODAN_API_KEY}`
        )
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    fetchJson(`https://internetdb.shodan.io/${encodeURIComponent(target)}`),
  ]);

  return {
    source: "IP Intelligence",
    target,
    resolvedFrom,
    geo: geo.data,
    abuse: abuse.data,
    shodan: shodan.data,
    quickScan: interdb.data,
  };
}
