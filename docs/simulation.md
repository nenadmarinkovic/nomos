# How the simulation works

A reference for what the engine actually does — the data structures, the tick loop, the rules. Read [about.md](about.md) first for the framing; read this when you want to know what `combatPhase` does.

## The grid

The world is a square grid of cells. Each cell holds a stock of two goods (`sugar`, `spice`), each with its own ceiling (`maxCells`, `maxSpice`). Cells regrow toward their ceiling each tick, modulated by a seasonal cycle. Each cell may hold at most one agent.

Three scale presets:

| scale | grid | agents | density |
|---|---|---|---|
| village | 50 × 50 | 500 | 20% |
| town | 80 × 80 | 1,000 | 16% |
| city | 110 × 110 | 5,000 | 41% |

## The agent

Each agent has a fixed set of state — position, holdings, age, vision, metabolism — and two important things on top of that:

```ts
interface AgentTraits {
  greed: number;
  prosociality: number;
  dominance: number;
  statusSeeking: number;
}
```

All four traits live in `[0,1]`. *Every* behavioural rule reads from them.

The four classical motivations (`material / symbolic / normative / power`) are *not* configured per agent. Instead, each motivation has a centroid in this 4D trait space. Agents are drawn around their seed motivation's centroid with small jitter. The `motivation` label on each agent is then *recomputed every tick* via nearest-centroid clustering — it describes which classical motivation an agent currently behaves like, regardless of seed.

Agents also have one of four `sophistication` settings that picks the movement rule:

- **minimal** — greedy optimisation over the full vision.
- **bounded_rational** — satisfice in half the vision (Simon).
- **adaptive** — vision varies with learned boldness; reinforcement-update on harvest success.
- **social** — head toward the wealthiest visible neighbour; falls back to greedy.

## What happens each tick

The engine runs ten phases in order on every tick.

### 1. Roll for shocks

Two endogenous shocks can fire (gated by a 100-turn warm-up and per-shock cooldowns):

- **Blight** — sugar regrowth cut to 40% for 25 turns. Base probability `0.0005`, plus `0.02 × degradation²`. Worn-down landscapes are dramatically more vulnerable.
- **Plague** — about 5% of the population dies in one tick. Probability scales with crowding past a density threshold.

Both are the society's own actions returning as constraint, not exogenous dice rolls.

### 2. Regrow and recover

Cell stock refills toward its current ceiling at the configured `regrowthRate`, modulated by:

- a **seasonal cycle**, between roughly 30% and 170% of the base rate over a 60-turn period.
- an active **blight**, if any.

Fallow cells (no occupant) slowly recover lost carrying capacity at `RECOVERY_RATE = 0.0008` per tick. Trampled cells (with an agent on them) do not recover.

### 3. Move and harvest

Each living agent picks a target cell via a continuous scoring function:

- **resource weight** = `0.6 + 0.5 × greed`
- **proximity weight** = `0.6 × prosociality`
- **predatory weight** = `0.8 × dominance` *if* own wealth > neighbours' average
- **status weight** = `0.1 × statusSeeking`

The agent moves to the highest-scoring free cell within its movement horizon and harvests both goods. Harvest yields scale with traits:

```ts
sugarYield = clamp(0.6 + 0.8 * greed - 0.8 * dominance, 0.3, 1.5)
spiceYield = clamp(0.5 + 0.5 * greed + 0.6 * statusSeeking - 0.8 * dominance, 0.3, 1.5)
```

Greedy agents harvest more. Dominance-oriented agents harvest less (they specialise in seizure, not gathering). Status-seekers favour spice (luxury orientation).

**Tragedy of the commons:** every harvest nibbles `DEGRADE_PER_HARVEST = 0.004` of the cell's pristine ceiling. Over hundreds of turns, intensively-used regions visibly degrade.

### 4. Combat

Every living agent rolls against `0.18 × dominance² × (1 − prosociality)`. A successful roll picks the wealthiest visible neighbour that:

- is notably poorer (wealth gap ≥ 4),
- is not a peer in dominance (target's dominance ≥ 0.7 × attacker's is skipped — high-dominance agents form a mutually-restraining elite),
- is not a trade partner (an existing tie above threshold shields the relationship).

A successful seizure transfers 30% of the victim's holdings. The dyad's tie is crashed. Any prosocial witness within 3 cells (with `prosociality ≥ 0.65`) marks the attacker as shamed for 15 turns. Others may then refuse trade with them.

### 5. Trade

For each agent, the configured topology produces candidate partners:

- **spatial** — orthogonal neighbours only.
- **network** — within vision.
- **random** — a few uniform draws from the field.

For each unordered pair, `tryTrade` runs:

1. **Shame check** — if the partner is shamed, each side rolls `refuseShamedProbability` (a sigmoid on prosociality).
2. **MRS comparison** — Cobb-Douglas marginal rate of substitution. Higher MRS = values spice more = buyer. Price = geometric mean of the two MRSs.
3. **Payment selection** — if the buyer holds third-party tokens, they offer those first (issuers can default). Sugar is the fallback. Token payments are discounted at the issuer's trustworthiness.
4. **Pareto check** — both sides must come out strictly better off. Otherwise no trade.
5. **Cooperative dividend** — `0.1 × min(prosociality_a, prosociality_b)` plus a trust bonus from the dyad's tie. Pays out on the goods that moved.
6. **Tie bump** — successful trade increases the dyad's tie by 1 (capped at 8).

