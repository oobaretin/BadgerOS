import { runBreachIntel } from "./breach";
import { runIpIntel } from "./ip";
import { runPhoneIntel } from "./phone";
import { runVehicleIntel } from "./vehicle";
import { runVinIntel } from "./vin";
import { runWhoisIntel } from "./whois";
import { runThreatIntel } from "./threat";
import { runUsernameIntel } from "./username";
import type { ReconRoute } from "@/lib/routes";

export const MODULE_RUNNERS: Record<ReconRoute, (query: string, inputType?: import("@/lib/detect").InputType) => Promise<Record<string, unknown>>> = {
  "/api/breach": (query) => runBreachIntel(query),
  "/api/ip": (query, inputType) => runIpIntel(query, inputType),
  "/api/phone": (query) => runPhoneIntel(query),
  "/api/plate": (query) => runVehicleIntel(query),
  "/api/vin": (query) => runVinIntel(query),
  "/api/whois": (query) => runWhoisIntel(query),
  "/api/threat": (query, inputType) => runThreatIntel(query, inputType ?? "domain"),
  "/api/username": (query) => runUsernameIntel(query),
};
