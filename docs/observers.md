# The observers

The observers are what separate Nomos from a simulation with some charts next to it. While the run goes, the app watches for notable moments and hands each one to whichever observer has the most to say about it. That produces one short paragraph in that person's voice. Over a run you hear from everyone, and no single moment gets buried under ten takes at once.

## Who they are

Each observer has a `name`, `era`, `lens`, `sees` and `watches` entry in `OBSERVER_INFO` in `lib/config.ts`. `sees` sets up how they look at the world. `watches` tells the model what to go looking for. Both go into the prompt.

| observer        | lens                                               | what only they notice                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marx**        | who owns what, and who works for whom              | Who is extracting from whom. IOUs as a new kind of chain. The land eaten up to keep accumulation going.                                                                                                               |
| **Polanyi**     | when trade between neighbours turns into a market  | The moment exchange stops being personal and becomes price. Promises hardening into money, and dissolving again when confidence goes.                                                                                 |
| **Bourdieu**    | status, taste and how advantage gets passed on     | How advantage survives across generations even as agents change. Money turning into standing and back again.                                                                                                          |
| **Granovetter** | who knows whom, and what travels along those links | Who connects groups that would otherwise never meet. How a relationship shields you from being robbed. How one agent's IOUs reach people who never met them.                                                          |
| **Schelling**   | small preferences that tip into big sorting        | Tipping points. The map quietly sorting itself. The moment one agent's IOUs stop being a favour and start being money.                                                                                                |
| **Turchin**     | the long build-up before a crisis                  | Too many people competing for too few good positions. The land supporting fewer than it used to. Credit papering over the gap.                                                                                        |
| **Farmer**      | prices, money and instability                      | Where the price comes from and when it gets wild. Money being created out of nothing but a promise. Feedback loops concentrating wealth.                                                                              |
| **Epstein**     | big patterns coming out of small rules             | "If you didn't grow it, you didn't explain it." Whether the money, the classes and the worn-out land actually grew here or were assumed in.                                                                           |
| **Flack**       | the quiet things holding a society together        | What keeps the run stable over time, like everyone agreeing an issuer is good for it. Shame as policing. What breaks when those go.                                                                                   |
| **Axelrod**     | who cooperates, who cheats, and what happens next  | Whether people expect to meet again. Whether cheats get punished quickly and publicly. Whether a good reputation lets your IOUs circulate. Attacks as the test cooperation was built to survive, not proof it failed. |

Adding Axelrod was deliberate. Without him, every fight read as decline, because that is how Marx and Flack naturally read one. With him, the same attacks and punishments can read as cooperation defending itself. Same events, opposite conclusion. That is the point.

## How the app decides something happened

The detector is in `lib/events.ts`. Every turn it compares the latest snapshot against roughly the last 8 turns and a set of flags. Here is everything it looks for:

| event                  | trigger                                                    | notes                      |
| ---------------------- | ---------------------------------------------------------- | -------------------------- |
| `founding`             | turn = 0                                                   | once per run               |
| `inequality_surge`     | Gini delta ≥ +0.05 over the window                         |                            |
| `leveling`             | Gini delta ≤ −0.05                                         |                            |
| `stratification`       | Gini crossing up through 0.5                               | qualitative threshold      |
| `population_crash`     | alive ≤ 75% of window-ago                                  |                            |
| `population_boom`      | alive ≥ 135% of window-ago AND delta ≥ +15                 |                            |
| `market_forming`       | first time trade volume ≥ 12 per turn                      | once per run               |
| `price_shock`          | price ratio 1.6× or 0.625× over window                     | requires active market     |
| `collapse`             | alive ≤ 18% of run peak                                    |                            |
| `segregation`          | clustering index crossing 0.18, re-arm at 0.12             |                            |
| `motivation_shift`     | one motivation gains ≥ 5% share AND now ≥ 40%              | dominance check            |
| `coercion_wave`        | seizures this turn ≥ max(3, 0.4% of alive)                 | 60-turn per-kind cooldown  |
| `cooperation_thickens` | ≥ 1 issuer with ≥ 3 holders OR ≥ 50% of attacks sanctioned | 60-turn per-kind cooldown  |
| `network_fracture`     | isolate share rising ≥ 15% to ≥ 40%                        | trade web dissolving       |
| `extreme_inequality`   | Gini ≥ 0.6 for 80+ consecutive turns                       | sustained-state            |
| `oligarchy`            | top-decile wealth share ≥ 80% for 80+ turns                | sustained-state            |
| `shock_blight`         | engine fires blight                                        | rate = f(land degradation) |
| `shock_plague`         | engine fires plague                                        | rate = f(density)          |
| `leadership_emerges`   | top agent's inbound tie weight ≥ 24                        | latched; re-arms at 14     |
| `bank_run`             | mistrust in top issuer crosses 0.35                        | 60-turn cooldown           |
| `passage`              | 30 turns elapsed without other events                      | heartbeat, max 3 in a row  |

