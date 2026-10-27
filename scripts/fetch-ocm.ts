// Fetches real NYC charging stations from OpenChargeMap ONCE and caches the raw
// response to data/ocm-nyc-raw.json, plus a normalized data/stations-nyc.json.
// We never call OCM live from the app (it's a registry, not real-time, and has a
// fair-use policy) — this cache is the source the DB is seeded from.
//
// Run: npx tsx --env-file=.env.local scripts/fetch-ocm.ts
import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.OPENCHARGEMAP_API_KEY;
if (!KEY) throw new Error("OPENCHARGEMAP_API_KEY missing (run with --env-file=.env.local)");

type BBox = { north: number; west: number; south: number; east: number };

// NYC metro bounding box (from research/openchargemap-api.md). OCM caps each
// request at maxresults, so a full box gets split into quadrants until every
// tile comes back under the cap (the first pull hit 500 and silently dropped stations).
const NYC_BOX: BBox = { north: 40.92, west: -74.26, south: 40.49, east: -73.68 };
const MAX_PER_REQUEST = 500;
const MAX_TILE_DEPTH = 4;

// OCM connector type IDs -> friendly names (OCM /referencedata, US-relevant subset).
// NACS (SAE J3400) is the Tesla plug standardized, so it maps to "Tesla".
const CONNECTOR: Record<number, string> = {
  1: "Type1", 29: "Type1", // SAE J1772 (socket / tethered)
  2: "CHAdeMO",
  8: "Tesla", 27: "Tesla", 30: "Tesla", 1040: "Tesla",
  25: "Type2", 28: "Type2",
  32: "CCS", 33: "CCS", 1036: "CCS",
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

async function fetchBox(box: BBox): Promise<OcmPoi[]> {
  const params = new URLSearchParams({
    output: "json",
    boundingbox: `(${box.north},${box.west}),(${box.south},${box.east})`,
    countrycode: "US",
    maxresults: String(MAX_PER_REQUEST),
    compact: "true",
    verbose: "false",
    opendata: "true",
  });
  const res = await fetch(`https://api.openchargemap.io/v3/poi/?${params}`, {
    headers: { "X-API-Key": KEY!, "User-Agent": "WattFinder/0.1 (portfolio project)" },
  });
  if (!res.ok) throw new Error(`OCM ${res.status}: ${await res.text()}`);
  return (await res.json()) as OcmPoi[];
}

async function fetchTiled(box: BBox, depth = 0): Promise<OcmPoi[]> {
  const pois = await fetchBox(box);
  if (pois.length < MAX_PER_REQUEST) return pois;
  if (depth >= MAX_TILE_DEPTH) {
    console.warn(`tile still at the ${MAX_PER_REQUEST} cap at depth ${depth}; some POIs may be missing`, box);
    return pois;
  }
  const midLat = (box.north + box.south) / 2;
  const midLng = (box.west + box.east) / 2;
  const tiles: BBox[] = [
    { north: box.north, west: box.west, south: midLat, east: midLng },
    { north: box.north, west: midLng, south: midLat, east: box.east },
    { north: midLat, west: box.west, south: box.south, east: midLng },
    { north: midLat, west: midLng, south: box.south, east: box.east },
  ];
  const byId = new Map<number, OcmPoi>();
  // Sequential on purpose: OCM asks for fair use.
  for (const tile of tiles) for (const p of await fetchTiled(tile, depth + 1)) byId.set(p.ID, p);
  return [...byId.values()];
}

async function main() {
  console.log("Fetching NYC stations from OpenChargeMap (tiled bounding box)...");
  const raw = await fetchTiled(NYC_BOX);

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
