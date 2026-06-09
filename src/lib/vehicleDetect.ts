export function isVin(value: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(value.replace(/\s/g, ""));
}

export function normalizeVin(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

export function normalizePlate(value: string): string {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

export function isUkPlate(value: string): boolean {
  const compact = value.replace(/\s/g, "").toUpperCase();
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(compact)) return true;
  if (/^[A-Z]\d{1,3}[A-Z]{3}$/.test(compact)) return true;
  if (/^[A-Z]{3}\d{1,3}[A-Z]?$/.test(compact)) return true;
  return false;
}

export function isUsPlate(value: string): boolean {
  const compact = value.replace(/[\s-]/g, "").toUpperCase();
  if (compact.length < 2 || compact.length > 8) return false;
  if (!/^[A-Z0-9]+$/.test(compact)) return false;
  return /[A-Z]/.test(compact) && /\d/.test(compact);
}

export function isVehicleInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isVin(trimmed)) return true;
  if (isUkPlate(trimmed)) return true;
  if (isUsPlate(trimmed)) return true;
  return false;
}

export function parseNhtsaDecode(data: unknown): Record<string, string> {
  const results =
    (data as { Results?: Array<{ Variable?: string; Value?: string | null }> })?.Results ?? [];
  const map: Record<string, string> = {};
  for (const row of results) {
    if (row.Variable && row.Value) {
      map[row.Variable] = String(row.Value);
    }
  }
  return map;
}
