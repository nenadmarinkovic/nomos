# Nomos

A society simulation where agents follow simple rules and AI theorists observe what emerges.

> **Status:** v0.1.0 — the simulation core and observers are working. See the [roadmap](#roadmap).

## Architecture

1. **Initial conditions** — population, resource landscape, starting equality, reproduction. Kept as minimal as defensible (Epstein's Rawlsian commitment).
2. **Agent model** — simple rules for movement, exchange, harvest, and metabolism. Each agent carries a _motivation_ (material, symbolic, normative, power) and a _sophistication_ (minimal, bounded-rational, adaptive, social) drawn from the mix set on the setup screen. Sophistication decides how an agent chooses where to move: minimal optimises greedily, bounded satisfices over a short horizon, adaptive learns how far to range from whether ranging pays off, and social follows and imitates its wealthiest neighbour.
3. **Simulation engine** — agents follow rules, society emerges. Trade, law, states, politics, conflict aren't programmed — they emerge or don't.
4. **Observers** — AI theorists (Bourdieu, Durkheim, Marx, Luhmann, Turchin, Schelling, Epstein, Flack) watch the same field and describe what they see in their own vocabulary.

## Stack

**Frontend**

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5
- Tailwind CSS v4
- Phosphor Icons
- Local fonts: Newsreader (serif) and Google Sans Flex (sans)

**Simulation runtime**

- Web Worker tick loop, posting world frames to the main thread as transferable buffers _(shipped)_
- Canvas2D agent field; PixiJS / WebGL renderer still pending for 100k-agent scale
- `d3-force` + `d3-zoom` + `d3-selection` for the 2D layouts that remain; Three.js (`react-force-graph-3d`) for the 3D Network view
- Zustand (with `persist`) for cross-component state and saved layout positions

**Data**

- Prisma + SQLite for local development
- PostgreSQL (Hetzner-managed) once multi-user and shareable runs land

**Observers**

- Mistral API (`mistral-small`) for per-theorist narration on significant events
- One Mistral call per active observer per significant event — not per tick
- The browser detects significant events (foundings, inequality surges, crashes, collapses) and posts them to `app/api/observe`, which builds a per-theorist prompt and calls Mistral. Readings stream into the **Chronicle** panel (Observers / Chronicle in the sidebar).
- Without a `MISTRAL_API_KEY` the simulation still runs; the observers simply stay silent.

**Infrastructure**

- Hetzner VPS (Falkenstein) running Dokploy for deploy + reverse proxy
- [Better Auth](https://www.better-auth.com) for auth (when user accounts are added)

## Roadmap

- **v0.1.0 — Simulation core + observers** _(current)_
  - Epstein-minimal agents on a two-good (sugar/spice) landscape: move, harvest, trade, metabolise, reproduce.
  - Emergent market: a price and trade volume that arise from local exchange, not from any global rule.
  - Four agent motivations and four sophistications, mixed per the setup screen and acted on by the engine.
  - AI observers (Mistral) that read significant events through each theorist's lens into the Chronicle.
  - Guided setup; floating, draggable metric windows (Gini, population, wealth distribution, trade price, motivation streamgraph) with corner-snap alignment.
- **v0.2 — Persistence** _(done)_
  - Save, list, and replay runs (Prisma + SQLite). Runs are deterministic from their config and seed, so a replay re-executes identically; the saved metric history and observer Chronicle are kept alongside.
  - Shareable run URLs — `/?run=<id>` loads a saved run and replays it.
- **v0.3 — Scale & performance** _(in progress)_
  - The tick loop runs in a Web Worker; the main thread renders interpolated frames the worker posts as transferable buffers, keeping the UI responsive. ✓
  - PixiJS (WebGL) field rendering toward 100k agents at 60fps. _(next)_
- **v0.3.x — Social structure & inspection** _(done)_
  - Persistent **trade-partner ties**: the engine tracks dyadic trade weights, bumping on each successful exchange and decaying multiplicatively each tick. Dead agents are scrubbed; ties below threshold are pruned.
  - 3D **Network** view (react-force-graph-3d / Three.js): every alive agent rendered as a Bauhaus-styled mesh (cube/sphere/cone/octahedron per motivation), edges showing each agent's top-3 strongest trade partners so cluster structure stays readable instead of becoming a hairball.
  - Orbit / zoom / drag camera; click-to-inspect side panel with live wealth, sugar/spice, age, vision, metabolism, embeddedness, and the agent's top six trade partners.
  - **Motivation streamgraph** window: stacked-area share of material/symbolic/normative/power motivations over time.
  - Sidebar **Canvas** menu (Field ↔ Network) replaces the old floating overlay.
- **v0.4 — Accounts & sharing**
  - Better Auth, Postgres, and a public gallery of saved runs.
- **Later**
  - Phase-space plot (e.g. Gini × Alive trajectory) and Sankey of agent state transitions for macro-behaviour reading.
  - Territory contours and a Luhmann-style subsystem graph.
  - Additional agent models beyond `epstein_minimal`.

## What still needs to be done

Near term, in rough priority:

1. **PixiJS WebGL field renderer** — replace the Canvas2D agent layer to push the geographic Field toward 100k agents at 60fps. Tick loop already lives in a worker, so this is a renderer-only swap.
2. **Phase-space plot** — a small window plotting (Gini, alive) over time as a single moving point with a fading trail. Shows the society's trajectory through stability/collapse.
3. **Accounts and sharing (v0.4)** — Better Auth + Postgres, public run gallery.
4. **Optional Sankey / state-transition view** — only worth doing once agents actually change motivation under the engine rules; today they don't, so this is parked.
5. **Territory contours and Luhmann subsystem graph** — long-tail nice-to-have.

## Develop

```bash
npm install                  # also runs `prisma generate`
cp .env.example .env         # DATABASE_URL is preset; add MISTRAL_API_KEY for observers
npm run db:push              # create the local SQLite database (prisma/dev.db)
npm run dev
```

`.env` (not `.env.local`) is used so the Prisma CLI and Next.js read the same file.

Open [http://localhost:3000](http://localhost:3000).

If styles look stale after a config change, clear Turbopack's cache:

```bash
rm -rf .next && npm run dev
```

## Scripts

```bash
npm run dev       # development server
npm run build     # production build
npm run start     # serve production build
npm run lint      # eslint
npm run db:push   # sync the Prisma schema to the local SQLite database
npm run db:migrate # create/apply a migration during schema changes
```
