# How the simulation works

A reference for what the engine actually does — the data structures, the tick loop, the rules. Read [about.md](about.md) first for the framing; read this when you want to know what `combatPhase` does.

## The grid

The world is a square grid of cells. Each cell holds a stock of two goods (`sugar`, `spice`), each with its own ceiling (`maxCells`, `maxSpice`). Cells regrow toward their ceiling each tick, modulated by a seasonal cycle. Each cell may hold at most one agent.

At construction the ceilings are set from the configured landscape, but stocks start at only 5% of capacity. The engine then runs 120 pre-agent ticks of regrowth and substrate diffusion so the world *greens in* from those seed nuclei before anyone is spawned — the resource field agents inherit is one that has already had time to spread, not one that was stipulated fully-charged.

The tick loop halts as soon as `alive === 0`. On extinction the UI opens a dialog with the final turn, starting population, peak population, and Gini so the run's arc reads legibly instead of trailing off into empty ticks.

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
- **fertility factor** = `0.4 + 0.6 × fertility` (multiplies the resource term)
- **proximity weight** = `0.6 × prosociality`
- **predatory weight** = `0.8 × dominance` *if* own wealth > neighbours' average
- **status weight** = `0.1 × statusSeeking`

`fertility` is the cell's current ceiling divided by its pristine ceiling — how healthy the ground is. Barren cells score near zero even if they briefly hold surface resources. This is how agents *see* land degradation: they drift off worn ground without any global rule telling them to.

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

A successful seizure transfers 30% of the victim's holdings. The dyad's tie is crashed.

Three reputation effects fire from the seizure:

- **Victim distrust** — the victim's `distrust[victim][attacker]` weight jumps by 0.7.
- **Bystander distrust** — every visible peer within 3 cells learns some wariness: `distrust[witness][attacker]` grows by `0.25 + 0.35 × witness.prosociality`. Even neighbours who aren't prosocial enough to shame carry the memory.
- **Public notoriety** — `offenderNotoriety[attacker]` grows by 0.15.

If any prosocial witness (`prosociality ≥ 0.65`) saw it, the attacker is marked *shamed* for 15 turns and others may refuse to trade with them.

### 5. Trade

For each agent, the configured topology produces candidate partners:

- **spatial** — orthogonal neighbours only.
- **network** — within vision.
- **random** — a few uniform draws from the field.

For each unordered pair, `tryTrade` runs:

1. **Shame check** — if the partner is shamed, each side rolls `refuseShamedProbability` (a sigmoid on prosociality).
2. **Distrust check** — each side rolls `distrust[self][partner] × self.prosociality` to refuse. Norm-followers act on witnessed and copied distrust; defectors ignore it. This is where a peer-learned norm bites.
3. **MRS comparison** — Cobb-Douglas marginal rate of substitution. Higher MRS = values spice more = buyer. Price = geometric mean of the two MRSs.
4. **Payment selection** — if the buyer holds third-party tokens, they offer those first (issuers can default). Sugar is the fallback. Token payments are discounted at the issuer's trustworthiness, further discounted by the seller's `issuerDistrust` of that issuer.
5. **Pareto check** — both sides must come out strictly better off. Otherwise no trade.
6. **Cooperative dividend** — `0.1 × min(prosociality_a, prosociality_b)` plus a trust bonus from the dyad's tie. Pays out on the goods that moved.
7. **Tie bump** — successful trade increases the dyad's tie by 1 (capped at 8).
8. **Favoured-partner queue** — each side appends the other to a bounded queue (max 6). This is the substrate for practice imitation later in the tick.

The aggregate of all pairwise clearing prices this tick is the emergent market price.

### 6. Tie and reputation decay

All tie weights multiplied by `TIE_DECAY = 0.97`; weights below `TIE_THRESHOLD = 0.25` are pruned. Relationships are sticky but not eternal.

Reputation memory decays on the same beat: every `distrust`, `issuerDistrust`, and `offenderNotoriety` entry is multiplied by `DISTRUST_DECAY = 0.98`; anything below the `DISTRUST_FLOOR = 0.05` is dropped. A witnessed coercion is a ~30-turn shadow; a copied one is shorter.

### 7. Cultural drift and practice imitation

Each agent rolls `0.03 × statusSeeking`. On a hit, they pick the wealthiest visible neighbour and do three things:

**Trait drift.** Pull traits a fraction of the way toward the neighbour's. Habitus inertia costs wealth proportional to the Euclidean distance moved (`HABITUS_COST_PER_UNIT = 6 × distance`). Without this, agents would flip toward whoever is rich today and no subculture would stabilise.

**Norm propagation.** Copy the neighbour's strongest distrust entry: `distrust[me][worst-offender-they-know] += 0.5 × neighbour.weight`. This is how a "stay clear of X" norm spreads through the tie graph without any central authority declaring it. If enough of a person's neighbours have distrusted the same offender, they end up distrusting too — even if they never witnessed the coercion.

**Practice imitation.** Adopt one of the neighbour's `favouredPartners` into your own queue. Bourdieu's habitus is about taste in relationships as much as dispositions; here, imitating who a wealthier peer trades with biases your future partner rolls in `partnersFor` (one favoured partner is prepended to the candidate list each tick).

### 8. Consume, age, die

Pay metabolism, increment age. Negative holdings or age past `maxAge` kills the agent. On death:

- **Bequeath** — wealth is split among living trade-tie partners, weighted by tie strength, so wealth doesn't vanish when a hoarder dies.
- **Default** — every token the agent issued becomes worthless. Holders silently lose the balance; the default volume is recorded.
- **Distrust contagion** — every burned holder gets `issuerDistrust[holder][other-issuer-they-hold] += 0.35` for *every other* issuer in their portfolio. One default doesn't just discredit that issuer; it makes the holder suspicious of everyone else who has issued them credit. This is the substrate a bank run rides on — no second default has to happen.

### 9. Reproduce

Every society reproduces — there is no toggle. Birth probability per agent is `BASE_RATE × ageFactor × wealthFactor × populationFactor`:

- **ageFactor** — triangular bell over normalised age, peak at mid-life, zero at extremes.
- **wealthFactor** — saturating; 0 when broke, around 1 at modest holdings, capped at 2.
- **populationFactor** — soft logistic brake, `max(0, 1 − alive / cap)`.

Children inherit all four Bourdieusian forms of capital from the parent:

- **Economic** — endowment is `max(parent.initialSugar, parent.sugar × 0.25)` (same for spice), floored at the baseline so a newborn always has runway to find its first harvest. The parent's current holdings shrink by half the transfer — raising a child is a real cost, not a free gift. Wealthy families raise wealthy children; poor families fall back to baseline.
- **Cultural (habitus)** — traits are drifted from the parent's with small noise. Per-birth mutations resample from the configured motivation mix; the default rate is 4% and is exposed as a slider on the setup screen. At 0% a monoculture locks in permanently; raising it (e.g. to 10–15%) keeps minority motivations on life support after one dominates.
- **Social** — the child inherits the last three of the parent's `favouredPartners` — a partial trade-tie network handed over.
- **Symbolic / embodied** — `vision`, `sugarMetab`, `spiceMetab`, `maxAge`, and `sophistication` are copied straight from the parent. Cognitive style descends.

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

**Discount.** The Pareto check uses `qty × trustworthiness × (1 − issuerDistrust)` rather than face value. A risky IOU fails the seller's welfare test naturally — there's no separate fairness rule.

**Default.** When an issuer dies, all their outstanding tokens become worthless. Every holder's balance for that issuer is wiped; the default volume goes into the historical ledger. Burned holders then pass distrust onto every other issuer they hold, so a first default seeds the substrate for a wider run.

**Emergent money.** When an issuer's tokens are held by three or more distinct other agents, they count as *circulating*. The Money floating window tracks `tokenSupply` and `circulatingIssuers` in real time; this is the threshold past which "private bank" stops being a metaphor.

**Bank run.** After each snapshot the engine measures population-normalised distrust in the largest issuer. When it crosses `BANK_RUN_THRESHOLD = 0.35` and at least `BANK_RUN_COOLDOWN = 60` turns have passed since the last run, `executeBankRun` fires:

- Every holder of that issuer's tokens redeems what they can — the issuer covers up to 70% of its own sugar reserves.
- Anything unredeemable burns.
- Every holder gets `issuerDistrust[holder][issuer] += 0.8` (they *saw* it happen this time).
- The issuer's outstanding liability collapses to zero.

The bank-run event routes to Polanyi, Farmer, and Marx — the fictitious commodity failing, the herd cascade, the credit collapse.

## The trust ledger

Two graphs live on top of the trade-tie map:

- **`distrust[witness][offender]`** — coercion-based wariness that spreads through cultural imitation.
- **`issuerDistrust[witness][issuer]`** — token-based wariness that spreads through cross-issuer contagion.

Both decay each turn on the same beat as ties. Both are erased when the witness dies.

## Emergent leadership

At the end of every tick, `refreshInfluencer` computes the inbound tie-weight sum for every agent. The agent with the largest sum is the current `topInfluencerId`; the sum is `topInfluencerCentrality`. This is a *signal*, not a role — nobody enforces anything, nobody has authority, but a node has become an anchor of trust in the population's graph.

The `leadership_emerges` event fires when centrality first crosses `LEADERSHIP_LEVEL = 24` (with hysteresis re-arming at `LEADERSHIP_REARM = 14`). It routes to Granovetter (centrality reading), Flack (slow variable finding its host), and Bourdieu (the symbolic capital accruing to it).

The Trust floating window plots `topInfluencerCentrality` and `topIssuerMistrust` on a shared axis, so the anchor's rise and the population's confidence in the largest issuer read against each other — and switches its label to `run!` while a bank run is active.

## The endogenous crisis layer

- **Land degradation** scales with harvest pressure. Visible on Metrics as `landDegradation` (0 = pristine, 1 = exhausted). Also visible to *agents* through the fertility factor in `scoreCell` — worn ground scores low, so populations drift off it before the ceiling collapses.
- **Blight** rate scales with `degradation²`. Mild damage is harmless; severe damage makes famine likely.
- **Plague** rate scales with overcrowding past a density threshold.
- **Bank run** — when population-wide distrust in the largest issuer crosses a threshold, holders liquidate. See the token-economy section above.
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
| `DISTRUST_DECAY = 0.98` | reputation memory decay |
| `WITNESS_PROSOCIALITY_THRESHOLD = 0.65` | who shames coercion |
| `BANK_RUN_THRESHOLD = 0.35` | population mistrust needed to trigger a run |
| `LEADERSHIP_LEVEL = 24` | inbound tie weight for `leadership_emerges` to fire |
| `mutationRate` (config, default `0.04`) | per-birth resample rate; exposed as setup slider |

Run the bench script to see how a constant change moves dynamics across village, town, and city without firing up the dev server:

```bash
npx tsx scripts/bench.ts
```
