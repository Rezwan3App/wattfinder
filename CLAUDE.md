# EV Charging Companion — project memory

Follow `project-workflow.md` operating rules (subagent orchestration, plugin usage, token efficiency, writing style) from the MD files masterlist folder for every session on this project.

## What this is

App track of Project 3 (portfolio piece). Full spec: `../MD files masterlist/project-3-ev-charging-companion.md`. Planning docs, decisions log, and Phase 0 research live in `../MD files masterlist/project-3-ev-app/` — not in this repo. This repo is code only.

## Locked-in decisions

- Metro area: NYC
- Car catalog: Tesla Model 3 LR RWD, Hyundai Ioniq 5 LR AWD, Chevy Bolt EV (curve data already researched)
- Data: real OpenChargeMap station data cached to JSON, never fetched live from the demo; synthetic seeded occupancy layer on top
- Stack: React + TypeScript + Tailwind + Leaflet (free tiles) + shadcn/ui, light serverless routes, Vercel deploy
- Repo: private, `Rezwan3App/ev-charging-companion` on GitHub

## Stack decision still open

Framework (Next.js vs. Vite + separate serverless functions) not yet chosen — decide at the start of Phase 1 based on how the serverless routes for station data / estimators are best served on Vercel.

## Blocking on Rezwan

- OpenChargeMap API key not yet registered (needed before Phase 1 data fetching)

## Session-close checklist

Before ending any session: write decisions made into this file or the planning decisions-log, update the phase checklist in README.md, note exactly where work stopped.
