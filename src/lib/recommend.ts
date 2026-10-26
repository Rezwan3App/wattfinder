// Ranks stations for a car by total time = drive + expected wait + charge.
import { estimateChargeTime, type Car } from "./estimator";
import { predictAvailability, type Availability } from "./occupancy";
import type { Connection, Station } from "./stations";

export type Ranked = {
  station: Station;
  connector: Connection;
  effectiveKw: number;
  driveMinutes: number;
  distanceKm: number;
  availability: Availability;
  chargeMinutes: number;
  totalMinutes: number;
  stationLimited: boolean;
};

const ROAD_FACTOR = 1.3; // straight-line to road distance, typical for a street grid
const NYC_AVG_KMH = 18; // congested city driving average
const PARK_MINUTES = 2; // park and plug in
const HUDSON_CROSSING_MINUTES = 12; // tunnel/bridge approach and queue; straight-line distance hides it

// ponytail: the Hudson as a straight line from the Battery (40.70, -74.02) to the
// GW Bridge (40.85, -73.95). Good enough to know NJ vs NYC; swap for a routing API
// (OSRM/Mapbox) if drive times ever need to be real.
const westOfHudson = (p: { lat: number; lng: number }) =>
  p.lng < -74.02 + ((p.lat - 40.7) * 0.07) / 0.15;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function rankStations(
  stations: Station[],
  opts: {
    car: Car;
    startSoc: number;
    targetSoc: number;
    origin: { lat: number; lng: number };
    now: Date;
    tempC?: number;
    dcOnly?: boolean;
    limit?: number;
  },
): Ranked[] {
  const { car, startSoc, targetSoc, origin, now, tempC, dcOnly = true, limit = 10 } = opts;
  const out: Ranked[] = [];

  for (const station of stations) {
    let best: { connector: Connection; effectiveKw: number; chargeMinutes: number; stationLimited: boolean } | null = null;

    for (const connector of station.connections) {
      if (connector.powerKw <= 0) continue;
      const dc = connector.currentType?.startsWith("DC") ?? false;
      let minutes: number;
      let effectiveKw: number;
      let stationLimited: boolean;
      if (dc) {
        if (!car.connectors.includes(connector.connectorType)) continue;
        const est = estimateChargeTime(car, startSoc, targetSoc, connector.powerKw, tempC);
        minutes = est.minutes;
        effectiveKw = est.avgKW;
        stationLimited = est.stationLimited;
      } else {
        // J1772 AC only; flat power capped by the onboard charger, no taper curve.
        if (dcOnly || connector.connectorType !== "Type1") continue;
        effectiveKw = Math.min(connector.powerKw, car.onboardAcKW);
        minutes = Math.round(((car.usableKWh * ((targetSoc - startSoc) / 100)) / effectiveKw) * 60);
        stationLimited = connector.powerKw < car.onboardAcKW;
      }
      if (!best || minutes < best.chargeMinutes) best = { connector, effectiveKw, chargeMinutes: minutes, stationLimited };
    }
    if (!best) continue;

    const distanceKm = haversineKm(origin, { lat: station.lat, lng: station.lng });
    const crossesHudson = westOfHudson(origin) !== westOfHudson(station);
    const driveMinutes = Math.round(
      ((distanceKm * ROAD_FACTOR) / NYC_AVG_KMH) * 60 + PARK_MINUTES + (crossesHudson ? HUDSON_CROSSING_MINUTES : 0),
    );
    const availability = predictAvailability(station, now);
    out.push({
      station,
      ...best,
      driveMinutes,
      distanceKm: Math.round(distanceKm * 10) / 10,
      availability,
      totalMinutes: driveMinutes + availability.waitMinutes + best.chargeMinutes,
    });
  }

  return out.sort((a, b) => a.totalMinutes - b.totalMinutes).slice(0, limit);
}
