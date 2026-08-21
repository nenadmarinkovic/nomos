# How the simulation works

This is the detailed version: what the engine stores, what happens on each turn, and which rule does what. Read [about.md](about.md) first if you want the short version. Read this one when you want to know what `combatPhase` actually does.

## The map

The world is a square grid. Every square holds some sugar and some spice, and each has its own maximum for both. Squares regrow toward that maximum every turn, faster or slower depending on the season. Only one agent can stand on a square at a time.

When the world is built, the maximums are set by the landscape you picked, but the squares only start with 5% of that. The engine then runs 120 turns with nobody on the map, so food spreads out from those starting points before the first agent appears. Agents inherit a world that grew into its shape rather than one that was handed to them fully stocked.

The run stops the moment nobody is left alive. When that happens the app opens a dialog with the final turn, how many you started with, the highest population reached, and the final inequality number, so the run ends on a summary instead of ticking away on an empty map.

Three sizes:

| size    | grid      | agents | how full |
| ------- | --------- | ------ | -------- |
| village | 50 × 50   | 500    | 20%      |
| town    | 80 × 80   | 1,000  | 16%      |
| city    | 110 × 110 | 5,000  | 41%      |

## The agent

Each agent tracks the obvious things: where it is, what it holds, how old it is, how far it sees, how much it burns per turn. On top of that it carries four numbers:

```ts
interface AgentTraits {
  greed: number;
  prosociality: number;
  dominance: number;
  statusSeeking: number;
}
```

All four sit between 0 and 1, and every rule in the engine reads them.

The four labels you see in the app (material, symbolic, normative, power) are not stored on the agent. Each label is a point in this four-number space. When the world is built, agents are scattered around the point for whichever labels you chose. From then on the label is recalculated every turn by checking which point each agent's numbers are closest to. It describes how an agent is behaving right now, not what it was born as.

Agents also have one of four ways of deciding where to move:

- **simple** takes the best square in sight.
- **good enough** takes the first decent square within half its sight.
- **learns** adjusts how far it is willing to range based on how past moves worked out.
- **copies others** heads toward the richest neighbour it can see, and falls back to taking the best square if there isn't one.

## What happens on a turn

Ten things, in this order.

### 1. Check for a disaster

Two things can go wrong. Neither can fire in the first 100 turns, and each has a cooldown.

- **Blight.** Sugar regrows at 40% for 25 turns. The base chance is tiny (0.0005), but it grows with the square of how worn out the land is. A stripped map is far more likely to get one.
- **Plague.** About 5% of the population dies at once. The chance goes up once the map gets crowded.

Both of these come out of what the population has been doing. Neither is a random event dropped in from outside.

### 2. Food grows back

Each square refills toward its current maximum at the rate you set, adjusted by:

- **the season**, which moves the rate between roughly 30% and 170% of normal on a 60-turn cycle.
- **a blight**, if one is running.

Empty squares also slowly repair their maximum, at 0.0008 per turn. Squares with someone standing on them do not repair.

### 3. Everyone moves and eats

Each agent scores the squares it can see:

- **food** counts for `0.6 + 0.5 × greed`
- **soil health** multiplies the food term by `0.4 + 0.6 × fertility`
- **company** counts for `0.6 × prosociality`
- **weaker neighbours nearby** count for `0.8 × dominance`, but only if the agent is richer than the neighbours around it
- **rich company** counts for `0.1 × statusSeeking`

Soil health is the square's current maximum divided by what it was originally. Worn-out squares score near zero even if there happens to be food sitting on them right now. This is how agents notice land damage: they drift off ruined ground on their own, without any rule telling them to.

The agent moves to the best free square it can reach and picks up both goods. How much it gets depends on its numbers:

```ts
sugarYield = clamp(0.6 + 0.8 * greed - 0.8 * dominance, 0.3, 1.5);
spiceYield = clamp(
  0.5 + 0.5 * greed + 0.6 * statusSeeking - 0.8 * dominance,
  0.3,
  1.5,
);
```

Greedy agents gather more. Dominant agents gather less, because they get their food by taking it. Status-seekers do better on spice, which is the luxury good.

**Wearing out the land.** Every harvest takes 0.004 off the square's original maximum, permanently. Over hundreds of turns, heavily used areas visibly degrade.

### 4. Fighting

Every agent rolls against `0.18 × dominance² × (1 − prosociality)`. If it hits, they go after the richest neighbour they can see who:

