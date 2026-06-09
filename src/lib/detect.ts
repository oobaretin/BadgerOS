import { isVin } from "./vehicleDetect";

export { isVin, isUkPlate } from "./vehicleDetect";

export type InputType = "email" | "ip" | "domain" | "phone" | "plate" | "username" | "unknown";
export type RoutableInputType = Exclude<InputType, "unknown">;
export type HandlerRoute = "breach" | "ip" | "phone" | "plate" | "whois" | "username";

export interface ReconSourceResult {
  source: string;
  status: "fulfilled" | "rejected";
  data: Record<string, unknown>;
}

export interface ReconResponse {
  type: InputType;
  query: string;
  results: ReconSourceResult[];
  reportId?: string;
}

export interface ReconResult {
  type: RoutableInputType;
  query: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  email: "Email",
  ip: "IP Address",
  domain: "Domain",
  phone: "Phone",
  plate: "Plate / VIN",
  username: "Username",
  unknown: "Unknown",
};

export const INPUT_TYPE_COLORS: Record<InputType, string> = {
  email: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  ip: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  domain: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  phone: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  plate: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  username: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  unknown: "text-foreground/40 bg-foreground/5 border-foreground/20",
};

const ROUTE_MAP: Record<RoutableInputType, HandlerRoute> = {
  email: "breach",
  ip: "ip",
  domain: "whois",
  phone: "phone",
  plate: "plate",
  username: "username",
};

export function detectInputType(value: string): InputType {
  const v = sanitizeInput(value).trim().toUpperCase();

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "email";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return "ip";
  if (isIPv6(v)) return "ip";
  if (/^\+?[\d\s\-().]{7,15}$/.test(v)) return "phone";
  if (isVin(v.replace(/\s/g, ""))) return "plate";
  if (/^(?=.*\d)[A-Z0-9]{2,8}$/.test(v) && v.length <= 8) return "plate";
  if (/^(([a-zA-Z0-9](-*[a-zA-Z0-9])*)\.)+[a-zA-Z]{2,}$/.test(v)) return "domain";
  if (/^[a-zA-Z0-9_.-]{2,30}$/.test(v)) return "username";
  return "unknown";
}

function isIPv6(value: string): boolean {
  return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(value);
}

/** Strip paths, protocols, and www prefix from domain-like input. */
export function sanitizeInput(value: string): string {
  let v = value.trim();
  try {
    if (v.includes("://")) {
      v = new URL(v).hostname;
    } else if (v.includes("/")) {
      v = v.split("/")[0] ?? v;
    }
  } catch {
    v = v.split("/")[0] ?? v;
  }
  if (v.toLowerCase().startsWith("www.")) v = v.slice(4);
  return v;
}

export function getHandlerPath(route: HandlerRoute): string {
  return `/api/${route}`;
}

export function resolveRoute(type: InputType): HandlerRoute | null {
  if (type === "unknown") return null;
  return ROUTE_MAP[type];
}

export function normalizeQuery(type: RoutableInputType, value: string): string {
  const v = sanitizeInput(value);
  if (type === "phone") return sanitizeInput(value).replace(/\D/g, "");
  if (type === "plate") return sanitizeInput(value).replace(/\s/g, "").toUpperCase();
  if (type === "email" || type === "ip" || type === "domain") return v.toLowerCase();
  return v;
}

export function createResult(
  type: RoutableInputType,
  query: string,
  data: Record<string, unknown>
): ReconResult {
  return {
    type,
    query,
    timestamp: new Date().toISOString(),
    data,
  };
}

export const KNOWN_INPUT_TYPES: RoutableInputType[] = [
  "email",
  "ip",
  "domain",
  "phone",
  "plate",
  "username",
];
