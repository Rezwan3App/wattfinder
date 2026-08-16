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

## Build phases

- [ ] Phase 1 — data layer (cached OCM stations + synthetic occupancy + charge-curve model)
- [ ] Phase 2 — estimators (availability predictor + charge-time estimator as serverless functions)
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

This is a portfolio project — built to be shown, not sold.
