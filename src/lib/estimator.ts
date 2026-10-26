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
  // Onboard AC charger limit (kW): AC stalls can never feed the car faster than this.
  // Approximate spec-sheet values, not measured.
  onboardAcKW: number;
  // DC plug types the car can use (natively or with a common adapter). All cars can
  // also use AC "Type1" (J1772), capped at onboardAcKW.
  connectors: string[];
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
    onboardAcKW: 11.5,
    connectors: ["Tesla", "CCS"],
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
    onboardAcKW: 10.9,
    connectors: ["CCS"],
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
    onboardAcKW: 11.0, // 2020+ Bolt
    connectors: ["CCS"],
  },
];

/** Power (kW) the car accepts at a given SoC %, linearly interpolated between anchors. */
export function carAcceptedKW(car: Car, soc: number): number {
  const pts = car.curve;
  if (soc <= pts[0].soc) return pts[0].kw;
  if (soc >= pts[pts.length - 1].soc) return pts[pts.length - 1].kw;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (soc >= a.soc && soc <= b.soc) {
      const t = (soc - a.soc) / (b.soc - a.soc);
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
 * Optional tempC derates the car's accepted rate for a cold pack (see coldFactor).
 */
export function estimateChargeTime(
  car: Car,
  startSoc: number,
  targetSoc: number,
  stationKW: number,
  tempC?: number,
): ChargeEstimate {
  if (targetSoc <= startSoc) return { minutes: 0, avgKW: 0, stationLimited: false };

  const { steps, minutes, stationLimited } = integrate(car, startSoc, targetSoc, stationKW, tempC);
  const energyKWh = car.usableKWh * ((steps.length * STEP_PCT) / 100);
  const avgKW = energyKWh / (minutes / 60);
  return { minutes: Math.round(minutes), avgKW: Math.round(avgKW), stationLimited };
}

/**
 * Multiplier on the car's accepted DC power for a cold battery: 1.0 at >=20C,
 * falling linearly to 0.55 at -10C (flat below).
 * ponytail: real packs depend on preconditioning (a Tesla navigating to a charger
 * warms up first); one linear factor for all cars, per-car curves if it matters.
 */
export function coldFactor(tempC: number): number {
  if (tempC >= 20) return 1;
  if (tempC <= -10) return 0.55;
  return 0.55 + ((tempC + 10) / 30) * 0.45;
}

type Step = { soc: number; kw: number; minutes: number };
const STEP_PCT = 0.5; // integration granularity

// Shared integration loop: one entry per 0.5% SoC step (soc/minutes at the step's end,
// kw = effective power mid-step), so the estimate and the chart can't disagree.
function integrate(car: Car, startSoc: number, targetSoc: number, stationKW: number, tempC?: number) {
  const cold = tempC === undefined ? 1 : coldFactor(tempC);
  const steps: Step[] = [];
  let minutes = 0;
  let stationLimited = false;

  for (let soc = startSoc; soc < targetSoc; soc += STEP_PCT) {
    const accepted = carAcceptedKW(car, soc + STEP_PCT / 2) * cold;
    const effective = Math.min(accepted, stationKW);
    if (stationKW < accepted) stationLimited = true;

    const stepEnergy = car.usableKWh * (STEP_PCT / 100); // kWh added this step
    minutes += (stepEnergy / effective) * 60;
    steps.push({ soc: soc + STEP_PCT, kw: effective, minutes });
  }
  return { steps, minutes, stationLimited };
}

/** Chart data: effective power and cumulative minutes, sampled every 2% SoC (plus the end). */
export function curveSeries(
  car: Car,
  startSoc: number,
  targetSoc: number,
  stationKW: number,
  tempC?: number,
): Step[] {
  if (targetSoc <= startSoc) return [];
  const { steps } = integrate(car, startSoc, targetSoc, stationKW, tempC);
  const out: Step[] = [{ soc: startSoc, kw: steps[0].kw, minutes: 0 }];
  steps.forEach((st, i) => {
    if ((i + 1) % 4 === 0 || i === steps.length - 1) out.push(st); // 4 x 0.5% = 2%
  });
  return out;
}
