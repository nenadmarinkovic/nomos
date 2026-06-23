# Development

## Stack

- **Frontend** — Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind v4, Phosphor Icons.
- **Simulation runtime** — Web Worker tick loop posting world frames as transferable buffers. Pixi.js v8 WebGL field renderer. `react-force-graph-3d` (Three.js) for the network view. Zustand for state.
- **Data** — Prisma with SQLite locally; PostgreSQL once accounts land.
- **Observers** — Mistral API (`mistral-small`). One call per significant event, dispatched from the browser via `app/api/observe`.
- **Infrastructure** — Hetzner VPS (Falkenstein) running Dokploy.

## Quick start

Install dependencies (this also runs `prisma generate`):

```bash
npm install
```

Copy the env file. `DATABASE_URL` is preset; add `MISTRAL_API_KEY` if you want the observers to narrate:

```bash
cp .env.example .env
```

Create the local SQLite database at `prisma/dev.db`, then start the dev server:

```bash
npm run db:push
npm run dev
```

`.env` (not `.env.local`) is used so the Prisma CLI and Next.js read the same file.

Open [http://localhost:3000](http://localhost:3000).

If styles look stale after a config change, clear Turbopack's cache:

```bash
rm -rf .next && npm run dev
```

## Scripts

| script | what it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | eslint |
| `npm run db:push` | sync the Prisma schema to local SQLite |
| `npm run db:migrate` | create or apply a migration |

## Architecture

The runtime splits across three layers.

**Browser** — the engine and the entire UI live here.

- *Web Worker* runs `engine.tick()` on an interval driven by the user's speed setting. Each tick produces a `WorldFrame` posted to the main thread as a set of transferable `ArrayBuffer`s (no structured-clone overhead).
- *Main thread* rehydrates frames into a `WorldView`, holds the Zustand store, renders the Pixi WebGL field and the 3D NetworkView, runs the significant-event detector, and shows the inspector and floating windows.

**Server** — Next.js route handlers.

- `/api/observe` accepts an event + theorist payload from the browser, builds the per-theorist system + user prompt, calls Mistral, and streams the reading back into the chronicle.

**External** — Mistral API (`mistral-small`). One LLM call per significant event, not per tick. Without `MISTRAL_API_KEY` the simulation still runs; observers stay silent.

The flow on a single significant event:

```
Web Worker  ─[frames]─▶  Main thread  ─[POST]─▶  /api/observe  ─[prompt]─▶  Mistral
                                                                                │
                          chronicle  ◀──────────────────[reading]───────────────┘
```

- **The engine** (`lib/engine.ts`) is a pure TypeScript class — no React, no DOM. It runs in a Web Worker (`app/worker.ts`). Every tick it produces a serialisable `WorldFrame`.
- **The worker** posts each frame as transferable `ArrayBuffer`s to the main thread, where they're rehydrated into a `WorldView` (`lib/world.ts`).
- **The store** (`lib/store.ts`, Zustand) holds the latest snapshot, the configuration, the chronicle, the open-window state.
- **The Pixi canvas** (`components/simulation-canvas.tsx`) reads the latest `WorldView` from `activeWorldRef` (an unsubscribed mutable ref the worker keeps current) and paints at 60fps.
- **The observer narrator** (`components/observer-narrator.tsx`) reads snapshots from the store, runs `detectEvent` against rolling history, routes events via `pickObserver`, and POSTs to `/api/observe`.

## Where things live

| file | what's in it |
|---|---|
| `lib/engine.ts` | The engine class, all per-tick logic, all rate constants. The biggest file. |
| `lib/config.ts` | Setup-screen schema, scale presets, observer metadata. |
| `lib/world.ts` | `WorldView` interface, worker-frame serialisation. |
| `lib/events.ts` | Significant-event detector, event metrics shape, summaries. |
| `lib/observers.ts` | Observer prompt construction (system + user prompts). |
| `lib/observer-routing.ts` | Event-kind → priority list of theorists. |
| `lib/render-resources.ts` | Shared resource-field rendering (Canvas2D primitive used by the Pixi sprite). |
| `lib/store.ts` | Zustand store. |
| `app/worker.ts` | Web Worker tick loop. |
| `app/api/observe/route.ts` | Mistral API proxy. |
| `components/simulation-canvas.tsx` | Pixi field renderer. |
| `components/network-canvas.tsx` | 3D force-graph network view. |
| `components/observer-narrator.tsx` | Event detection + LLM dispatch + chronicle. |
| `components/agent-inspector.tsx` | Draggable agent inspector overlay. |
| `components/pages/*.tsx` | The four sidebar pages (World, Agents, Metrics, Narrator). |
| `scripts/bench.ts` | Headless deterministic bench for tuning runs. |

## The bench

`scripts/bench.ts` runs the engine headlessly (no React, no Pixi, no LLM) and prints sampled state for village, town, and city. Use it whenever you change a rate constant or a rule, to see how the dynamics shift without firing up the dev server.

```bash
npx tsx scripts/bench.ts
```

Output is one row per `sampleEvery` turns per scale, with columns:

`turn alive gini coerce shame ties isol% tokens issuers land price vol tVol mat sym norm pow`

Read the columns to spot regimes — Gini climbing without bound, tokens not circulating, monoculture lock-in. Runs are deterministic from seed, so before-and-after constant changes are directly comparable.

## Calibration knobs

Most useful constants in `lib/engine.ts`:

| constant | what it tunes | symptom of being wrong |
|---|---|---|
| `ATTEMPT_RATE = 0.18` | coercion base rate | runs feel too violent or too peaceful |
| `HABITUS_COST_PER_UNIT = 6` | cost of trait drift | monocultures form too fast or never |
| `DEGRADE_PER_HARVEST = 0.004` | tragedy of the commons rate | land degradation flat or runaway |
| `RECOVERY_RATE = 0.0008` | fallow land recovery | land never recovers or recovers instantly |
| `TOKEN_PRIOR_LIABILITY = 4` | new-issuer credit floor | tokens never circulate or always circulate |
| `TIE_DECAY = 0.97` | trade relationship persistence | trade web too transient or too rigid |
| `WITNESS_PROSOCIALITY_THRESHOLD = 0.65` | who shames coercion | sanctions never fire or fire too often |

In `lib/events.ts`:

| constant | what it tunes |
|---|---|
| `COOLDOWN = 12` | global event spacing |
| `KIND_COOLDOWN.coercion_wave = 60` | per-kind floor for loud events |
| `EXTREME_INEQUALITY_LEVEL = 0.6` | sustained-state inequality threshold |
| `OLIGARCHY_LEVEL = 0.8` | sustained-state oligarchy threshold |
| `SUSTAINED_HIGH_DURATION = 80` | turns of "this is the regime" before it fires |

In `components/observer-narrator.tsx`:

| constant | what it tunes |
|---|---|
| `MIN_NARRATION_INTERVAL_MS = 12000` | wall-clock pacing of narrations |

## Adding a new observer

See [observers.md](observers.md#adding-a-new-observer).

## Adding a new event kind

See [observers.md](observers.md#adding-a-new-event-kind).

## Adding a new agent rule

Most rules live in `lib/engine.ts`. The pattern:

1. **Read traits, not motivation.** The whole point of the trait refactor is that behaviour is `f(traits)`. If your new rule starts with `if (a.motivation === ...)`, you're regressing.
2. **Use the rate-constant pattern.** Put any tunable number as a `const X = ...` near the top of the function (or in the constants block near the file top) so it's easy to find and tune via the bench.
3. **Add the symptom to the snapshot.** If the rule produces a per-tick number you want to read or observe, add it to `EngineSnapshot`, to `getSnapshot()`, and to the bench output.
4. **Re-run the bench** to confirm the new rule doesn't break existing dynamics (Gini, alive trajectory, tokens circulating).

## Notes on the rendering

The Pixi renderer (`components/simulation-canvas.tsx`) is one file but does five things:

- Bootstraps a Pixi `Application` and appends its canvas to a host div sized like a Canvas2D canvas.
- Pre-builds four motivation textures (`square / circle / triangle / diamond`) once via `app.renderer.generateTexture`.
- Renders every alive agent as a Sprite with interpolated position between `prevX/prevY` and `x/y`. Wealth-modulated alpha makes inequality visible.
- Renders the resource grid as a single Sprite whose texture is an off-screen Canvas2D, sized at framebuffer resolution and repainted only when `world.turn` changes.
- Renders selection (vision lines to neighbours, pulsing ring) as a Graphics layer above the agents.

Pixi v8's `Texture.from(canvas)` caches by source identifier and can return stale entries on canvas resize. The code constructs textures via `new Texture({ source: new CanvasSource({ resource: canvas }) })` to bypass that cache for the resource layer. If you see "stretched 1-pixel blur" instead of resources, that is usually the failure mode.

## Notes on the worker boundary

The engine class is single-threaded. The worker (`app/worker.ts`) instantiates one engine, runs `tick()` on the configured interval, and posts each frame back to the main thread.

Frames are packed in `lib/world.ts`:`serializeWorld` into a fixed-stride Float32 buffer (per-agent fields), plus the resource grids and tie array. All payloads are transferable `ArrayBuffer`s — no structured-clone overhead.

The store updates from worker messages. The Pixi renderer reads from `activeWorldRef.current` (set by the worker bridge in `lib/active-world.ts`), not the store — this avoids re-renders on every frame.

## Pre-deploy checklist

Run lint and a real production build (dev catches less than build does):

```bash
npm run lint
npm run build
```

The `/signin` page has a pre-existing Next 16 prerender warning about `useSearchParams` — unrelated and doesn't block.
