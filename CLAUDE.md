# WattFinder: project memory

Follow `project-workflow.md` operating rules (subagent orchestration, plugin usage, token efficiency, writing style) from the MD files masterlist folder for every session on this project.

## What this is

App track of Project 3 (portfolio piece). Full spec: `../MD files masterlist/project-3-ev-charging-companion.md`. Planning docs, decisions log, and Phase 0 research live in `../MD files masterlist/project-3-ev-app/`: not in this repo. This repo is code only.

## Locked-in decisions

- Metro area: NYC
- Car catalog: Tesla Model 3 LR RWD, Hyundai Ioniq 5 LR AWD, Chevy Bolt EV (curve data already researched)
- Data: real OpenChargeMap station data pulled once and cached into Postgres (never fetched live from the demo); synthetic seeded occupancy layer lives in the DB too, not just in-memory
- **Stack (Aug 15, 2026):** Next.js (App Router) + TypeScript + Tailwind + Leaflet (free tiles) + shadcn/ui (planned). Postgres via Supabase for station + occupancy data (real schema, not static JSON): chosen over Neon for the easier Vercel integration; swappable if it becomes friction. Deploys on Vercel.
- Deliberately semi-complex by request: real DB layer instead of flat JSON is the main added moving part, on top of the Next.js app.
- Optional Hugging Face Gradio mini-app (reusing the estimator code): deferred, decide again at Phase 4.
- Repo: private, `Rezwan3App/wattfinder` on GitHub, local folder `Desktop/wattfinder`

## Design direction (added Aug 15, 2026: build itself deferred to a later session)

- **Primary color: green.** Soft/muted background treatment, not a stark or saturated look: soft green backgrounds specifically called out (details TBD once real design work starts).
- Use the `/impeccable` skill for the actual design pass when Phase 3 starts, not a generic frontend build.
- **Logo:** he wants real logo inspiration he sources himself, not AI-generated logo concepts. Wait for him to bring reference images before proposing any logo direction.
- Hosted live on Vercel (already the plan): confirmed, not just a placeholder deploy target. Default `wattfinder.vercel.app` subdomain for now; custom domain is a later, explicitly-approved purchase decision, not assumed.
- **Project name: WattFinder**, brand casing is lowercase **wattfinder** in logo/headers (decided Aug 15, 2026, "simple/direct descriptive" direction). Repo and local folder renamed to `wattfinder`.

## Progress

- Aug 15, 2026: Next.js app scaffolded (TS, Tailwind, App Router, src/, ESLint). create-next-app also dropped an `AGENTS.md` (its default): this CLAUDE.md is still the source of truth.
- Aug 15, 2026: Charge-time estimator built + verified: `src/lib/estimator.ts` (3-car curve data + `estimateChargeTime`), self-check `src/lib/estimator.test.ts` (`npm run test:estimator`). Reproduces published 10->80% times within tolerance; Bolt reads ~65 vs 73min (linear-interp ceiling, noted with a ponytail comment). This is the Phase 2 charge-time core, done early because it needed no API keys.
- Aug 17, 2026: Both blockers cleared (OCM key + Supabase project `nsmkanozwuwgynatdaft`, us-east-2). Keys/URL in `.env.local` (gitignored). Service role key still blank there but not needed: seed uses DATABASE_URL directly.
- Aug 17, 2026: **Phase 1 data layer mostly done.** Schema applied (migration `stations_schema`): `stations` + `station_connections`, RLS on with public-read-only policies. `scripts/fetch-ocm.ts` pulls NYC (bounding box) -> `data/stations-nyc.json` (committed) + raw dump (gitignored). `scripts/seed.ts` loads it via `pg`/DATABASE_URL. Seeded: 498 stations, 541 connectors, 35 towns, 89 DC connectors, max 350kW. Occupancy profile columns (`base_utilization`, `occupancy_seed`) populated deterministically from ocm_id.
- Oct 25, 2026: Parallel build session. README rewritten for public/portfolio use. Built and verified (tsc, lint, build, both self-checks pass; checked in the browser at desktop and 375px): `src/lib/stations.ts` (getStations: Postgres, falls back to committed `data/stations-nyc.json` when DB unreachable), `src/lib/occupancy.ts` (deterministic synthetic availability, NYC local time, seeded by station id), `src/lib/weather.ts` (live Open-Meteo temp, no key, feeds cold-pack derating), estimator extensions (cold derating, onboard AC limits, curveSeries), `src/lib/recommend.ts` (rank by drive + modeled wait + charge time), and the Leaflet map UI (car picker, SoC sliders, ranked list, detail with curve chart and naive-vs-honest). Added `docs/overview.html` (60-second recruiter overview, also published as a private claude.ai artifact). Ranking adds a 12-min Hudson crossing penalty (straight line Battery to GW Bridge) so NJ stations stop out-ranking closer Manhattan ones.
- Oct 26, 2026: Fixed the OCM 500-result cap. Ported the tiled bounding-box fetch and fuller connector-ID map from the Cursor branch by hand into `scripts/fetch-ocm.ts` (branch not merged: it predates the UI, moves `pg` to devDependencies which would break runtime DB reads, and carries the AI logo). Snapshot is now 1,656 stations / 1,790 connectors / 141 towns / 173 with DC / max 400 kW. NACS (J3400) maps to "Tesla". Ranking now lets a Model 3 use Tesla AC destination chargers. Postgres still holds the old 498 rows: run `npm run seed` after unpausing.
- **Supabase is PAUSED (Oct 2026).** Also: the direct host `db.<ref>.supabase.co` is IPv6-only, so on IPv4 networks and on Vercel use the Session pooler string (dashboard, Connect, Session pooler) as `DATABASE_URL`. The app must run without the DB via the snapshot fallback.
- **Next step:** unpause Supabase and reseed (or leave on snapshot), then Phase 4: mobile pass, Vercel deploy (needs pooler `DATABASE_URL` env var), then story assets. Cursor branch `cursor/fix-review-issues-ea29` can be deleted once Rezwan agrees (its useful parts are ported).

