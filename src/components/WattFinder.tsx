"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { CARS, coldFactor, estimateChargeTime, type Car } from "@/lib/estimator";
import { rankStations, type Ranked } from "@/lib/recommend";
import type { Station } from "@/lib/stations";
import type { LiveConditions } from "@/lib/weather";
import ChargeCurve from "./ChargeCurve";

const StationMap = dynamic(() => import("./StationMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-soft" aria-label="Loading map" />,
});

const MIDTOWN = { lat: 40.7549, lng: -73.984 };
const SHOWN = 8;
const STATUS_LABEL = { free: "Likely free", "short-wait": "Short wait", busy: "Likely busy" } as const;
const STATUS_TEXT = { free: "text-free", "short-wait": "text-wait", busy: "text-busy" } as const;
const STATUS_BG = { free: "bg-free", "short-wait": "bg-wait", busy: "bg-busy" } as const;

const short = (c: Car) => c.name.split(" ").slice(0, 3).join(" ");
const fmt = (min: number) => {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

function honesty(r: Ranked, car: Car) {
  const kw = Math.round(r.connector.powerKw);
  if (r.stationLimited)
    return `This ${kw} kW stall is the limit. Your ${short(car)} could take more.`;
  return `Your ${short(car)} is the limit. This ${kw} kW stall can only feed it about ${Math.round(r.effectiveKw)} kW.`;
}

export default function WattFinder({
  stations,
  source,
  conditions,
}: {
  stations: Station[];
  source: "database" | "cache";
  conditions: LiveConditions | null;
}) {
  const [carId, setCarId] = useState(CARS[0].id);
  const [startSoc, setStartSoc] = useState(20);
  const [targetSoc, setTargetSoc] = useState(80);
  const [dcOnly, setDcOnly] = useState(true);
  const [origin, setOrigin] = useState(MIDTOWN);
  const [originLabel, setOriginLabel] = useState("Midtown Manhattan");
  const [geoMsg, setGeoMsg] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Clock is read after mount so server and client markup match.
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const car = CARS.find((c) => c.id === carId) ?? CARS[0];
  const tempC = conditions?.tempC;
  const valid = targetSoc > startSoc;

  const ranked = useMemo(
    () =>
      now && valid
        ? rankStations(stations, { car, startSoc, targetSoc, origin, now, tempC, dcOnly, limit: 25 })
        : [],
    [stations, car, startSoc, targetSoc, origin, now, tempC, dcOnly, valid],
  );
  const selected = ranked.find((r) => r.station.ocmId === selectedId) ?? ranked[0];

  function locate() {
    if (!navigator.geolocation) {
      setGeoMsg("This browser can't share location. Still using Midtown Manhattan.");
      return;
    }
    setGeoMsg("Finding you...");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude });
        setOriginLabel("your location");
        setGeoMsg("");
        setSelectedId(null);
      },
      () => {
        setGeoMsg("Location was blocked or unavailable. Still using Midtown Manhattan.");
      },
      { timeout: 10_000 },
    );
  }

  const cf = tempC === undefined ? 1 : coldFactor(tempC);
  const slower = Math.round((1 - cf) * 100);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-4 sm:py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">wattfinder</h1>
        <p className="text-sm text-muted">Which NYC station, and how long charging really takes for your car.</p>
      </header>

      <section aria-label="Live conditions" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        {conditions ? (
          <p>
            <strong className="font-semibold">{Math.round(conditions.tempC)} &deg;C in NYC</strong>
            <span className="text-muted">
              {" "}as of{" "}
              {new Date(conditions.observedAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/New_York",
              })}{" "}
              ET (Open-Meteo).{" "}
            </span>
            {slower >= 3
              ? `Cold batteries charge slower: estimates below run about ${slower}% longer than a warm pack.`
              : "At this temperature the cold-weather penalty is negligible."}
          </p>
        ) : (
          <p className="text-muted">
            Live weather is unavailable right now, so estimates assume a warm battery. Cold weather can make real charging noticeably slower.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <section aria-label="Your trip" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
            <div>
              <label htmlFor="car" className="mb-1 block text-sm font-medium">Your car</label>
              <select
                id="car"
                value={carId}
                onChange={(e) => setCarId(e.target.value)}
                className="min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm"
              >
                {CARS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Slider
              id="start"
              label="Battery now"
              value={startSoc}
              max={95}
              onChange={(v) => {
                setStartSoc(v);
                if (v >= targetSoc) setTargetSoc(Math.min(100, v + 5));
              }}
            />
            <Slider
              id="target"
              label="Charge up to"
              value={targetSoc}
              max={100}
              onChange={(v) => {
                setTargetSoc(v);
                if (v <= startSoc) setStartSoc(Math.max(0, v - 5));
              }}
            />
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={dcOnly} onChange={(e) => setDcOnly(e.target.checked)} className="size-5" />
              DC fast chargers only
            </label>
            <div className="border-t border-line pt-3 text-sm">
              <p className="mb-2 text-muted">Starting from {originLabel}</p>
              <button
                type="button"
                onClick={locate}
                className="min-h-11 rounded-md border border-primary px-4 font-medium text-primary hover:bg-soft"
              >
                Use my location
              </button>
              {geoMsg && <p role="status" className="mt-2 text-muted">{geoMsg}</p>}
            </div>
          </section>

          <section aria-label="Ranked stations">
            <h2 className="mb-2 text-base font-semibold">Best stations for you</h2>
            {!now ? (
              <p className="text-sm text-muted">Working out the best options...</p>
            ) : ranked.length === 0 ? (
              <p className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
                {valid ? "No stations match. Try turning off the DC fast filter." : "Set the target above your current battery level."}
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {ranked.slice(0, SHOWN).map((r, i) => {
                  const active = r.station.ocmId === selected?.station.ocmId;
                  return (
                    <li key={r.station.ocmId}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedId(r.station.ocmId)}
                        className={`w-full rounded-lg border p-3 text-left ${active ? "border-primary bg-soft" : "border-line bg-surface hover:bg-soft/60"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium leading-snug">
                              {i === 0 && (
                                <span className="mr-2 rounded bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-ink">Best</span>
                              )}
                              {r.station.name}
                            </p>
                            <p className="text-xs text-muted">
                              {r.station.town ?? "NYC"} &middot; {r.distanceKm.toFixed(1)} km &middot; {Math.round(r.connector.powerKw)} kW {r.connector.connectorType}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-semibold leading-none">{fmt(r.totalMinutes)}</p>
                            <p className="text-xs text-muted">total</p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          Drive {fmt(r.driveMinutes)} &middot; wait {r.availability.waitMinutes > 0 ? fmt(r.availability.waitMinutes) : "none expected"} &middot; charge {fmt(r.chargeMinutes)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs">
                          <span className={`size-2 rounded-full ${STATUS_BG[r.availability.status]}`} aria-hidden />
                          <span className={`font-medium ${STATUS_TEXT[r.availability.status]}`}>{STATUS_LABEL[r.availability.status]}</span>
                          <span className="text-muted">(modeled)</span>
                        </p>
                        <p className="mt-1 text-xs text-muted">{honesty(r, car)}</p>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <div className="h-80 overflow-hidden rounded-lg border border-line sm:h-96 lg:h-[26rem]">
            <StationMap
              ranked={ranked}
              origin={origin}
              selectedId={selected?.station.ocmId ?? null}
              onSelect={setSelectedId}
            />
          </div>

          {selected && (
            <section aria-label="Station detail" className="rounded-lg border border-line bg-surface p-4">
              <h2 className="text-base font-semibold">{selected.station.name}</h2>
              <p className="mb-3 text-sm text-muted">
                {selected.station.town ?? "NYC"} &middot; {selected.connector.connectorType} at {Math.round(selected.connector.powerKw)} kW &middot; {short(car)}, {startSoc}% to {targetSoc}%
              </p>
              <Compare r={selected} car={car} startSoc={startSoc} targetSoc={targetSoc} tempC={tempC} />
              <p className="mb-1 mt-4 text-sm font-medium">Charging power as the battery fills</p>
              <ChargeCurve
                car={car}
                startSoc={startSoc}
                targetSoc={targetSoc}
                stationKw={selected.connector.powerKw}
                tempC={tempC}
              />
              <p className="mt-2 text-xs text-muted">{honesty(selected, car)}</p>
            </section>
          )}
        </div>
      </div>

      <footer className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
        <p>
          Stations come from OpenChargeMap (CC BY-SA 4.0), read from{" "}
          {source === "database" ? "the project database" : "a saved snapshot, because the database was unreachable"}.
          Availability is a modeled estimate based on time of day, not live occupancy. Charging curves are from
          published tests and may differ from your car. Map data &copy; OpenStreetMap contributors.
        </p>
      </footer>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full"
      />
    </div>
  );
}

function Compare({
  r,
  car,
  startSoc,
  targetSoc,
  tempC,
}: {
  r: Ranked;
  car: Car;
  startSoc: number;
  targetSoc: number;
  tempC?: number;
}) {
  const kwh = (car.usableKWh * (targetSoc - startSoc)) / 100;
  const naive = (kwh / r.connector.powerKw) * 60;
  const real = estimateChargeTime(car, startSoc, targetSoc, r.connector.powerKw, tempC);
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-md border border-line p-3">
        <p className="text-xs text-muted">Naive estimate</p>
        <p className="text-2xl font-semibold tabular-nums text-muted line-through decoration-1">{fmt(naive)}</p>
        <p className="text-xs text-muted">
          {kwh.toFixed(0)} kWh at the stall&apos;s full {Math.round(r.connector.powerKw)} kW
        </p>
      </div>
      <div className="rounded-md border border-primary bg-soft p-3">
        <p className="text-xs text-muted">wattfinder estimate</p>
        <p className="text-2xl font-semibold tabular-nums text-primary">{fmt(real.minutes)}</p>
        <p className="text-xs text-muted">average {Math.round(real.avgKW)} kW, curve and weather included</p>
      </div>
    </div>
  );
}
