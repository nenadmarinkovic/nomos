# Development

## Stack

- **Front end.** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind v4, Phosphor Icons.
- **The simulation.** Runs in a Web Worker and posts each frame to the main thread as a transferable buffer. The map is drawn with Pixi.js v8 (WebGL), the network view with `react-force-graph-3d` (Three.js). State is in Zustand.
- **Data.** Prisma with PostgreSQL. There is a `docker-compose.yml` for a local one.
- **The observers.** Mistral (`mistral-small`), one call per event, sent from the browser through `app/api/observe`.
- **Hosting.** A Hetzner VPS in Falkenstein, running Dokploy.

## Quick start

Install dependencies (this also runs `prisma generate`):

```bash
npm install
```

Copy the env file. `DATABASE_URL` already points at the local Postgres from `docker-compose.yml`. Add `MISTRAL_API_KEY` if you want the observers to say anything:

```bash
cp .env.example .env
```

Start Postgres, create the tables, then start the dev server:

```bash
docker compose up -d postgres
npm run db:push
npm run dev
```

Everything reads `.env` rather than `.env.local`, so the Prisma CLI and Next.js see the same file.

Open [http://localhost:3000](http://localhost:3000).

If styles look stale after a config change, clear Turbopack's cache:

```bash
rm -rf .next && npm run dev
```

## Scripts

| script               | what it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | development server                            |
| `npm run build`      | production build                              |
| `npm run start`      | serve the production build                    |
| `npm run lint`       | eslint                                        |
| `npm run db:push`    | push the Prisma schema to your local database |
| `npm run db:migrate` | create or apply a migration                   |

## Architecture

There are three layers.

**The browser**, where both the engine and the whole interface live.

- A _Web Worker_ calls `engine.tick()` on a timer set by the speed control. Each turn produces a `WorldFrame` that gets handed to the main thread as transferable `ArrayBuffer`s, so nothing has to be copied.
- The _main thread_ turns those frames back into a `WorldView`, holds the store, draws the map and the network view, watches for notable events, and runs the inspector and the floating windows.

**The server**, which is a handful of Next.js route handlers.

- `/api/observe` takes an event and an observer from the browser, builds the two prompts, calls Mistral, and sends the paragraph back. It is the only route that costs money per request, so it is rate limited (`lib/rate-limit.ts`, with the policy in `lib/observe-rate-limit.ts`): a per-minute burst limit inside a per-hour limit, counted per user when signed in and per IP otherwise, plus an overall hourly ceiling for the whole deployment. Over the limit it returns `429` with `Retry-After`, and the app pauses instead of retrying. The numbers are set by `OBSERVE_LIMIT_*` env vars, see `.env.example`. The counters live in memory, so with multiple instances each one counts separately.

**Mistral**, called once per notable event rather than once per turn. Without `MISTRAL_API_KEY` everything still runs and the observers stay quiet.

What happens when one event fires:

```
Web Worker  ─[frames]─▶  Main thread  ─[POST]─▶  /api/observe  ─[prompt]─▶  Mistral
                                                                                │
                       Narrator page  ◀────────────────[paragraph]──────────────┘
```

- **The engine** (`lib/engine.ts`) is a plain TypeScript class. No React, no DOM. It runs in a Web Worker (`app/worker.ts`) and produces a `WorldFrame` every turn.
- **The worker** hands each frame over as transferable `ArrayBuffer`s, and the main thread unpacks it into a `WorldView` (`lib/world.ts`).
- **The store** (`lib/store.ts`, Zustand) holds the latest snapshot, the settings, the observer writing, and which windows are open.
- **The canvas** (`components/simulation-canvas.tsx`) reads the latest `WorldView` straight from `activeWorldRef`, a mutable ref the worker keeps up to date, and paints at 60fps. It deliberately does not go through the store.
- **The narrator** (`components/observer-narrator.tsx`) reads snapshots from the store, runs `detectEvent` against recent history, picks an observer with `pickObserver`, and posts to `/api/observe`.

## Where things live

| file                               | what's in it                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `lib/engine.ts`                    | The engine, everything that happens per turn, and all the constants. The biggest file by far. |
| `lib/config.ts`                    | What the setup screen offers, the three sizes, and who the observers are.                     |
| `lib/world.ts`                     | The `WorldView` shape and how frames get packed and unpacked.                                 |
| `lib/events.ts`                    | Spotting notable events, and writing the plain summary of each.                               |
| `lib/observers.ts`                 | Building the prompts.                                                                         |
| `lib/observer-routing.ts`          | Which observers get which kind of event.                                                      |
| `lib/render-resources.ts`          | Drawing the food layer, shared by the map renderer.                                           |
| `lib/store.ts`                     | The store.                                                                                    |
| `app/worker.ts`                    | The turn loop, in a Web Worker.                                                               |
| `app/api/observe/route.ts`         | The route that calls Mistral.                                                                 |
| `components/simulation-canvas.tsx` | The map.                                                                                      |
| `components/network-canvas.tsx`    | The 3D network view.                                                                          |
| `components/observer-narrator.tsx` | Spotting events, calling the model, storing what comes back.                                  |
| `components/agent-inspector.tsx`   | The draggable panel for a single agent.                                                       |
| `components/pages/*.tsx`           | The four pages in the sidebar: World, Agents, Metrics, Narrator.                              |
| `scripts/bench.ts`                 | Runs the engine with no interface, for tuning.                                                |

## The bench

`scripts/bench.ts` runs the engine with nothing attached, no React, no graphics, no observers, and prints out where things stand at intervals for all three sizes. Use it whenever you change a constant or a rule, so you can see the effect without opening the app.

```bash
npx tsx scripts/bench.ts
```

Output is one row per `sampleEvery` turns per scale, with columns:

`turn alive gini coerce shame ties isol% tokens issuers land price vol tVol mat sym norm pow`

Read down the columns to spot patterns: inequality climbing forever, IOUs never catching on, one type taking over completely. Runs are fully determined by their seed, so you can compare before and after a change directly.

## Numbers worth tuning

Most useful constants in `lib/engine.ts`:

| constant                                | what it changes                                    | what it looks like when it's wrong              |
| --------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `ATTEMPT_RATE = 0.18`                   | how often agents attack                            | runs feel too violent, or suspiciously calm     |
| `HABITUS_COST_PER_UNIT = 6`             | what imitation costs                               | one type takes over immediately, or never       |
| `DEGRADE_PER_HARVEST = 0.004`           | how fast land wears out                            | the land never changes, or is ruined in no time |
| `RECOVERY_RATE = 0.0008`                | how fast empty land repairs                        | land never heals, or heals instantly            |
| `TOKEN_PRIOR_LIABILITY = 4`             | how much credit a new issuer gets                  | IOUs never catch on, or catch on immediately    |
| `TIE_DECAY = 0.97`                      | how long relationships last                        | nobody keeps a partner, or nobody ever changes  |
| `DISTRUST_DECAY = 0.98`                 | how long grudges last                              | norms evaporate, or never fade at all           |
| `WITNESS_PROSOCIALITY_THRESHOLD = 0.65` | who bothers to shame an attacker                   | nobody is ever shamed, or everybody is          |
| `BANK_RUN_THRESHOLD = 0.35`             | how much distrust starts a run                     | bank runs never happen, or happen constantly    |
| `BANK_RUN_COOLDOWN = 60`                | turns between runs                                 | back-to-back runs blur into one long collapse   |
| favoured-partner list cap = 6           | how much of a neighbour's taste in partners sticks | partners feel random, or never change           |

In `lib/events.ts`:

| constant                           | what it changes                                     |
| ---------------------------------- | --------------------------------------------------- |
| `COOLDOWN = 12`                    | minimum gap between any two events                  |
| `KIND_COOLDOWN.coercion_wave = 60` | minimum gap for the noisy events                    |
| `EXTREME_INEQUALITY_LEVEL = 0.6`   | how unequal counts as extreme                       |
| `OLIGARCHY_LEVEL = 0.8`            | how much the top 10% has to hold                    |
| `SUSTAINED_HIGH_DURATION = 80`     | how many turns it has to hold before it counts      |
| `LEADERSHIP_LEVEL = 24`            | how central an agent has to be to count as a leader |
| `LEADERSHIP_REARM = 14`            | how far it has to fall before it can fire again     |

In `components/observer-narrator.tsx`:

| constant                            | what it changes                          |
| ----------------------------------- | ---------------------------------------- |
| `MIN_NARRATION_INTERVAL_MS = 12000` | minimum real-time gap between paragraphs |

## Adding a new observer

See [observers.md](observers.md#adding-a-new-observer).

## Adding a new event kind

See [observers.md](observers.md#adding-a-new-event-kind).

## Adding a new agent rule

Most rules live in `lib/engine.ts`. The pattern:

1. **Read the four numbers, not the label.** The whole point is that behaviour comes out of the traits. If your rule starts with `if (a.motivation === ...)`, you have gone backwards.
2. **Pull the numbers out.** Any number worth tuning goes in a `const` at the top of the function, or in the block at the top of the file, so it is easy to find and easy to test with the bench.
3. **Anything remembered has to fade, and has to be cleaned up.** New per-agent or per-pair state should decay each turn, through `decayReputations` or the tie decay, and be wiped in `scrubReputations` or `scrubTies` when the agent dies. Otherwise long runs leak memory and end up reading records belonging to the dead.
4. **If it produces a number, expose it.** Add it to `EngineSnapshot`, to `getSnapshot()`, and to the bench output.
5. **Run the bench again** and check you have not broken anything else: inequality, population, whether IOUs still circulate.

## About the renderer

The renderer (`components/simulation-canvas.tsx`) is one file doing five jobs:

- Sets up a Pixi `Application` and drops its canvas into a host div.
- Builds the four shapes (square, circle, triangle, diamond) once up front with `app.renderer.generateTexture`.
- Draws every living agent as a sprite, sliding between its old and new position. How solid it looks depends on how rich it is, which is what makes inequality visible at a glance.
- Draws the food layer as one sprite backed by an off-screen 2D canvas, repainted only when the turn changes.
- Draws the selection on top: the lines out to visible neighbours, and the ring around the selected agent.

One gotcha: Pixi v8's `Texture.from(canvas)` caches by source and can hand back a stale entry after a resize. The food layer builds its texture with `new Texture({ source: new CanvasSource({ resource: canvas }) })` to sidestep that. If you ever see a stretched one-pixel blur where the food should be, that is what happened.

## About the worker

The engine is single-threaded. The worker (`app/worker.ts`) creates one, calls `tick()` on a timer, and posts each frame back.

`serializeWorld` in `lib/world.ts` packs each frame into a fixed-stride Float32 buffer for the agents, plus the food grids and the relationship array. Everything is a transferable `ArrayBuffer`, so nothing gets copied.

The store updates from those messages, but the renderer reads `activeWorldRef.current` instead, set by the bridge in `lib/active-world.ts`. That keeps React from re-rendering on every frame.

## Before deploying

Run the linter and a real production build. The dev server is more forgiving than the build is:

```bash
npm run lint
npm run build
```

The `/signin` page throws a Next 16 prerender warning about `useSearchParams`. It has been there a while, it is unrelated, and it does not block anything.
