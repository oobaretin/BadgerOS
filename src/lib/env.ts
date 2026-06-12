export const API_KEY_CONFIG = {
  EMAILREP_KEY: { label: "EmailRep", module: "Breach Intel", required: false },
  HIBP_API_KEY: { label: "Have I Been Pwned", module: "Breach Intel", required: false },
  RAPIDAPI_KEY: { label: "BreachDirectory", module: "Breach Intel", required: false },
  ABUSEIPDB_API_KEY: { label: "AbuseIPDB", module: "IP Intelligence", required: false },
  SHODAN_API_KEY: { label: "Shodan Host", module: "IP Intelligence", required: false },
  SECURITYTRAILS_KEY: { label: "SecurityTrails", module: "Domain Intel", required: false },
  DOMAINSDB_KEY: { label: "DomainsDB", module: "Domain Intel", required: false },
  HUNTER_KEY: { label: "Hunter.io", module: "Domain Intel / Breach Intel", required: false },
  VIRUSTOTAL_API_KEY: { label: "VirusTotal", module: "Threat Intel", required: false },
  ALIENVAULT_KEY: { label: "AlienVault OTX", module: "Threat Intel", required: false },
  URLSCAN_KEY: { label: "urlscan.io", module: "Threat Intel", required: false },
  PHISHTANK_KEY: { label: "PhishTank", module: "Threat Intel", required: false },
  ABUSECH_AUTH_KEY: { label: "abuse.ch (URLhaus + MalwareBazaar)", module: "Threat Intel", required: false },
  NUMLOOKUP_KEY: { label: "NumLookup (numlookupapi.com — free)", module: "Phone Intel", required: false },
  PLATE_RECOGNIZER_KEY: {
    label: "Plate Recognizer (platerecognizer.com — 2500 free/mo)",
    module: "Plate / Vehicle Intel",
    required: false,
  },
  DVLA_API_KEY: {
    label: "DVLA (UK only — developer.gov.uk, free)",
    module: "Plate / Vehicle Intel",
    required: false,
  },
  SERPAPI_KEY: {
    label: "SerpApi (serpapi.com — 100 free searches/mo)",
    module: "Reverse Image",
    required: false,
  },
  BING_VISION_KEY: {
    label: "Bing Visual Search (portal.azure.com — free tier 1000/mo)",
    module: "Reverse Image",
    required: false,
  },
  TINEYE_KEY: {
    label: "TinEye (tineye.com/api — free tier 150/mo)",
    module: "Reverse Image",
    required: false,
  },
  IMGBB_KEY: {
    label: "imgbb (imgbb.com — free image hosting for public URLs)",
    module: "Reverse Image",
    required: false,
  },
} as const;

export type ApiKeyName = keyof typeof API_KEY_CONFIG;

export function hasEnv(key: ApiKeyName): boolean {
  return Boolean(process.env[key]?.trim());
}

export function getApiKeyStatus() {
  return (Object.entries(API_KEY_CONFIG) as [ApiKeyName, (typeof API_KEY_CONFIG)[ApiKeyName]][]).map(
    ([key, meta]) => ({
      key,
      label: meta.label,
      module: meta.module,
      required: meta.required,
      configured: hasEnv(key),
    })
  );
}

export function skippedSource(reason = "No API key configured") {
  return { skipped: true, reason };
}
