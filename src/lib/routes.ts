export const ALL_ROUTES = [
  "/api/breach",
  "/api/ip",
  "/api/phone",
  "/api/plate",
  "/api/vin",
  "/api/whois",
  "/api/threat",
  "/api/username",
] as const;

export type ReconRoute = (typeof ALL_ROUTES)[number];

/** Primary modules for each detected input type. */
export const ROUTE_MAP: Record<
  import("./detect").InputType,
  ReconRoute[]
> = {
  email: ["/api/breach", "/api/threat"],
  ip: ["/api/ip", "/api/threat"],
  domain: ["/api/whois", "/api/ip", "/api/threat"],
  phone: ["/api/phone"],
  plate: ["/api/plate", "/api/vin"],
  username: ["/api/username"],
  unknown: [],
};

export function getRoutesForQuery(
  type: import("./detect").InputType,
  runAll = false
): ReconRoute[] {
  if (runAll) return [...ALL_ROUTES];
  return ROUTE_MAP[type]?.length ? [...ROUTE_MAP[type]] : [];
}

export function isPrimaryRoute(
  route: ReconRoute,
  type: import("./detect").InputType
): boolean {
  return ROUTE_MAP[type]?.includes(route) ?? false;
}

export const ROUTE_LABELS: Record<ReconRoute, string> = {
  "/api/breach": "Breach Intelligence",
  "/api/ip": "IP Intelligence",
  "/api/phone": "Phone Intelligence",
  "/api/plate": "Plate / Vehicle Intelligence",
  "/api/vin": "VIN Intelligence",
  "/api/whois": "Domain Infrastructure",
  "/api/threat": "Threat Intelligence",
  "/api/username": "Username Lookup",
};
