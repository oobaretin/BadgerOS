import type { InputType } from "@/lib/detect";

export const EXAMPLES: Record<InputType, string> = {
  email: "user@domain.com",
  ip: "8.8.8.8",
  domain: "example.com",
  phone: "+1 (415) 555-2671",
  plate: "5YJSA1E14HF000001",
  username: "johndoe",
  unknown: "???",
};

export const MODULES = [
  {
    route: "/api/breach",
    name: "Breach Intel",
    description: "EmailRep + HIBP + BreachDirectory",
    icon: "🛡️",
    types: ["email"] as InputType[],
  },
  {
    route: "/api/ip",
    name: "IP Intelligence",
    description: "ip-api.com + AbuseIPDB + Shodan + InternetDB",
    icon: "🌐",
    types: ["ip", "domain"] as InputType[],
  },
  {
    route: "/api/phone",
    name: "Phone Intelligence",
    description: "NumLookup phone validation",
    icon: "📱",
    types: ["phone"] as InputType[],
  },
  {
    route: "/api/plate",
    name: "Plate / Vehicle Intel",
    description: "NHTSA VIN decode + recalls, UK DVLA, Plate Recognizer ALPR",
    icon: "🚗",
    types: ["plate"] as InputType[],
  },
  {
    route: "/api/vin",
    name: "VIN Intelligence",
    description: "NHTSA VIN decode, recalls, and owner complaints",
    icon: "🔍",
    types: ["plate"] as InputType[],
  },
  {
    route: "/api/whois",
    name: "Domain Intel",
    description: "RDAP + DNS + crt.sh + SecurityTrails + Wayback",
    icon: "📋",
    types: ["domain"] as InputType[],
  },
  {
    route: "/api/threat",
    name: "Threat Intel",
    description: "VirusTotal + OTX + urlscan + PhishTank",
    icon: "⚠️",
    types: ["email", "ip", "domain"] as InputType[],
  },
  {
    route: "/api/username",
    name: "Username OSINT",
    description: "API-verified + HEAD-detected across 14 platforms",
    icon: "👤",
    types: ["username"] as InputType[],
  },
] as const;
