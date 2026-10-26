import type { Car } from "@/lib/estimator";
import { curveSeries } from "@/lib/estimator";

const W = 320;
const H = 150;
const PAD = { l: 34, r: 8, t: 10, b: 24 };

/** Power delivered vs state of charge. Hand-written SVG, no chart library. */
export default function ChargeCurve({
  car,
  startSoc,
  targetSoc,
  stationKw,
  tempC,
}: {
  car: Car;
  startSoc: number;
  targetSoc: number;
  stationKw: number;
  tempC?: number;
}) {
  const pts = curveSeries(car, startSoc, targetSoc, stationKw, tempC);
  if (pts.length < 2) return null;
  const peak = Math.max(...pts.map((p) => p.kw));
  const yMax = Math.ceil((peak * 1.15) / 50) * 50;
  const x = (soc: number) =>
    PAD.l + ((soc - startSoc) / (targetSoc - startSoc)) * (W - PAD.l - PAD.r);
  const y = (kw: number) => PAD.t + (1 - kw / yMax) * (H - PAD.t - PAD.b);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.soc).toFixed(1)},${y(p.kw).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts[pts.length - 1].soc)},${y(0)} L${x(pts[0].soc)},${y(0)} Z`;
  const ticks = [0, yMax / 2, yMax];
  const stationVisible = stationKw <= yMax;
  const label = `Charging power against battery level for the ${car.name}, from ${startSoc}% to ${targetSoc}%. Peak ${Math.round(peak)} kilowatts.`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={PAD.l - 5} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">
            {Math.round(t)}
          </text>
        </g>
      ))}
      <path d={area} fill="var(--primary-soft)" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
      {stationVisible && (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(stationKw)} y2={y(stationKw)} stroke="var(--muted)" strokeDasharray="4 3" />
          <text x={W - PAD.r} y={y(stationKw) - 3} textAnchor="end" fontSize="9" fill="var(--muted)">
            station max {Math.round(stationKw)} kW
          </text>
        </g>
      )}
      <text x={PAD.l} y={H - 8} fontSize="9" fill="var(--muted)">{startSoc}%</text>
      <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="9" fill="var(--muted)">{targetSoc}%</text>
      <text x={(PAD.l + W - PAD.r) / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--muted)">battery level</text>
      <text x={4} y={8} fontSize="9" fill="var(--muted)">kW</text>
    </svg>
  );
}