## Supabase project

- Project ref: `nsmkanozwuwgynatdaft`, region us-east-2. Free tier auto-pauses after ~7 days idle: un-pause in the dashboard if a session hits a dead DB.
- Seed/re-seed: `npm run fetch:stations` then `npm run seed`. Schema of record: `db/schema.sql`.
- Aug 17, 2026 (review pass): dropped redundant `occupancy_seed` column (was a copy of ocm_id; use ocm_id as the occupancy seed). Added `db/schema.sql`, made `tsx` a real devDependency (npm scripts were broken without it), added `fetch:stations`/`seed` npm scripts.

## Session-close checklist

Before ending any session: write decisions made into this file or the planning decisions-log, update the phase checklist in README.md, note exactly where work stopped.

## Docs rules

- README.md is public-facing: no links outside the repo. Planning-folder pointers live here only.
- Planning docs: `../MD files masterlist/project-3-ev-app/` (README, decisions-log, research/*.md) and `../MD files masterlist/project-3-ev-charging-companion.md`.
- Known doc/code mismatches: research says "use step functions" for the Bolt and "model the Ioniq 400V-charger limit"; code uses linear interpolation (Bolt reads 65 vs 73 min) and no voltage limit. The decisions-log still names the repo `ev-charging-companion` in one early entry (renamed to wattfinder the same day), and its phase checklist is stale.
- Resolved Oct 26, 2026: Cursor branch `cursor/fix-review-issues-ea29` tiled fetch + connector map ported by hand; logo files and other changes dropped. Branch still exists on GitHub.

## Portfolio notes

Moved out of the README. Timeline estimate (as of Aug 2026): about 4-6 build sessions total (1-1.5 data layer, 0.5-1 estimators, 1.5-2 app, 0.5-1 polish/deploy, 0.5-1 story assets).

Resume bullet drafts (not final, no fabricated metrics until live and measured):

- Designed and built WattFinder, a full-stack EV charging app (Next.js, TypeScript, Supabase/Postgres) that models real per-vehicle charging curves across 3 EV platforms to replace misleading sticker-kW claims with physics-based charge-time predictions and availability modeling.
- Built WattFinder end-to-end (React/Next.js, Postgres, real charging-station data) as a product case study in translating battery/power-delivery engineering into a consumer-facing recommendation feature.

Interview story: engineering insight (charge curves, Bolt caps near 55 kW so a faster charger is wasted) drives a product decision (rank by total time, say so honestly). Be upfront that availability is modeled, weather is the only live input.
