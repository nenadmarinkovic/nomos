# Observers and the chronicle

The chronicle is what makes Nomos different from a typed-agent ABM with stats panels. As the simulation runs, the browser detects significant events and routes each one to whichever theorist's lens has the most concrete purchase on it. One Mistral call per event produces one short paragraph in that theorist's voice. Across a run you hear every voice; no single moment gets buried under eleven parallel takes.

## The eleven theorists

Each observer has a `name`, `era`, `lens`, `sees`, and `watches` description (in `OBSERVER_INFO` in `lib/config.ts`). The `sees` shapes their worldview; the `watches` tells the LLM what to actively look for. Both feed into the system prompt for the per-event call.

| theorist | lens | what they uniquely surface |
|---|---|---|
| **Marx** | class, surplus, consciousness | Surplus extraction, alienation, contradictions. Private IOUs as new chains; the commons devoured by accumulation. |
| **Polanyi** | embedded economy, great transformation | When trade disembeds from kinship into impersonal price. Fictitious commodity stress. Promises hardening into circulating money. |
| **Bourdieu** | capital, field, habitus | How habitus reproduces across generations even as trait drift moves agents. Capital converting between forms. Symbolic violence. |
| **Durkheim** | solidarity, anomie, social facts | Mechanical vs organic solidarity. Anomie when shared norms loosen. Ritual force of shaming. Credit requiring shared conscience. |
| **Granovetter** | embeddedness, weak ties | Brokerage between clusters. Embedded trust shielding from predation. An issuer's notes travelling through the network until strangers accept. |
| **Schelling** | thresholds, segregation | Tipping points. Spatial sorting. The moment when one issuer's notes tip from a one-off favour into circulating money. |
| **Turchin** | elite overproduction | Structural-demographic preconditions of crisis. Soil's carrying capacity declining beneath population. Financialisation as late-cycle marker. |
| **Farmer** | complexity economics | Emergent price formation. Endogenous money creation. Discount priced by default risk. Positive feedback concentrating wealth. |
| **Epstein** | generative agent-based modelling | "If you didn't grow it, you didn't explain it." Money issued by agents, classes that cluster out of trait variance, commons worn thin from rational harvest. |
| **Flack** | slow variables, policing | What stabilises a system across time. Consensus on issuer trust as a slow variable. Policing through shame. What fails when slow variables erode. |
| **Axelrod** | evolution of cooperation, tit-for-tat | The shadow of the future. Whether retaliation against defectors is swift and visible. An issuer's reputation letting their promises circulate. Predation as the *test* the cooperative strategy was built for, not collapse. |

