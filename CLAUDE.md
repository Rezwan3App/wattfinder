# EV Charging Companion — project memory

Follow `project-workflow.md` operating rules (subagent orchestration, plugin usage, token efficiency, writing style) from the MD files masterlist folder for every session on this project.

## What this is

App track of Project 3 (portfolio piece). Full spec: `../MD files masterlist/project-3-ev-charging-companion.md`. Planning docs, decisions log, and Phase 0 research live in `../MD files masterlist/project-3-ev-app/` — not in this repo. This repo is code only.

## Locked-in decisions

- Metro area: NYC
- Car catalog: Tesla Model 3 LR RWD, Hyundai Ioniq 5 LR AWD, Chevy Bolt EV (curve data already researched)
- Data: real OpenChargeMap station data pulled once and cached into Postgres (never fetched live from the demo); synthetic seeded occupancy layer lives in the DB too, not just in-memory
- **Stack (Aug 15, 2026):** Next.js (App Router) + TypeScript + Tailwind + Leaflet (free tiles) + shadcn/ui. Postgres via Supabase for station + occupancy data (real schema, not static JSON) — chosen over Neon for the easier Vercel integration; swappable if it becomes friction. Deploys on Vercel.
- Deliberately semi-complex by request: real DB layer instead of flat JSON is the main added moving part, on top of the Next.js app.
- Optional Hugging Face Gradio mini-app (reusing the estimator code): deferred, decide again at Phase 4.
- Repo: private, `Rezwan3App/ev-charging-companion` on GitHub

## Blocking on Rezwan

- OpenChargeMap API key not yet registered (needed before Phase 1 data fetching)

## Session-close checklist

Before ending any session: write decisions made into this file or the planning decisions-log, update the phase checklist in README.md, note exactly where work stopped.
