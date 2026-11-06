// Self-check for availability + ranking. Run: npx tsx src/lib/recommend.test.ts
import assert from "node:assert";
import { CARS } from "./estimator";
import { predictAvailability } from "./occupancy";
import { rankStations } from "./recommend";
import { getStations } from "./stations";
import { formatObservedAt } from "./weather";

const car = (id: string) => CARS.find((c) => c.id === id)!;
const origin = { lat: 40.7128, lng: -74.006 };

async function main() {
  // Cache path (DATABASE_URL unset on purpose so this never touches the network).
  delete process.env.DATABASE_URL;
  const { stations, source } = await getStations();
  assert.equal(source, "cache");
  assert.ok(stations.length > 1500, `expected ~1656 stations, got ${stations.length}`);
  console.log(`ok  getStations: ${stations.length} stations from ${source}`);

  // Deterministic availability, and overnight is no busier than the evening peak.
  const s = stations[0];
  const evening = new Date("2026-10-26T22:00:00Z"); // 6pm EDT Monday
  const night = new Date("2026-10-26T07:00:00Z"); // 3am EDT Monday
  assert.deepEqual(predictAvailability(s, evening), predictAvailability(s, evening));
  const single = { ...s, numPoints: 1, connections: [{ connectorType: "CCS", powerKw: 50, currentType: "DC", quantity: 1 }] };
  assert.ok(predictAvailability(single, night).busyProbability <= predictAvailability(single, evening).busyProbability);
  console.log("ok  predictAvailability deterministic and time-aware");

  // Ranking: sorted, limited, and cars only get plugs they can use.
  for (const c of CARS) {
    const r = rankStations(stations, { car: c, startSoc: 10, targetSoc: 80, origin, now: evening });
    assert.ok(r.length > 0 && r.length <= 10, `${c.id}: ${r.length} results`);
    for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].totalMinutes <= r[i].totalMinutes, "not sorted");
    for (const x of r) assert.ok(c.connectors.includes(x.connector.connectorType), `${c.id} got ${x.connector.connectorType}`);
    console.log(`ok  ${c.id}: best ${r[0].station.name} ${r[0].totalMinutes}min (${r[0].connector.connectorType} ${r[0].connector.powerKw}kW)`);
  }
  const bolt = { car: car("bolt-ev"), startSoc: 10, targetSoc: 80, origin, now: evening, limit: 1000 };
  const dcOnly = rankStations(stations, bolt);
  assert.ok(!dcOnly.some((x) => x.connector.connectorType === "Tesla"), "Bolt got a Tesla connector");
  assert.ok(rankStations(stations, { ...bolt, dcOnly: false }).length > dcOnly.length, "dcOnly:false should add AC stations");
  console.log("ok  Bolt never gets Tesla; dcOnly:false adds AC");

  // Same straight-line distance, but a Jersey City stop pays the Hudson crossing.
  const fake = (lat: number, lng: number) => ({ ...stations.find((s) => s.connections.some((c) => c.connectorType === "CCS" && c.currentType?.startsWith("DC")))!, lat, lng });
  const [nyc, nj] = [fake(40.7128, -73.98), fake(40.7128, -74.032)]; // ~2.2 km east / west of origin
  const drive = (s: typeof nyc) => rankStations([s], bolt)[0].driveMinutes;
  assert.ok(drive(nj) >= drive(nyc) + 10, `NJ ${drive(nj)}min should carry the crossing vs NYC ${drive(nyc)}min`);
  console.log(`ok  Hudson crossing: NYC ${drive(nyc)}min vs NJ ${drive(nj)}min at similar distance`);

  // Weather timestamps carry no offset, so formatting must not depend on the machine's zone.
  assert.equal(formatObservedAt("2026-11-06T18:00"), "6:00 PM");
  assert.equal(formatObservedAt("2026-11-06T00:15"), "12:15 AM");
  assert.equal(formatObservedAt("2026-11-06T12:00"), "12:00 PM");
  console.log("ok  observed time formats without a timezone");

  console.log("\nAll recommend checks passed.");
}
main();