Events that describe a lasting state, like inequality staying high, are latched. They fire once when things settle into that state, rather than over and over.

## How the app picks who writes

Each kind of event has a ranked list of observers in `lib/observer-routing.ts`:

```ts
coercion_wave: ["axelrod", "marx", "flack"];
cooperation_thickens: ["axelrod", "granovetter", "flack", "epstein"];
market_forming: ["polanyi", "farmer", "granovetter"];
stratification: ["bourdieu", "marx", "turchin"];
segregation: ["schelling", "bourdieu", "granovetter"];
leadership_emerges: ["granovetter", "flack", "bourdieu"];
bank_run: ["polanyi", "farmer", "marx"];
```

When an event fires, `pickObserver(kind, available)` walks that list, starting from a rotating offset for that kind. The first observer on the list who is actually turned on gets it, and the offset moves along, so the next event of the same kind goes to someone else. This is why a run with eight observers on spreads the fights around instead of letting Marx narrate every one.

## Keeping it readable

Four separate limits stop the writing from flooding the page, however fast you run the simulation:

1. **A general gap.** At least 12 turns between any two events.
2. **A gap per kind.** `coercion_wave` and `cooperation_thickens` each need 60 turns. Without that, the noisy events crowded out everything else.
3. **Latches.** `extreme_inequality`, `oligarchy` and `segregation` fire once when things settle, and only reset when the number they track falls back well below the trigger.
4. **A real-time gap.** `MIN_NARRATION_INTERVAL_MS = 12000` in `observer-narrator.tsx`. Nothing gets written less than 12 seconds after the last thing. Skipped events get picked up again next turn, so nothing is lost as long as the situation holds. This is what makes the page readable at 4× and 8× speed.

## The prompt, and the call

When an event fires:

1. `pickObserver(event.kind, activeObservers)` picks the observer.
2. `buildSystemPrompt(observer)` builds the system message: `name`, `lens`, `sees`, `watches`, plus the rules for the answer (two or three sentences, present tense, no jargon unless it explains itself, no preamble).
3. `buildUserPrompt(event, world, context)` builds the user message: one line of setting, the current mix of what agents want, a snapshot of who is trading with whom, what happened earlier in the run, and a plain description of the event itself.
4. The browser POSTs to `app/api/observe`, which calls Mistral (`mistral-small`).
5. The paragraph that comes back goes onto the Narrator page.

If `MISTRAL_API_KEY` is not set, everything still runs. The observers just stay quiet.

## Adding a new observer

Three places to touch:

1. **`lib/config.ts`.** Add them to the `ObserverKey` union and add an `OBSERVER_INFO` entry with all four fields.
2. **`lib/observer-routing.ts`.** Add them to whichever event lists make sense, and to `passage` so they turn up in the quiet stretches.
3. **The defaults in `lib/config.ts`.** Optionally add them to `DEFAULT_CONFIG.observers`. Anyone with a saved config won't get them automatically and would turn them on in setup.

The setup screen is built from `Object.keys(OBSERVER_INFO)`, so a new observer shows up there on its own.

## Adding a new event kind

Five places in `lib/events.ts`, and one in `lib/observer-routing.ts`:

1. Extend the `EventKind` union.
2. Add a short label under `TITLES[kind]`.
3. Add the detection in `detectEvent`, with a latch or a cooldown if it needs one.
4. Optionally extend `EventMetrics` with new fields.
5. Add a `summarize(kind, m)` case that writes the plain description the observer will read.
6. Add a `PRIORITY[kind]` list in `observer-routing.ts`.

The bench script is the quickest way to check your new event fires as often as you meant it to, without starting the dev server.