Adding Axelrod was deliberate. Without him every coercion event read as decline (Marx and Durkheim's natural framing). With him the same predation-and-sanction data can read as *cooperation being defended*, not collapsing — same event, opposite interpretation. That disagreement is the point.

## How significant events are detected

The detector lives in `lib/events.ts`. Every tick, the latest snapshot is compared against a roughly 8-turn history window and a set of latch flags. The full event roster:

| event | trigger | notes |
|---|---|---|
| `founding` | turn = 0 | once per run |
| `inequality_surge` | Gini delta ≥ +0.05 over the window | |
| `leveling` | Gini delta ≤ −0.05 | |
| `stratification` | Gini crossing up through 0.5 | qualitative threshold |
| `population_crash` | alive ≤ 75% of window-ago | |
| `population_boom` | alive ≥ 135% of window-ago AND delta ≥ +15 | |
| `market_forming` | first time trade volume ≥ 12 per turn | once per run |
| `price_shock` | price ratio 1.6× or 0.625× over window | requires active market |
| `collapse` | alive ≤ 18% of run peak | |
| `segregation` | clustering index crossing 0.18, re-arm at 0.12 | |
| `motivation_shift` | one motivation gains ≥ 5% share AND now ≥ 40% | dominance check |
| `coercion_wave` | seizures this turn ≥ max(3, 0.4% of alive) | 60-turn per-kind cooldown |
| `cooperation_thickens` | ≥ 1 issuer with ≥ 3 holders OR ≥ 50% of attacks sanctioned | 60-turn per-kind cooldown |
| `network_fracture` | isolate share rising ≥ 15% to ≥ 40% | trade web dissolving |
| `extreme_inequality` | Gini ≥ 0.6 for 80+ consecutive turns | sustained-state |
| `oligarchy` | top-decile wealth share ≥ 80% for 80+ turns | sustained-state |
| `shock_blight` | engine fires blight | endogenous |
| `shock_plague` | engine fires plague | endogenous |
| `passage` | 30 turns elapsed without other events | heartbeat, max 3 in a row |

Detection uses hysteresis latches for sustained-state events (Gini holds, oligarchy holds) so they fire *once* when the regime locks in, not on every cooldown.

## How routing works

Each event kind has a priority list of theorists in `lib/observer-routing.ts`:

```ts
coercion_wave:        ["axelrod", "marx", "durkheim", "flack"]
cooperation_thickens: ["axelrod", "granovetter", "flack", "epstein"]
market_forming:       ["polanyi", "farmer", "granovetter"]
stratification:       ["bourdieu", "marx", "turchin"]
segregation:          ["schelling", "bourdieu", "durkheim"]
```

When an event fires, `pickObserver(kind, available)` walks the priority list starting at a per-kind rotation offset. The first available theorist (i.e. one the user selected at setup) wins; the offset advances so the next firing of the same kind reaches for a different voice. This is why a run with eight active observers produces visible rotation across `coercion_wave` events instead of Marx narrating every one.

## Pacing — making it readable

The chronicle has four layered throttles so it stays legible regardless of simulation speed:

1. **Global cooldown** — 12 turns minimum between any two events.
2. **Per-kind cooldowns** — `coercion_wave` and `cooperation_thickens` each have a 60-turn floor. Without these, loud recurring events dominated the chronicle.
3. **Hysteresis latches** — `extreme_inequality`, `oligarchy`, `segregation` each fire *once* when the regime locks in, and re-arm only when the underlying metric relaxes back below a lower band.
4. **Wall-clock floor** — `MIN_NARRATION_INTERVAL_MS = 12000` in `observer-narrator.tsx`. Narrations are skipped if dispatch would land less than 12 seconds after the previous one. Skipped events re-detect next tick, so nothing important is lost as long as the condition persists. This is the gate that keeps the chronicle readable at 4× and 8× speeds.

## The prompt and the call

When an event fires:

1. `pickObserver(event.kind, activeObservers)` selects the theorist.
2. `buildSystemPrompt(observer)` constructs the persona system message — `name`, `lens`, `sees`, `watches`, plus formatting rules (2–3 sentences, present tense, no jargon without self-evident meaning, no preamble).
3. `buildUserPrompt(event, world, context)` builds the user message — a one-line setting, the current motivation mix, the trade-tie snapshot, recent earlier events, and the factual event summary.
4. The browser POSTs to `app/api/observe`, which calls Mistral (`mistral-small`).
5. The returned paragraph streams into the chronicle.

If `MISTRAL_API_KEY` is not set, the simulation still runs; the observers stay silent.

## Adding a new observer

Three places to touch:

1. **`lib/config.ts`** — add to the `ObserverKey` union, add an entry to `OBSERVER_INFO` with the four required fields.
2. **`lib/observer-routing.ts`** — add the new observer to whichever event-kind priority lists make sense (and to `passage` for heartbeat rotation).
3. **`lib/config.ts` defaults** — optionally add to `DEFAULT_CONFIG.observers`. (Existing users' saved configs won't auto-include them; they'd toggle on in setup.)

The UI is driven by `Object.keys(OBSERVER_INFO)`, so the new theorist appears in setup automatically.

## Adding a new event kind

Five places in `lib/events.ts` and one in `lib/observer-routing.ts`:

1. Extend the `EventKind` union.
2. Add a `TITLES[kind]` short label.
3. Add detection logic in `detectEvent` (with appropriate hysteresis or cooldown).
4. Optionally extend `EventMetrics` with new fields.
5. Add a `summarize(kind, m)` case producing the factual paragraph the theorist reads.
6. Add a `PRIORITY[kind]` list in `observer-routing.ts`.

The bench script is the fastest way to verify the new event fires at the rate you intended without spinning up the dev server.
