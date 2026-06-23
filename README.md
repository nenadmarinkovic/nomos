# Nomos

A society simulation where agents follow simple rules and AI theorists observe what emerges.

> **Status:** the simulation core, the engine's social mechanics, the trait-based agent model, the token economy, and the observers are working. Open fronts: scale/performance (PixiJS) and accounts. See the [roadmap](#roadmap).

## What Nomos is

A grid of agents harvests two goods (sugar and spice), trades them with neighbours, sometimes seizes from each other, drifts in identity by imitating wealthier peers, reproduces, and dies. A panel of AI theorists watches the same field and narrates what they see in their own vocabulary — Marx on class, Axelrod on tit-for-tat, Durkheim on solidarity, and so on.

Nothing in the engine programs *inequality, classes, markets, money, norms, or institutions*. They emerge from local rules — or they don't, and the run is its own answer.

## How the agents work

Every agent carries a **continuous trait vector** in `[0,1]^4`:

| trait | what it tunes |
|---|---|
| **greed** | resource accumulation; harvest yield |
| **prosociality** | cooperation, sanctioning of defectors, willingness to extend credit |
| **dominance** | propensity to seize from weaker neighbours |
| **statusSeeking** | sensitivity to neighbours' wealth, imitation, luxury orientation |

Every behavioural rule reads from these — coercion propensity, harvest yields, movement preferences, refusal to trade with shamed agents, cooperative dividend on a trade, drift toward exemplars. **There is no privileged "Power" type, no privileged "Normative" type.** The four classical motivations (`material / symbolic / normative / power`) are *cluster labels* computed each tick from the trait vector by nearest-centroid — they describe the agent, they don't configure them.

This is the project's main intellectual move: theorists describe behaviour; they don't programme it. If a population ends up looking 80% material, that's a finding of the run, not a parameter.

Agents also carry a **sophistication** (minimal / bounded-rational / adaptive / social) that picks the movement rule — greedy optimisation over full vision, satisficing over a shorter horizon, exploration-vs-exploitation with learned boldness, or following the wealthiest visible neighbour.

## What happens each tick

The engine runs phases in this order on every tick:

1. **Roll for shocks.** A possible *blight* (regrowth halved for 25 turns) — its odds rise with how worn-down the landscape is. A possible *plague* (≈5% of the population dies) — its odds rise with density past a comfortable threshold. Both are now *endogenous*: the society's own actions return as constraint.

2. **Regrow + recover the landscape.** Cell stock refills toward its current ceiling, modulated by a seasonal cycle (`~30%–170%` over a 60-turn period). Fallow cells slowly *recover* lost carrying capacity. With Living Ground enabled, stock and fertility also *diffuse* to neighbours.

