// Station data access. Prefers Postgres (DATABASE_URL); falls back to the committed
// OCM snapshot in data/stations-nyc.json so the app still runs when the free-tier
// Supabase project is paused or the env var is missing.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { baseUtilization } from "./utilization";

export type Connection = { connectorType: string; powerKw: number; currentType: string | null; quantity: number };
export type Station = {
  ocmId: number;
  name: string;
  town: string | null;
  lat: number;
  lng: number;
  numPoints: number | null;
  baseUtilization: number;
  connections: Connection[];
};

async function fromDatabase(url: string): Promise<Station[]> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 4000 });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select s.ocm_id, s.name, s.town, s.latitude, s.longitude, s.num_points, s.base_utilization,
              coalesce(json_agg(json_build_object(
                'connectorType', c.connector_type, 'powerKw', c.power_kw,
                'currentType', c.current_type, 'quantity', c.quantity))
                filter (where c.id is not null), '[]') as connections
       from public.stations s
       left join public.station_connections c on c.station_id = s.id
       group by s.id`,
    );
    return rows.map((r) => ({
      ocmId: Number(r.ocm_id), // bigint comes back as a string
      name: r.name,
      town: r.town,
      lat: r.latitude,
      lng: r.longitude,
      numPoints: r.num_points,
      baseUtilization: r.base_utilization,
      connections: r.connections.map((c: Connection) => ({ ...c, powerKw: c.powerKw ?? 0 })),
    }));
  } finally {
    await client.end().catch(() => {});
  }
}

type CacheRow = {
  ocm_id: number;
  name: string;
  town: string | null;
  latitude: number;
  longitude: number;
  num_points: number | null;
  connections: { connector_type: string; power_kw: number | null; current_type: string | null; quantity: number }[];
};

async function fromCache(): Promise<Station[]> {
  const raw = await readFile(path.join(process.cwd(), "data/stations-nyc.json"), "utf8");
  return (JSON.parse(raw) as CacheRow[]).map((r) => ({
    ocmId: r.ocm_id,
    name: r.name,
    town: r.town,
    lat: r.latitude,
    lng: r.longitude,
    numPoints: r.num_points,
    baseUtilization: baseUtilization(r.ocm_id),
    connections: r.connections.map((c) => ({
      connectorType: c.connector_type,
      powerKw: c.power_kw ?? 0,
      currentType: c.current_type,
      quantity: c.quantity,
    })),
  }));
}

export async function getStations(): Promise<{ stations: Station[]; source: "database" | "cache" }> {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      return { stations: await fromDatabase(url), source: "database" };
    } catch {
      // paused project, timeout, bad creds: fall through to the snapshot
    }
  }
  return { stations: await fromCache(), source: "cache" };
}
