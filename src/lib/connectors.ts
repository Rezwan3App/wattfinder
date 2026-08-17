// OpenChargeMap connector / current-type IDs -> the short labels WattFinder uses.
// Keep the raw connection_type_id on each row so an incomplete map is recoverable
// without another OCM pull. IDs from OCM /referencedata (US-relevant subset plus
// the Tesla/NACS/CCS aliases that showed up as Unknown in the first NYC fetch).

export const CONNECTOR_BY_ID: Record<number, string> = {
  1: "Type1", // SAE J1772
  2: "CHAdeMO",
  8: "Tesla", // Tesla Roadster / early destination
  13: "NEMA520",
  14: "NEMA1450",
  15: "NEMA1430",
  17: "NEMA515",
  25: "Type2", // IEC 62196-2 socket
  27: "Tesla", // Supercharger
  28: "Type2", // Type 2 tethered
  29: "Type1", // J1772 tethered
  30: "Tesla", // Tesla HPWC / destination
  32: "CCS", // CCS Combo 1 (North America)
  33: "CCS", // CCS Combo 2
  34: "IEC60309",
  35: "IEC60309",
  36: "IEC60309",
  1036: "CCS",
  1040: "NACS", // SAE J3400
};

export const CURRENT_BY_ID: Record<number, string> = {
  30: "DC",
  20: "AC (3-phase)",
  10: "AC (1-phase)",
};

/** Map an OCM ConnectionTypeID to a short label. Unknown keeps the numeric id. */
export function connectorLabel(connectionTypeId: number | null | undefined): string {
  if (connectionTypeId == null) return "Unknown";
  return CONNECTOR_BY_ID[connectionTypeId] ?? `Unknown (${connectionTypeId})`;
}

export function currentLabel(currentTypeId: number | null | undefined): string | null {
  if (currentTypeId == null) return null;
  return CURRENT_BY_ID[currentTypeId] ?? null;
}

/**
 * Best-effort fill-in when the cache predates stored type IDs.
 * Only used for obvious Tesla-named stalls — don't guess NEMA vs J1772 from kW.
 */
export function inferConnectorFromStationName(
  connectorType: string,
  stationName: string,
): string {
  if (!connectorType.startsWith("Unknown")) return connectorType;
  const name = stationName.toLowerCase();
  if (name.includes("tesla")) return "Tesla";
  return connectorType;
}
