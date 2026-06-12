import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";
import { getKeySetupHint } from "@/lib/keySetup";

export function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export async function runPhoneIntel(query: string) {
  const number = normalizePhoneNumber(query);

  if (number.length < 7 || number.length > 15) {
    return {
      source: "Phone Intelligence",
      number,
      error: "Invalid phone number length (7–15 digits required)",
    };
  }

  if (!hasEnv("NUMLOOKUP_KEY")) {
    const reason = `${getKeySetupHint("NUMLOOKUP_KEY")} Get a free key at numlookupapi.com.`;
    return {
      source: "Phone Intelligence",
      number,
      error: reason,
      numlookup: skippedSource(reason),
    };
  }

  const numlookup = await fetchJson(
    `https://api.numlookupapi.com/v1/validate/${encodeURIComponent(`+${number}`)}`,
    { headers: { apikey: process.env.NUMLOOKUP_KEY! } },
    15_000
  );

  return {
    source: "Phone Intelligence",
    number,
    numlookup: numlookup.data,
  };
}
