// Charge-time estimator: the engineering core of WattFinder.
// Models the real charging curve per car (power tapers as the battery fills)
// instead of the naive kWh / kW that overstates real-world speed.
//
// Curve data + validation targets from research/charge-curves.md (July 2026 notes),
// sourced from EVKX, EV-Database, and InsideEVs charging tests. All curves assume a
// warm/preconditioned pack; cold weather can roughly halve these rates.

export type Car = {
  id: string;
  name: string;
  usableKWh: number;
  // Charging power (kW) the car ACCEPTS at a given state-of-charge (%).
  // Anchor points; power between anchors is linearly interpolated.
  curve: { soc: number; kw: number }[];
  curveSource: string;
};

export const CARS: Car[] = [
  {
    id: "model3-lr-rwd",
    name: "Tesla Model 3 Long Range RWD (2024)",
    usableKWh: 78.0,
    // High peak, steep near-linear taper.
    curve: [
      { soc: 10, kw: 249 },
      { soc: 20, kw: 228 },
      { soc: 40, kw: 140 },
      { soc: 60, kw: 78 },
      { soc: 80, kw: 45 },
      { soc: 100, kw: 15 },
    ],
    curveSource: "EVKX — model_3_long_range_rwd_my2024",
  },
  {
    id: "ioniq5-lr-awd",
    name: "Hyundai Ioniq 5 Long Range AWD (84 kWh)",
    usableKWh: 80.0,
    // 800V car: flat high plateau, then a cliff after ~76%.
    curve: [
      { soc: 10, kw: 221 },
      { soc: 20, kw: 224 },
      { soc: 40, kw: 253 },
      { soc: 60, kw: 195 },
      { soc: 76, kw: 112 },
      { soc: 80, kw: 67 }, // cliff modeled with a tight anchor, not interpolated through
      { soc: 100, kw: 40 },
    ],
    curveSource: "EVKX / EV-Database car/2236",
  },
  {
    id: "bolt-ev",
    name: "Chevy Bolt EV (2017-2023, 66 kWh)",
    usableKWh: 65.0,
    // Low, flat, stepped. Peak ~55 kW regardless of charger power.
    // ponytail: linear interp smooths the Bolt's hard steps, so 10->80% reads ~65min
    // vs measured ~73min. Within tolerance; switch to true step functions if the
    // Bolt's per-step accuracy ever matters for the demo.
    curve: [
      { soc: 10, kw: 54 },
      { soc: 50, kw: 54 },
      { soc: 55, kw: 38 }, // programmed step down
      { soc: 68, kw: 38 },
      { soc: 70, kw: 26 }, // second step
      { soc: 80, kw: 24 },
      { soc: 100, kw: 13 },
    ],
    curveSource: "InsideEVs 613786 / 589169 charging tests",
  },
];

/** Clamp a state-of-charge input to the 0–100% range the curves are defined on. */
export function clampSoc(soc: number): number {
  if (!Number.isFinite(soc)) return 0;
  return Math.min(100, Math.max(0, soc));
}

/** Power (kW) the car accepts at a given SoC %, linearly interpolated between anchors. */
export function carAcceptedKW(car: Car, soc: number): number {
  const pts = car.curve;
  if (pts.length === 0) throw new Error(`${car.id} has an empty charging curve`);
  const x = clampSoc(soc);
  if (x <= pts[0].soc) return pts[0].kw;
  if (x >= pts[pts.length - 1].soc) return pts[pts.length - 1].kw;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x >= a.soc && x <= b.soc) {
      const span = b.soc - a.soc;
      const t = span === 0 ? 0 : (x - a.soc) / span;
      return a.kw + t * (b.kw - a.kw);
    }
  }
  return pts[pts.length - 1].kw; // unreachable
}

export type ChargeEstimate = {
  minutes: number;
  /** Average delivered power over the session (kWh added / hours). */
  avgKW: number;
  /** True when the station's max output, not the car, limited charging at some point. */
  stationLimited: boolean;
};

/**
 * Minutes to charge from startSoc to targetSoc on a station rated stationKW.
 * Numerically integrates energy / effective-power, where effective power at each
 * step is min(car-accepted rate, station rating) — so the slower side wins, which
 * is the honest "your 150 kW charger only feeds your car 74 kW right now" story.
 */
export function estimateChargeTime(
  car: Car,
  startSoc: number,
  targetSoc: number,
  stationKW: number,
): ChargeEstimate {
  if (!Number.isFinite(stationKW) || stationKW <= 0) {
    throw new Error("stationKW must be a positive number");
  }

  const start = clampSoc(startSoc);
  const target = clampSoc(targetSoc);
  if (target <= start) return { minutes: 0, avgKW: 0, stationLimited: false };

  const stepPct = 0.5; // integration granularity
  let minutes = 0;
  let energyKWh = 0;
  let stationLimited = false;

  for (let soc = start; soc < target; ) {
    const step = Math.min(stepPct, target - soc);
    const mid = soc + step / 2;
    const accepted = carAcceptedKW(car, mid);
    const effective = Math.min(accepted, stationKW);
    if (stationKW < accepted) stationLimited = true;
    if (effective <= 0) {
      throw new Error("effective charge power is zero; cannot estimate");
    }

    const stepEnergy = car.usableKWh * (step / 100); // kWh added this step
    minutes += (stepEnergy / effective) * 60;
    energyKWh += stepEnergy;
    soc += step;
  }

  const avgKW = energyKWh / (minutes / 60);
  return { minutes: Math.round(minutes), avgKW: Math.round(avgKW), stationLimited };
}
