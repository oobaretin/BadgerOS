import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";

interface CrtShEntry {
  name_value?: string;
  not_before?: string;
  not_after?: string;
}

export async function runWhoisIntel(query: string) {
  const encoded = encodeURIComponent(query);

  const [rdap, dnsGoogle, dnsCF, certs, sectrails, wayback] = await Promise.all([
    fetchJson(`https://rdap.org/domain/${encoded}`, undefined, 15_000),
    fetchJson(`https://dns.google/resolve?name=${encoded}&type=A`),
    fetchJson(`https://cloudflare-dns.com/dns-query?name=${encoded}&type=MX`, {
      headers: { Accept: "application/dns-json" },
    }),
    fetchJson(`https://crt.sh/?q=%25.${encoded}&output=json`, undefined, 20_000),
    hasEnv("SECURITYTRAILS_KEY")
      ? fetchJson(`https://api.securitytrails.com/v1/domain/${encoded}`, {
          headers: { APIKEY: process.env.SECURITYTRAILS_KEY! },
        })
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),
    fetchJson(`https://archive.org/wayback/available?url=${encoded}`),
  ]);

  const certValue =
    Array.isArray(certs.data) ? (certs.data as CrtShEntry[]).slice(0, 20) : null;

  return {
    source: "Domain Intelligence",
    rdap: rdap.data,
    dns: dnsGoogle.data,
    mx: dnsCF.data,
    certificates: certValue,
    securityTrails: sectrails.data,
    wayback: wayback.data,
  };
}
