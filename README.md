# Nomos

A society simulation where agents follow simple rules and AI theorists observe what emerges.

> **Status:** v0.1.0 — the simulation core and observers are working. See the [roadmap](#roadmap).

## Architecture

1. **Initial conditions** — population, resource landscape, starting equality, reproduction. Kept as minimal as defensible (Epstein's Rawlsian commitment).
2. **Agent model** — simple rules for movement, exchange, harvest, and metabolism. Each agent carries a _motivation_ (material, symbolic, normative, power) and a _sophistication_ (minimal, bounded-rational, adaptive, social) drawn from the mix set on the setup screen. Sophistication decides how an agent chooses where to move: minimal optimises greedily, bounded satisfices over a short horizon, adaptive learns how far to range from whether ranging pays off, and social follows and imitates its wealthiest neighbour.
3. **Simulation engine** — agents follow rules, society emerges. Trade, law, states, politics, conflict aren't programmed — they emerge or don't.
4. **Observers** — AI theorists (Bourdieu, Durkheim, Marx, Luhmann, Ibn Khaldun, Turchin, Schelling, Epstein, Flack) watch the same field and describe what they see in their own vocabulary.

## Stack

**Frontend**

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5
- Tailwind CSS v4
- Phosphor Icons
- Local fonts: Newsreader (serif) and Google Sans Flex (sans)

**Simulation runtime** _(planned)_

- PixiJS (WebGL) for the agent field — targeting 100k agents at 60fps
- Web Workers off the main thread for the tick loop
- D3 for territory contours and the subsystem force graph
- Zustand for cross-component state, Framer Motion for narrator transitions

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
  - Guided setup, floating metric windows (Gini, population, wealth, price), and a force-directed network graph.
- **v0.2 — Persistence** _(in progress)_
  - Save, list, and replay runs (Prisma + SQLite). ✓ — runs are deterministic from their config and seed, so a replay re-executes identically; the saved metric history and observer Chronicle are kept alongside.
  - Shareable run URLs. _(next)_
- **v0.3 — Scale & performance**
  - Move the tick loop into a Web Worker; render the agent field with PixiJS (WebGL), targeting 100k agents at 60fps.
- **v0.4 — Accounts & sharing**
  - Better Auth, Postgres, and a public gallery of saved runs.
- **Later**
  - Territory contours, a Luhmann-style subsystem graph, and additional agent models beyond `epstein_minimal`.

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
