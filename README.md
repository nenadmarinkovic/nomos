# Nomos

A society simulation where agents follow simple rules and AI theorists observe what emerges.

> **Status:** the simulation core, the engine's social mechanics, and the observers are working; scale/performance (PixiJS) and accounts are the open fronts. See the [roadmap](#roadmap).

## Architecture

1. **Initial conditions** — population, resource landscape, starting equality, reproduction. Kept as minimal as defensible (Epstein's Rawlsian commitment).
2. **Agent model** — simple rules for movement, exchange, harvest, and metabolism. Each agent carries a _motivation_ (material, symbolic, normative, power) and a _sophistication_ (minimal, bounded-rational, adaptive, social) drawn from the mix set on the setup screen. Sophistication decides how an agent chooses where to move: minimal optimises greedily, bounded satisfices over a short horizon, adaptive learns how far to range from whether ranging pays off, and social follows and imitates its wealthiest neighbour. Motivation isn't fixed for life — through cultural transmission an agent can take on the motivation of a wealthier neighbour, so a dominant strain can spread horizontally across the field.
3. **Simulation engine** — agents follow their local rules and macro-structure emerges. The engine programs only _local primitives_: harvest, bilateral exchange, predation by power-seekers, imitation of richer neighbours, community sanction of coercion, and inheritance along trade ties. What those primitives add up to — a market and its price, inequality, spatial segregation, elite capture, demographic boom and bust, collapse — isn't scripted anywhere; it emerges from the interactions, or it doesn't. (This is a deliberate shift from the v0.1 "nothing but harvest and trade" engine: conflict and norms are now primitives rather than hoped-for emergents, which buys richer dynamics at the cost of a little of the original Rawlsian minimalism.)
4. **Observers** — AI theorists (Marx, Polanyi, Bourdieu, Durkheim, Granovetter, Schelling, Turchin, Farmer, Epstein, Flack) watch the same field and describe what they see in their own vocabulary.

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
- The browser detects significant events and posts them to `app/api/observe`, which builds a per-theorist prompt and calls Mistral. Readings stream into the **Chronicle** panel (Observers / Chronicle in the sidebar). Detection spans the macro economy (foundings, inequality surges and levelings, stratification, population booms and crashes, market formation, price shocks, collapse) **and** the social structure the engine now grows — spatial **segregation** (motivation clustering, a Schelling index), **cultural takeovers** (one motivation's share surging), **coercion waves** (bursts of predation, with community sanction), and **trade-web fracture** (ties dissolving into isolation). Each event kind routes to the theorist whose lens has the most purchase on it.
- Without a `MISTRAL_API_KEY` the simulation still runs; the observers simply stay silent.

**Infrastructure**

- Hetzner VPS (Falkenstein) running Dokploy for deploy + reverse proxy
- [Better Auth](https://www.better-auth.com) for auth (when user accounts are added)

## Roadmap

- **v0.1.0 — Simulation core + observers** _(done)_
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
- **v0.5 — Engine social mechanics** _(done)_
  - **Conflict**: power-motivated agents seize a share of a weaker neighbour's holdings. A witnessing Normative agent shames the aggressor, who is then refused trade by the community for a spell — coercion carries a real economic cost, not just a tag.
  - **Cultural transmission**: agents occasionally adopt the motivation of a wealthier neighbour, so motivations spread horizontally and a strain can colonise a neighbourhood by example, not only by birth.
  - **Inheritance**: a dying agent bequeaths its holdings to surviving trade-tie partners, weighted by tie strength, so wealth concentrates across generations instead of vanishing.
  - **Demographic dynamics**: wealth- and age-gated reproduction under a population cap, with a mutation / extinction guard so rare motivations always have a path back.
  - **Seasonal substrate**: regrowth breathes on a slow cycle, so booms and famines become inevitable rather than purely the product of internal shocks.
  - **Richer event detection**: alongside the macro-economic events, the detector now surfaces the social structure the engine grows — spatial **segregation**, **cultural takeovers**, **coercion waves**, and **trade-web fracture** — each routed to the best-fit theorist.
- **v0.4 — Accounts & sharing**
  - Better Auth, Postgres, and a public gallery of saved runs.
- **Later**
  - Phase-space plot (e.g. Gini × Alive trajectory) and Sankey of agent state transitions for macro-behaviour reading.
  - Territory contours.
  - Additional agent models beyond `epstein_minimal`.

## What still needs to be done

Near term, in rough priority:

1. **PixiJS WebGL field renderer** — replace the Canvas2D agent layer to push the geographic Field toward 100k agents at 60fps. Tick loop already lives in a worker, so this is a renderer-only swap.
2. **Phase-space plot** — a small window plotting (Gini, alive) over time as a single moving point with a fading trail. Shows the society's trajectory through stability/collapse.
3. **Accounts and sharing (v0.4)** — Better Auth + Postgres, public run gallery.
4. **Optional Sankey / state-transition view** — now that motivations change at runtime (cultural transmission and imitation), a Sankey of motivation transitions would have real flows to show. Worth doing once the macro views settle.
5. **Territory contours** — long-tail nice-to-have.

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
