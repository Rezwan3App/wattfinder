// Fetches real NYC charging stations from OpenChargeMap ONCE and caches the raw
// response to data/ocm-nyc-raw.json, plus a normalized data/stations-nyc.json.
// We never call OCM live from the app (it's a registry, not real-time, and has a
// fair-use policy) — this cache is the source the DB is seeded from.
//
// Run: npx tsx --env-file=.env.local scripts/fetch-ocm.ts
import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.OPENCHARGEMAP_API_KEY;
if (!KEY) throw new Error("OPENCHARGEMAP_API_KEY missing (run with --env-file=.env.local)");

// NYC metro bounding box (from research/openchargemap-api.md).
const params = new URLSearchParams({
  output: "json",
  boundingbox: "(40.92,-74.26),(40.49,-73.68)",
  countrycode: "US",
  maxresults: "500",
  compact: "true",
  verbose: "false",
  opendata: "true",
});
const url = `https://api.openchargemap.io/v3/poi/?${params}`;

// OCM connector type IDs -> friendly names (from research notes).
const CONNECTOR: Record<number, string> = {
  33: "CCS", 2: "CHAdeMO", 27: "Tesla", 25: "Type2", 32: "CCS", 1: "Type1",
};
const CURRENT: Record<number, string> = { 30: "DC", 20: "AC (3-phase)", 10: "AC (1-phase)" };

type OcmPoi = {
  ID: number;
  AddressInfo?: { Title?: string; Town?: string; Latitude?: number; Longitude?: number };
  NumberOfPoints?: number;
  DataQualityLevel?: number;
  StatusTypeID?: number;
  Connections?: { ConnectionTypeID?: number; PowerKW?: number; CurrentTypeID?: number; Quantity?: number }[];
};

async function main() {
  console.log("Fetching NYC stations from OpenChargeMap...");
  const res = await fetch(url, {
    headers: { "X-API-Key": KEY!, "User-Agent": "WattFinder/0.1 (portfolio project)" },
  });
  if (!res.ok) throw new Error(`OCM ${res.status}: ${await res.text()}`);
  const raw = (await res.json()) as OcmPoi[];

  mkdirSync("data", { recursive: true });
  writeFileSync("data/ocm-nyc-raw.json", JSON.stringify(raw, null, 2));
  console.log(`Cached ${raw.length} raw POIs -> data/ocm-nyc-raw.json`);

  // Normalize: keep stations with real coordinates and at least one connector with a known kW.
  const stations = raw
    .filter((p) => p.AddressInfo?.Latitude != null && p.AddressInfo?.Longitude != null)
    .map((p) => {
      const connections = (p.Connections ?? [])
        .filter((c) => c.PowerKW != null && c.PowerKW > 0)
        .map((c) => ({
          connector_type: CONNECTOR[c.ConnectionTypeID ?? -1] ?? "Unknown",
          power_kw: c.PowerKW!,
          current_type: CURRENT[c.CurrentTypeID ?? -1] ?? null,
          quantity: c.Quantity ?? 1,
        }));
      return {
        ocm_id: p.ID,
        name: p.AddressInfo?.Title ?? "Unnamed station",
        town: p.AddressInfo?.Town ?? null,
        latitude: p.AddressInfo!.Latitude!,
        longitude: p.AddressInfo!.Longitude!,
        num_points: p.NumberOfPoints ?? null,
        data_quality: p.DataQualityLevel ?? null,
        connections,
      };
    })
    .filter((s) => s.connections.length > 0); // drop stations with no known-kW connector

  writeFileSync("data/stations-nyc.json", JSON.stringify(stations, null, 2));
  const dc = stations.filter((s) => s.connections.some((c) => c.current_type === "DC")).length;
  console.log(`Normalized ${stations.length} usable stations (${dc} with DC fast charging) -> data/stations-nyc.json`);
}

main();
