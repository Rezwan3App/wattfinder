// Self-check for the charge-time estimator. Run: npx tsx src/lib/estimator.test.ts
// Asserts the model reproduces published 10->80% charging times (within tolerance)
// and the qualitative behavior that makes the "honesty" pitch defensible.
import assert from "node:assert";
import { CARS, estimateChargeTime, carAcceptedKW } from "./estimator";

const car = (id: string) => {
  const c = CARS.find((x) => x.id === id);
  if (!c) throw new Error(`no car ${id}`);
  return c;
};

// Assert `actual` within `pct` of `target`.
function near(actual: number, target: number, pct: number, label: string) {
  const off = Math.abs(actual - target) / target;
  assert.ok(
    off <= pct,
    `${label}: got ${actual}, expected ~${target} (off ${(off * 100).toFixed(0)}%, tol ${pct * 100}%)`,
  );
  console.log(`ok  ${label}: ${actual} (target ~${target})`);
}

// Published 10->80% targets on a fast-enough stall (research/charge-curves.md).
near(estimateChargeTime(car("model3-lr-rwd"), 10, 80, 250).minutes, 34.5, 0.15, "Model 3, 250kW");
near(estimateChargeTime(car("ioniq5-lr-awd"), 10, 80, 350).minutes, 19.5, 0.2, "Ioniq 5, 350kW");
near(estimateChargeTime(car("bolt-ev"), 10, 80, 150).minutes, 73, 0.15, "Bolt, 150kW");

// The station-bottleneck story: Ioniq 5 on a 150kW unit must be slower and flagged.
const fast = estimateChargeTime(car("ioniq5-lr-awd"), 10, 80, 350);
const slow = estimateChargeTime(car("ioniq5-lr-awd"), 10, 80, 150);
assert.ok(slow.minutes > fast.minutes, "Ioniq on 150kW should be slower than on 350kW");
assert.ok(slow.stationLimited, "Ioniq on 150kW should be station-limited");
assert.ok(!fast.stationLimited, "Ioniq on 350kW should NOT be station-limited");
console.log(`ok  Ioniq station bottleneck: 350kW=${fast.minutes}min vs 150kW=${slow.minutes}min`);

// The Bolt is car-limited: a 350kW stall barely beats a 50kW one.
const bolt50 = estimateChargeTime(car("bolt-ev"), 10, 80, 50).minutes;
const bolt350 = estimateChargeTime(car("bolt-ev"), 10, 80, 350).minutes;
assert.ok(Math.abs(bolt50 - bolt350) / bolt350 < 0.1, "Bolt should be ~same on 50kW vs 350kW");
console.log(`ok  Bolt is car-limited: 50kW=${bolt50}min vs 350kW=${bolt350}min`);

// Sanity: power must monotonically taper past the peak (no charging faster while fuller).
assert.ok(carAcceptedKW(car("model3-lr-rwd"), 30) > carAcceptedKW(car("model3-lr-rwd"), 70), "Model 3 must taper");

console.log("\nAll estimator checks passed.");
