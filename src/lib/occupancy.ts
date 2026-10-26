// Synthetic availability. THIS IS A MODEL, NOT LIVE OCCUPANCY: no charger network
// publishes real-time stall status for free, so we derive a plausible, deterministic
// "how busy is it right now" from the station's stored baseUtilization, a daily demand
// curve in NYC local time, and a tiny seeded jitter. Same station + same hour always
// gives the same answer. The UI should label it as estimated.
import type { Station } from "./stations";

export type Availability = {
  status: "free" | "short-wait" | "busy";
  busyProbability: number;
  waitMinutes: number;
  stallsFreeEstimate: number;
};

const bump = (h: number, center: number, width: number) => Math.exp(-((h - center) ** 2) / (2 * width ** 2));

// Relative demand 0..~1 by local hour. Weekdays: commute peaks ~8am and ~6pm.
// Weekends: one broad midday/afternoon hump. Overnight sits near the floor.
function demand(hour: number, weekend: boolean): number {
  return weekend
    ? 0.15 + 0.8 * bump(hour, 13, 3.5) + 0.3 * bump(hour, 19, 2)
    : 0.2 + 0.5 * bump(hour, 8, 1.8) + 0.7 * bump(hour, 18, 2) + 0.3 * bump(hour, 13, 3);
}

// Simple integer hash -> 0..1 (no Math.random, so results are stable).
function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const NY_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  hour12: false,
  weekday: "short",
});

export function predictAvailability(
  station: Pick<Station, "ocmId" | "baseUtilization" | "numPoints" | "connections">,
  now: Date,
): Availability {
  const parts = NY_TIME.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")!.value) % 24; // some engines emit "24"
  const weekend = ["Sat", "Sun"].includes(parts.find((p) => p.type === "weekday")!.value);

  const stalls = Math.max(1, station.connections.reduce((n, c) => n + c.quantity, 0), station.numPoints ?? 0);

  // Fraction of stalls occupied: baseline scaled by time-of-day demand, +-0.05 jitter.
  const jitter = (hash01(station.ocmId * 31 + hour) - 0.5) * 0.1;
  const occupied = Math.min(0.97, Math.max(0.02, station.baseUtilization * (0.5 + demand(hour, weekend)) + jitter));

  // Chance a driver arriving now finds every stall taken: more stalls, lower odds.
  const busyProbability = occupied ** stalls;
  // ponytail: wait = a flat 45-min worst case scaled by odds and split across stalls;
  // a real queueing model (Erlang C) if this ever needs to be defensible.
  const waitMinutes = Math.round((busyProbability * 45) / stalls);

  return {
    status: busyProbability < 0.25 ? "free" : busyProbability < 0.55 ? "short-wait" : "busy",
    busyProbability: Math.round(busyProbability * 100) / 100,
    waitMinutes,
    stallsFreeEstimate: Math.round(stalls * (1 - occupied)),
  };
}