The aggregate of all pairwise clearing prices this tick is the emergent market price.

### 6. Tie decay

All tie weights multiplied by `TIE_DECAY = 0.97`; weights below 0.25 are pruned. Relationships are sticky but not eternal.

### 7. Cultural drift

Each agent rolls `0.03 × statusSeeking`. On a hit, they pull their traits a fraction of the way toward the wealthiest visible neighbour's traits.

**Habitus inertia:** the drift costs wealth proportional to the Euclidean distance moved (`HABITUS_COST_PER_UNIT = 6 × distance`). Without this cost, agents would flip toward whoever is rich today and no subculture would stabilise.

### 8. Consume, age, die

Pay metabolism, increment age. Negative holdings or age past `maxAge` kills the agent. On death:

- **Bequeath** — wealth is split among living trade-tie partners, weighted by tie strength, so wealth doesn't vanish when a hoarder dies.
- **Default** — every token the agent issued becomes worthless. Holders silently lose the balance; the default volume is recorded.

### 9. Reproduce

Birth probability per agent is `BASE_RATE × ageFactor × wealthFactor × populationFactor`:

- **ageFactor** — triangular bell over normalised age, peak at mid-life, zero at extremes.
- **wealthFactor** — saturating; 0 when broke, around 1 at modest holdings, capped at 2.
- **populationFactor** — soft logistic brake, `max(0, 1 − alive / cap)`.

Children inherit parents' traits with small drift. Per-birth mutations resample from the configured motivation mix; the default rate is 4% and is exposed as a slider on the setup screen. At 0% a monoculture locks in permanently; raising it (e.g. to 10–15%) keeps minority motivations on life support after one dominates.

### 10. Refresh motivation labels

Every alive agent's `motivation` is recomputed from their current trait vector via nearest-centroid clustering. The field is purely descriptive at this point — a label, not an input.

## The token economy

Tokens are sparse IOUs in `tokenHoldings: Map<holderId, Map<issuerId, qty>>` with totals in `tokenLiability: Map<issuerId, qty>`. They appear in trade:

- **Issuance** — a buyer with insufficient sugar offers their own IOU, and the seller accepts. The seller's balance gains the token; the issuer's liability grows.
- **Transfer** — a holder spends a third-party IOU in a new trade. The token moves; the issuer's liability is unchanged.

**Acceptance probability:**

```ts
prob = 0.08
     + 0.25 * trust_in_issuer
     + 0.7  * trustworthiness * prosociality_factor
```

where:

- `trust_in_issuer` — the seller's existing tie with the issuer (normalised).
- `prosociality_factor` — `0.3 + 0.7 × seller.prosociality`.
- `trustworthiness` — the issuer's credit, collateral × survival:

```ts
trustworthiness =
  min(1, wealth / (liability + 4))
  * (1 - (age / maxAge) ** 4)
```

Old or over-issued issuers are not trusted; young rich issuers with little debt are.

**Discount.** The Pareto check uses `qty × trustworthiness` rather than face value. A risky IOU fails the seller's welfare test naturally — there's no separate fairness rule.

**Default.** When an issuer dies, all their outstanding tokens become worthless. Every holder's balance for that issuer is wiped; the default volume goes into the historical ledger (which observers can read about).

**Emergent money.** When an issuer's tokens are held by three or more distinct other agents, they count as *circulating*. The Metrics page tracks `circulatingIssuers` for the run; this is the threshold past which "private bank" stops being a metaphor.

## The endogenous crisis layer

- **Land degradation** scales with harvest pressure. Visible on Metrics as `landDegradation` (0 = pristine, 1 = exhausted).
- **Blight** rate scales with `degradation²`. Mild damage is harmless; severe damage makes famine likely.
- **Plague** rate scales with overcrowding past a density threshold.
- **No safety net.** There is no extinction guard forcing extinct motivations back into the gene pool. Monocultures can win and stay won.

## Calibration knobs

The most useful constants, all in `lib/engine.ts`:

| constant | what it tunes |
|---|---|
| `ATTEMPT_RATE = 0.18` | coercion base rate; lower for less violent runs |
| `HABITUS_COST_PER_UNIT = 6` | cost of trait drift; higher = stickier subcultures |
| `DEGRADE_PER_HARVEST = 0.004` | tragedy of the commons rate |
| `RECOVERY_RATE = 0.0008` | fallow land recovery rate |
| `TOKEN_PRIOR_LIABILITY = 4` | new-issuer credit floor |
| `TIE_DECAY = 0.97` | trade relationship decay |
| `WITNESS_PROSOCIALITY_THRESHOLD = 0.65` | who shames coercion |
| `mutationRate` (config, default `0.04`) | per-birth resample rate; exposed as setup slider |

Run the bench script to see how a constant change moves dynamics across village, town, and city without firing up the dev server:

```bash
npx tsx scripts/bench.ts
```