- is clearly poorer (a gap of at least 4),
- is not similarly dominant (anyone at 70% of the attacker's dominance or above is skipped, so the aggressive agents leave each other alone),
- is not already a trade partner (an existing relationship protects you).

A successful attack takes 30% of the victim's holdings, and the relationship between the two is destroyed.

Three things happen to the attacker's reputation:

- **The victim remembers.** Their distrust of the attacker jumps by 0.7.
- **Witnesses remember.** Everyone within 3 squares picks up `0.25 + 0.35 × their own prosociality` worth of wariness. Even agents who aren't sociable enough to do anything about it still carry the memory.
- **It becomes public.** The attacker's notoriety grows by 0.15.

If any sufficiently sociable witness saw it (prosociality of 0.65 or more), the attacker is marked as shamed for 15 turns, and others may refuse to trade with them.

### 5. Trade

Who an agent can trade with depends on the setting:

- **neighbours only**, meaning the four squares touching it.
- **regular contacts**, meaning anyone within sight.
- **anyone at random**, meaning a few draws from anywhere on the map.

For each pair, `tryTrade` runs through:

1. **Shame.** If the other side is shamed, each of them may refuse. How likely depends on how sociable they are.
2. **Distrust.** Each side may refuse based on `their distrust of the other × their own prosociality`. Sociable agents act on what they've seen and what they've been told. Selfish ones ignore it. This is the point where a norm the agents built themselves actually does something.
3. **Who wants what.** Each side works out how much they value spice against sugar. Whoever values spice more is the buyer. The price is the geometric mean of the two.
4. **How to pay.** If the buyer is holding IOUs from someone else, they try those first. Sugar is the fallback. An IOU is worth less than face value, discounted by how good the issuer's credit looks and by how much the seller distrusts that issuer.
5. **Does it help both?** Both sides have to come out strictly better off, or the trade doesn't happen.
6. **Bonus for getting along.** `0.1 × the lower of the two prosocialities`, plus a bit more if they already have a relationship. It gets added to whatever changed hands.
7. **The relationship strengthens** by 1, up to a maximum of 8.
8. **They each remember the other** in a short list of preferred partners, up to 6 names. That list matters later in the turn.

Every price agreed this turn, averaged together, is the market price you see in the app. Nobody sets it.

### 6. Relationships and memories fade

Every relationship is multiplied by 0.97 each turn, and anything below 0.25 is dropped. Relationships stick around, but not forever.

Reputations fade on the same schedule. Every distrust score is multiplied by 0.98, and anything under 0.05 is forgotten. Seeing an attack yourself casts about a 30-turn shadow. Hearing about one from a neighbour fades sooner.

### 7. Copying the neighbours

Each agent rolls `0.03 × statusSeeking`. On a hit, they look at the richest neighbour in sight and copy three things.

**What they're like.** Their four numbers move a fraction of the way toward the neighbour's. This costs food, proportional to how far they moved (6 per unit of distance). Without that cost, agents would flip toward whoever happens to be rich this turn and no group would ever hold together.

**Who to avoid.** They copy the neighbour's strongest grudge, at half strength. This is how "stay away from that one" spreads through the population with nobody announcing it. If enough of your neighbours distrust the same agent, you end up distrusting them too, even though you never saw anything happen.

**Who to trade with.** They add one of the neighbour's preferred partners to their own list. Taste in company travels the same way taste in anything else does, and it biases who they run into next turn.

### 8. Eat, get older, die

Pay the metabolism cost, add a turn to the age. Run out of either good, or pass the maximum age, and the agent dies. When that happens:

- **The wealth goes somewhere.** It is split among the agent's surviving trade partners, weighted by how strong each relationship was. A hoarder's death doesn't just delete their pile.
- **Their IOUs become worthless.** Everyone holding them silently loses the balance, and the amount is recorded.
- **Everyone burned gets nervous about everyone else.** For each other issuer in their portfolio, a burned holder adds 0.35 to their distrust of that issuer. One default doesn't just discredit the agent who died. It makes people suspicious of everyone who owes them anything. That is what makes a bank run possible without a second failure.

### 9. Births

Every society reproduces. There is no switch for it. The chance per agent is `base rate × age factor × wealth factor × population factor`:

- **age factor** peaks in mid-life and drops to zero at both ends.
- **wealth factor** is 0 when broke, around 1 at modest holdings, and never goes above 2.
- **population factor** eases off as the map fills up.

A child inherits four kinds of advantage from its parent:

- **Money.** It starts with the larger of the parent's own starting amount or a quarter of what the parent currently holds, never below the baseline, so a newborn always has enough to find its first meal. The parent loses half of what it hands over, because raising a child costs something. Rich families produce rich children. Poor ones fall back to the baseline.
- **Character.** The four numbers are copied from the parent with a bit of noise. Some births resample from the mix you set instead. The default rate is 4% and there is a slider for it on the setup screen. At 0% whoever wins early wins permanently. Pushing it to 10 or 15% keeps the losing types alive.
- **Contacts.** The child inherits the last three names from the parent's preferred-partner list.
- **Body and habits.** Sight, appetite, maximum age and decision style are copied straight across.

### 10. Relabel everyone

Every living agent's label is recalculated from its current four numbers. At this point the label is purely a description. It has no effect on anything.

## IOUs and money

IOUs are tracked in `tokenHoldings: Map<holderId, Map<issuerId, qty>>`, with totals per issuer in `tokenLiability`. They show up in trade two ways:

- **Someone writes one.** A buyer who doesn't have enough sugar offers their own IOU, and the seller takes it. The seller gains it, the buyer now owes it.
- **Someone passes one on.** A holder spends an IOU written by a third party. It changes hands, and the original writer still owes the same amount.

**Whether the seller accepts:**

```ts
prob =
  0.08 + 0.25 * trust_in_issuer + 0.7 * trustworthiness * prosociality_factor;
```

where:

- `trust_in_issuer` is the seller's existing relationship with whoever wrote it.
- `prosociality_factor` is `0.3 + 0.7 × seller.prosociality`.
- `trustworthiness` is what the issuer's credit looks like, based on what they own against what they owe, and how likely they are to be alive to pay it:

```ts
trustworthiness = min(1, wealth / (liability + 4)) * (1 - (age / maxAge) ** 4);
```

Old issuers and over-extended issuers are not trusted. Young rich ones with little debt are.

**The discount.** The both-sides-better-off check uses `qty × trustworthiness × (1 − issuerDistrust)`, not the face value. A dodgy IOU just fails the seller's own maths. There is no separate rule about fairness.

**Default.** When an issuer dies, everything they wrote becomes worthless. Every holder's balance for that issuer is wiped and the amount is logged. Those holders then get suspicious of every other issuer they hold, which is what sets up a wider run.

**When an IOU becomes money.** Once an agent's IOUs are held by three or more different other agents, that agent counts as circulating. The IOUs window tracks the total outstanding and how many issuers are circulating, live. Past that point, calling them a private bank stops being a figure of speech.

**Bank run.** After each snapshot the engine measures how much of the population distrusts the largest issuer. Once that crosses 0.35, and at least 60 turns have passed since the last one, `executeBankRun` fires:

- Everyone holding that issuer's IOUs cashes in what they can. The issuer covers up to 70% of its own sugar.
- Everything else is worthless.
- Every holder adds 0.8 to their distrust of that issuer, because this time they watched it happen.
- The issuer's debt drops to zero.

The bank-run event goes to Polanyi, Farmer and Marx.

## The two grudge ledgers

On top of the map of who trades with whom, there are two more:

- **`distrust[witness][offender]`**, built from watching attacks, spread by imitation.
- **`issuerDistrust[witness][issuer]`**, built from bad IOUs, spread from one issuer to all the others in a holder's portfolio.

Both fade every turn, on the same schedule as relationships. Both die with the agent holding them.

## Leaders nobody appointed

At the end of every turn, `refreshInfluencer` adds up the incoming relationship weight for every agent. Whoever has the most is the current top influencer. This is just a number. Nobody has authority, nobody enforces anything. But one agent has become the point everyone else's relationships run through.

The `leadership_emerges` event fires the first time that number crosses 24, and re-arms once it falls back under 14. It goes to Granovetter, Flack and Bourdieu.

The Trust window plots that number against how much the population distrusts the biggest IOU issuer, so you can see one agent's rise and everyone's confidence in the money side by side. It switches its label to `run!` while a bank run is happening.

## How things go wrong

- **Land wears out** with use. You can see it on the Metrics page as `landDegradation`, from 0 (untouched) to 1 (finished). Agents can also see it, through the soil health term in `scoreCell`, so populations drift off bad ground before it collapses entirely.
- **Blight** gets more likely as the square of that damage. A little wear is harmless. A lot makes famine likely.
- **Plague** gets more likely as the map gets crowded.
- **Bank runs** happen when enough of the population loses faith in the biggest issuer. See above.
- **There is no safety net.** Nothing forces a wiped-out type back into the population. A single type can take over and stay on top.

## Numbers worth changing

The useful constants, all in `lib/engine.ts`:

| constant                                | what it changes                                            |
| --------------------------------------- | ---------------------------------------------------------- |
| `ATTEMPT_RATE = 0.18`                   | how often agents attack; lower it for calmer runs          |
| `HABITUS_COST_PER_UNIT = 6`             | what it costs to imitate; higher makes groups more stable  |
| `DEGRADE_PER_HARVEST = 0.004`           | how fast the land wears out                                |
| `RECOVERY_RATE = 0.0008`                | how fast empty land repairs                                |
| `TOKEN_PRIOR_LIABILITY = 4`             | how much credit a brand new issuer gets                    |
| `TIE_DECAY = 0.97`                      | how fast relationships fade                                |
| `DISTRUST_DECAY = 0.98`                 | how fast grudges fade                                      |
| `WITNESS_PROSOCIALITY_THRESHOLD = 0.65` | how sociable you have to be to shame an attacker           |
| `BANK_RUN_THRESHOLD = 0.35`             | how much distrust it takes to start a run                  |
| `LEADERSHIP_LEVEL = 24`                 | how central you have to be to trigger `leadership_emerges` |
| `mutationRate` (config, default `0.04`) | how often children come out unlike their parents           |

To see how a change plays out across all three sizes without starting the dev server:

```bash
npx tsx scripts/bench.ts
```
