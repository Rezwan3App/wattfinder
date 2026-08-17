# WattFinder

A smart EV charging companion app. Answers the two questions that actually matter in the moment: *which nearby station is free right now, and how long will charging actually take there for my car?*

This is the portfolio piece that fuses mechanical engineering (battery charge curves, power delivery, state-of-charge physics) with product management (turning that physics into a clean "go here, wait ~6 min, done in 25" consumer flow).

**Status:** Phase 1 not started. Phase 0 research is complete — see the spec and research links below.

## The pitch

Existing apps quote a station's max kW and leave the driver to guess. This app models the real charging curve per car (charging slows as the battery fills — it's not linear) and shows honest minutes-to-80%, plus real-time-feeling availability, so the recommendation is defensible: "Fastest total trip: Station B, ~4 min drive, open now, ~22 min to 80%."

## Scope for v1

- **Metro area:** NYC (real station data via OpenChargeMap)
- **Car catalog:** Tesla Model 3 LR RWD, Hyundai Ioniq 5 LR AWD, Chevy Bolt EV — three deliberately different charge-curve shapes (steep taper / plateau+cliff / stepped)
- **Data approach:** real station locations + connector types + power ratings from OpenChargeMap's free API, cached to JSON (never called live from the demo). Occupancy/availability is a synthetic, seeded, time-of-day-aware model layered on top.
- **Stack:** Next.js (App Router) + TypeScript + Tailwind, Leaflet (free tiles), shadcn/ui. Postgres via Supabase for cached station data and the occupancy layer (real schema, not static JSON — deliberately semi-complex). Deploys on Vercel.
- **Optional bonus (deferred, revisit Phase 4):** a Hugging Face Gradio mini-app reusing the estimator code, as a standalone engineering artifact.

## Two estimators (the engineering core)

1. **Availability / wait-time predictor** — synthetic occupancy by time-of-day/day-of-week, reproducible via seed. Outputs: likely free now / busy / short wait, plus estimated wait if busy.
2. **Charge-time estimator** — realistic per-car charging curve (not naive `kWh / kW`), min of station kW vs. car's accepted rate at current SoC. Outputs: realistic minutes to 80% (and full), with a small curve chart.

## Timeline estimate

Phase 0 done. Remaining: ~4-6 build sessions (1-1.5 for data layer, 0.5-1 for estimators, 1.5-2 for app build, 0.5-1 for polish/deploy, 0.5-1 for story assets). At one session/week that's 4-6 weeks to a live v1; two sessions some weeks compresses it to 2-3 weeks.

## Project narrative

WattFinder exists to fix a specific, common frustration for EV drivers: existing charging apps either don't know whether a nearby station is actually free right now, or they estimate charging time using a naive calculation that ignores how batteries actually behave. Drivers are told a station delivers "150 kW" and left to do the math themselves, when the real answer depends on their specific car, their current battery percentage, and the physics of how charging speed tapers as a battery fills up. The result is wasted trips to occupied or broken stations, and charge-time guesses that are routinely wrong by 10 to 15 minutes. WattFinder is built to answer the two questions that actually matter in that moment: which nearby station is free right now, and how long will charging honestly take, for this car, at this battery level, on this specific charger.

The app pulls real charging station locations, connector types, and power ratings from OpenChargeMap's public API for the New York metro area, cached into a Postgres database rather than fetched live, since OCM is a registry, not a real-time availability feed. On top of that real map data, WattFinder layers a synthetic but seeded and time-of-day-aware occupancy model to simulate realistic busy/free patterns, and a charge-time estimator that models the actual charging curve for three deliberately different EVs, a Tesla Model 3, a Hyundai Ioniq 5, and a Chevy Bolt, each of which tapers, plateaus, or steps down differently as the battery fills. The estimator takes the minimum of what the car can accept and what the station can deliver at that state of charge, so the app can say something like "Station B, about 4 minutes away, open now, roughly 22 minutes to 80 percent," and explain exactly how it got there.

Beyond the app itself, WattFinder is the deliberate fusion of the two halves of my background: the mechanical engineering training in battery behavior and power delivery from my time at Zachry Nuclear, and the product management instinct for turning that technical depth into a simple, trustworthy consumer decision. It's built as a portfolio piece for product management interviews, specifically to demonstrate that I can reason about the underlying engineering well enough to make a defensible product call, not just describe a feature on top of someone else's data. The honesty angle, showing drivers the real number instead of the misleading sticker spec, is both the technical differentiator and the interview story: an engineering insight that directly shapes a product decision.

## Resume bullet drafts

Not final, no fabricated metrics until the app is live and measured:

- Designed and built WattFinder, a full-stack EV charging app (Next.js, TypeScript, Supabase/Postgres) that models real per-vehicle charging curves across 3 EV platforms to replace misleading sticker-kW claims with physics-based charge-time predictions and live-feeling station availability.
- Built WattFinder end-to-end (React/Next.js, Postgres, real charging-station data) as a product case study in translating battery/power-delivery engineering into a consumer-facing recommendation feature.

## Build phases

- [~] Phase 1 — data layer: 498 real NYC stations + 541 connectors seeded into Postgres; occupancy profile columns in place (generator still to come)
- [~] Phase 2 — charge-time estimator built + verified (`src/lib/estimator.ts`); availability predictor still to come
- [ ] Phase 3 — app build (map + car setup + station detail + recommendation)
- [ ] Phase 4 — polish + mobile-first pass + Vercel deploy
- [ ] Phase 5 — story assets (architecture diagram, "how it works" explainer, portfolio page, walkthrough video)

## Blocking items

- [ ] Register a free OpenChargeMap API key at [openchargemap.org](https://openchargemap.org) (My Profile → My Apps → Register An Application) and drop it into `.env.local` (see `.env.local.example`)
- [ ] Create a free Supabase project (supabase.com) for the Postgres database and drop its connection details into `.env.local`

## Project docs

Full spec, decisions log, and Phase 0 research live outside this code repo, in the planning folder:

- [Project spec](../MD%20files%20masterlist/project-3-ev-charging-companion.md) — problem, decisions, product journey, build phases, definition of done
- [Planning README + decisions log](../MD%20files%20masterlist/project-3-ev-app/) — phase checklist, dated decisions
- [OpenChargeMap API research](../MD%20files%20masterlist/project-3-ev-app/research/openchargemap-api.md)
- [Charge-curve data (Model 3 / Ioniq 5 / Bolt)](../MD%20files%20masterlist/project-3-ev-app/research/charge-curves.md)
- [Competitor gap analysis](../MD%20files%20masterlist/project-3-ev-app/research/competitor-gap.md)

## Data attribution

Charging station data from [OpenChargeMap](https://openchargemap.org), licensed CC BY-SA 4.0.

This is a portfolio project — built to be shown, not sold.
