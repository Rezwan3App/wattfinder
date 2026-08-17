// Seeds Postgres from data/stations-nyc.json (produced by fetch-ocm.ts).
// Idempotent: truncates and reloads, so re-running gives a clean, reproducible DB.
// Each station gets a deterministic occupancy profile derived from its ocm_id, so the
// synthetic "busy right now" layer is stable across seeds.
//
// Run: npx tsx --env-file=.env.local scripts/seed.ts
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { inferConnectorFromStationName } from "../src/lib/connectors";
import type { Station } from "../src/lib/stations";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL missing (run with --env-file=.env.local)");

// Deterministic baseline busyness (0.25..0.64) from the station's stable id.
const baseUtilization = (ocmId: number) => 0.25 + (ocmId % 40) / 100;

async function main() {
  const stations: Station[] = JSON.parse(readFileSync("data/stations-nyc.json", "utf8"));
  const client = new Client({ connectionString: DB });
  await client.connect();

  try {
    await client.query("begin");
    await client.query("truncate public.station_connections, public.stations restart identity cascade");

    for (const s of stations) {
      const { rows } = await client.query(
        `insert into public.stations
           (ocm_id, name, town, latitude, longitude, num_points, data_quality, base_utilization)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id`,
        [s.ocm_id, s.name, s.town, s.latitude, s.longitude, s.num_points, s.data_quality, baseUtilization(s.ocm_id)],
      );
      const stationId = rows[0].id;
      for (const c of s.connections) {
        const connectorType = inferConnectorFromStationName(c.connector_type, s.name);
        await client.query(
          `insert into public.station_connections
             (station_id, connector_type, power_kw, current_type, quantity, connection_type_id)
           values ($1,$2,$3,$4,$5,$6)`,
          [
            stationId,
            connectorType,
            c.power_kw,
            c.current_type,
            c.quantity,
            c.connection_type_id ?? null,
          ],
        );
      }
    }

    await client.query("commit");
    const count = await client.query("select count(*) from public.stations");
    console.log(`Seeded ${count.rows[0].count} stations with their connectors.`);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