3. **Move & harvest.** Each agent picks a target cell by `scoreCellByTraits` (a weighted sum: greedy agents value raw resources, prosocial agents value company, dominant agents value crowds they're richer than, status-seekers chase visibly wealthy company). Harvest yields scale by traits. Every harvest event *nibbles a small fraction off the cell's carrying capacity* — tragedy of the commons made operational.

4. **Combat (coercion).** Every agent rolls against `attackPropensity = ATTEMPT_RATE × dominance² × (1 − prosociality)`. A successful roll picks the wealthiest visible neighbour notably poorer than the attacker, skipping peers in dominance and existing trade partners (embedded ties shield against predation). Seizure transfers 30% of the victim's holdings to the attacker. **The dyad's trust is destroyed.** Any nearby high-prosociality witness shames the attacker for 15 turns.

5. **Trade.** Each agent meets partners (under the configured topology: spatial, network, or random). A pair trades one spice for `mrs(buyer, seller)`-priced sugar if both sides come out ahead by Cobb-Douglas welfare. Two refinements:
   - **Shame refusal.** If the partner is currently shamed, this agent rolls `refuseShamedProbability(traits)` — at prosociality ≥ 0.8 they almost always refuse; at prosociality < 0.4 they don't care.
   - **Token fallback.** If the buyer can't cover the price in raw sugar, they offer tokens — either by transferring an IOU they hold of some third issuer, or by printing their own. The seller's acceptance probability combines their own prosociality with the issuer's *trustworthiness*: collateral ratio (wealth ÷ liability) discounted by death risk. The Pareto check uses the *discounted* sugar value (`face × trustworthiness`), so a risky IOU naturally fails the welfare test. Token-paid trades grow the issuer's liability; the holder can re-spend the token later, and a widely-held issuer's notes become emergent money.
   - On success, the partners' tie weight bumps by 1 (capped at 8). The trade also pays a cooperative dividend that scales with `min(prosociality_a, prosociality_b)` plus a trust dividend from their tie history. **The aggregate of all pairwise clearing prices this tick is the emergent market price.**

6. **Tie decay.** Every tie weight is multiplied by 0.97; weights below 0.25 are pruned. Coercion *crashes* a tie outright. So long-running trade relationships are sticky but not eternal; fresh trust takes many successful exchanges to build.

7. **Cultural drift.** Each agent rolls `imitationPropensity ∝ statusSeeking`. On a hit, they pull their traits a fraction of the way toward the wealthiest neighbour's traits — and pay a wealth cost proportional to the Euclidean distance the trait vector just travelled. This is **habitus inertia**: identity change isn't free. Without the cost, the population would flip toward whoever happens to be rich today and no subculture would stabilise.

8. **Consume, age, die.** Pay metabolism, age one turn. Negative holdings or age past `maxAge` kills the agent. On death the agent *bequeaths* its wealth to surviving trade partners weighted by tie strength, and all of its outstanding tokens *default* — holders lose them.

9. **Reproduce.** A logistic brake `(1 − alive / cap)` × age-bell × wealth-saturating-factor gives the per-agent birth probability this tick. The cap is large (≈ half the cells) so genuine demographic growth and crashes are possible. Children inherit the parent's traits with small drift; rare mutations resample from the configured motivation mix.

10. **Refresh derived labels.** Every agent's `motivation` is recomputed from the current trait vector (nearest centroid). Cultural drift may have carried them into a different cluster since last tick.

## The token economy

Tokens are sparse IOUs in `tokenHoldings[holder][issuer] → qty`. They appear when a buyer can't cover a trade in sugar and the seller accepts an IOU instead.

- **Issuance** prints fresh tokens onto the seller's balance and grows the issuer's outstanding liability.
- **Transfer** moves existing tokens onto a new holder — the buyer preferring to spend held tokens before printing their own.
- **Acceptance** depends on `tokenAcceptanceProb(seller_traits, trust_in_issuer, issuer_trustworthiness)`. Trustworthiness = `wealth / (liability + prior) × (1 − (age / maxAge)⁴)`. Old or over-issued agents are not trusted; young rich agents with little debt are.
- **Discount.** The Pareto check uses `sugarQty × trustworthiness`, so risky IOUs flunk the welfare test from the seller's side. This is the price spread between currency and credit, falling out for free.
- **Default.** When an issuer dies, all of their outstanding tokens become worthless. Holders silently lose the balance; the historical default volume is recorded.
- **Emergent money.** An issuer whose tokens are held by ≥3 distinct other agents is *circulating* — that's the threshold past which "private bank" stops being a metaphor. The Metrics page tracks this.

## The endogenous crisis layer

- **Land degradation.** Each harvest erodes the cell's `maxCells` / `maxSpice` by a fraction of the original ceiling. Fallow cells regenerate it slowly. Intensive use over hundreds of turns measurably worsens the landscape's carrying capacity. The `landDegradation` ratio is in every snapshot.
- **Endogenous blight.** Rate scales with `degradation²`. Mild damage is harmless; severe damage makes famine likely.
- **Endogenous plague.** Rate scales with overcrowding past a density threshold.
- **No safety net.** There's no extinction guard forcing extinct motivations to come back, and no hard population cap holding the simulation in a quasi-equilibrium. Monocultures can win, demographics can collapse, and the system can settle into states it can't escape from.

## Is this a cellular automaton?

No — Nomos is an **agent-based model** (ABM) in the Sugarscape lineage (Epstein & Axtell), and that's a different, more general thing than a CA.

- In a **cellular automaton**, state lives in the *cells* of a fixed grid. Every cell updates in lockstep from a single rule applied to its immediate neighbourhood, and nothing moves — Conway's Life, Schelling on a lattice, forest-fire models.
- In an **agent-based model**, state lives in *agents* that move across space, carry private memory (wealth, traits, age, debts, social ties), interact pairwise (trade, predation, imitation, inheritance), and are born and die. Nomos updates agents asynchronously in a shuffled order each tick; agents are heterogeneous and persistent. The grid is a resource substrate, not the locus of computation.

A CA is closer to a *special case* — a fixed-population, immobile, synchronous ABM — than to what Nomos is. **Converting the whole model to a CA would be a regression:** mobility, trade, ties, inheritance, tokens, and the emergent market are the heart of the project.

What *does* make sense — and what the **Living ground** option enables — is to give the *environment* genuine CA dynamics while leaving the agents an ABM. Resource stock and fertility diffuse to neighbours, so depletion spreads like desertification and fertile ground reseeds the worn cells beside it. Hybrid CA-environment + ABM-actors is a well-established modelling pattern, faithful to the project's "everything emerges from local rules" ethos — now the ground obeys local rules too.

## Observers and the Chronicle

Eleven theorists are available, each with a one-line lens, what they see in the social world, and what they watch for:

Marx · Polanyi · Bourdieu · Durkheim · Granovetter · Schelling · Turchin · Farmer · Epstein · Flack · **Axelrod**

(Axelrod was added so the chronicle has a voice that reads the same coercion-and-sanction data as *the evolution of cooperation*, not as incipient revolt — same event, opposite interpretation.)

### How the chronicle works

The browser runs a **significant-event detector** over the live snapshots. Each detected event has a kind (`founding`, `inequality_surge`, `stratification`, `population_crash`, `market_forming`, `price_shock`, `collapse`, `segregation`, `motivation_shift`, `coercion_wave`, `cooperation_thickens`, `network_fracture`, `extreme_inequality`, `oligarchy`, `shock_blight`, `shock_plague`, `passage`) and a factual, theory-neutral summary. Each kind has a priority list of theorists; the first available one wins, with a round-robin offset so repeated occurrences rotate through the available voices.

Each significant event becomes one Mistral call → one paragraph from one theorist. **One paragraph per moment, not N**. Across a run you still hear every voice, because different event kinds route to different theorists.

Cooldowns are layered to keep the chronicle readable:
- A global 12-turn floor between any two events.
- Per-kind cooldowns up to 60 turns for the loud recurring events (`coercion_wave`, `cooperation_thickens`).
- Hysteresis latches on sustained-state events (`extreme_inequality`, `oligarchy`, `cooperation_thickens`) so they fire once when the regime locks in, not on every cooldown.
- A wall-clock minimum (12 seconds) between narrations, so the chronicle stays legible at 4× and 8× sim speeds.

Without a `MISTRAL_API_KEY` the simulation still runs; the observers simply stay silent.

## Stack

**Frontend** — Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 · Tailwind v4 · Phosphor Icons · Newsreader / Google Sans Flex.

**Simulation runtime** — Web Worker tick loop posting world frames as transferable buffers · Canvas2D field renderer (PixiJS upgrade pending) · `d3-force` and Three.js (`react-force-graph-3d`) for the layouts · Zustand for state.

**Data** — Prisma + SQLite locally; PostgreSQL once accounts land.

**Observers** — Mistral API (`mistral-small`). One call per significant event, not per tick. Detection lives in the browser; `app/api/observe` builds the per-theorist prompt and calls Mistral. Readings stream into the **Chronicle** panel.

**Infrastructure** — Hetzner VPS (Falkenstein) running Dokploy · Better Auth (when accounts land).

## Roadmap

- **v0.1.0 — Simulation core + observers** *(done)*
- **v0.2 — Persistence** *(done)*. Save / list / replay runs; shareable run URLs.
- **v0.3 — Scale & perf** *(in progress)*. Worker tick loop ✓; PixiJS WebGL field renderer next.
- **v0.3.x — Social structure & inspection** *(done)*. Trade-tie graph, 3D network view, motivation streamgraph, inspector.
- **v0.5 — Engine social mechanics** *(done)*. Conflict, cultural transmission, inheritance, demographics, seasonal substrate, Living Ground CA option, richer event detection.
- **v0.6 — Generative society refactor** *(done)*. Continuous trait vector replaces the motivation enum; every behaviour is now a function over traits. Reciprocity memory (trade ties double as trust ledger; coercion crashes a tie; trade partners are immune from predation). Habitus inertia (cultural drift costs wealth proportional to trait-space distance). Safety nets removed (extinction guard, hard population cap, exogenous-only shocks). Endogenous crises (land degradation feeds blight; density feeds plague). Post-hoc motivation clustering. **Phase 6**: private-IOU token economy, with emergent money from third-party transferability; tokens default on issuer death.
- **v0.6.x — Chronicle quality** *(done)*. Axelrod added so the same predation-and-sanction data reads as the evolution of cooperation, not just class war. New `cooperation_thickens` event surfaces tokens circulating and sustained sanctioning. Per-kind cooldowns and wall-clock pacing so the chronicle stays readable at any sim speed. Initial-conditions card on Narrator and Metrics pages.
- **v0.4 — Accounts & sharing**. Better Auth, Postgres, public gallery.
- **Later** — phase-space plot, Sankey of motivation transitions, territory contours, additional agent models.

## What still needs to be done

In rough priority:

1. **PixiJS WebGL field renderer** — replace the Canvas2D agent layer toward 100k agents at 60fps.
2. **Token economy UI deepening** — the Metrics summary cards are landed; a richer view (top issuers list, supply over time) would let runs be *read* as monetary history.
3. **Observer prompts tuned to the new dynamics** — each theorist should know what tokens, trait drift, and land degradation *mean* in their vocabulary (Marx on tokens as new chains, Axelrod on tokens as credit reputation, Polanyi on tokens as commodified trust, etc.).
4. **Accounts & sharing (v0.4)** — Better Auth + Postgres, public run gallery.
5. **Phase-space plot, Sankey, territory contours** — long-tail macro-behaviour readings.

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
npm run dev        # development server
npm run build      # production build
npm run start      # serve production build
npm run lint       # eslint
npm run db:push    # sync the Prisma schema to the local SQLite database
npm run db:migrate # create/apply a migration during schema changes
```
