import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";

export async function runBreachIntel(query: string) {
  const [rep, hibp, breachdir] = await Promise.all([
    fetchJson(`https://emailrep.io/${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "BadgerOS-Personal",
        Key: process.env.EMAILREP_KEY || "",
      },
    }),

    hasEnv("HIBP_API_KEY")
      ? fetchJson(
          `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(query)}?truncateResponse=false`,
          {
            headers: {
              "hibp-api-key": process.env.HIBP_API_KEY!,
              "User-Agent": "BadgerOS-Personal",
            },
          }
        ).then((r) =>
          r.status === 404 ? { ok: true, status: 404, data: { breaches: [] } } : r
        )
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    hasEnv("RAPIDAPI_KEY")
      ? fetchJson(
          `https://breachdirectory.p.rapidapi.com/?func=auto&term=${encodeURIComponent(query)}`,
          {
            headers: {
              "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
              "X-RapidAPI-Host": "breachdirectory.p.rapidapi.com",
            },
          }
        )
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),
  ]);

  return {
    source: "Breach Intelligence",
    reputation: rep.ok || rep.status === 200 ? rep.data : rep.data,
    hibp: hibp.data,
    breachDirectory: breachdir.data,
  };
}
