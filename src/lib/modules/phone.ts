import { fetchJson } from "@/lib/fetchExternal";
import { hasEnv, skippedSource } from "@/lib/env";

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

  const [numverify, abstract] = await Promise.all([
    hasEnv("NUMVERIFY_KEY")
      ? fetchJson(
          `https://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_KEY}&number=${encodeURIComponent(number)}&country_code=&format=1`,
          undefined,
          15_000
        )
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),

    hasEnv("ABSTRACT_PHONE_KEY")
      ? fetchJson(
          `https://phonevalidation.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_PHONE_KEY}&phone=${encodeURIComponent(number)}`,
          undefined,
          15_000
        )
      : Promise.resolve({ ok: true, status: 0, data: skippedSource() }),
  ]);

  return {
    source: "Phone Intelligence",
    number,
    numverify: numverify.data,
    abstract: abstract.data,
  };
}
