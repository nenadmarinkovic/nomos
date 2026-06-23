# About Nomos

## What it is

Nomos is a society simulation that runs in your browser. A grid of small, simple agents harvests two goods (sugar and spice), trades with neighbours, sometimes seizes from each other, drifts in identity by imitating wealthier peers, reproduces, dies — and a panel of AI theorists watches the same run and narrates what they see in their own vocabulary.

Marx reads class. Axelrod reads tit-for-tat. Durkheim reads solidarity. Polanyi reads commodification. Same data, eleven readings, side by side.

Nothing in the engine programs _inequality, classes, markets, money, norms, or institutions._ They emerge from local rules — or they don't, and that absence is the answer.

## The argument

Most agent-based social models work one of two ways. Either they program the social phenomena directly (a "Power class" is hardcoded to take from others) and then call that emergence, or they keep agents minimal and never recover the sociological texture that makes runs interesting.

Nomos tries to bridge the gap with one move: **the engine is parameter-free about social identity, and the theoretical reading is multi-voiced.**

**Parameter-free identity.** Each agent carries a continuous trait vector — `greed`, `prosociality`, `dominance`, `statusSeeking`, each in `[0,1]`. _Every behavioural rule_ (coercion, cooperation, cultural drift, harvest yields, trade refusal, token acceptance) reads from these traits. There is no hardcoded "Power agent." There are agents with high dominance and low prosociality who _find themselves_ attacking weaker neighbours, and a clustering pass at the end of each tick assigns them a label like "Power" if their traits land near that centroid. The four classical motivations are _findings_, not configurations.

**Multi-voice reading.** Eleven theorists are available — Marx, Polanyi, Bourdieu, Durkheim, Granovetter, Schelling, Turchin, Farmer, Epstein, Flack, Axelrod. The browser detects significant events as the simulation runs and routes each one to whichever theorist's lens has the most concrete purchase on it. A burst of predation might read to Axelrod as the defector wave that iterated games were built to test, to Marx as a sharpening contradiction, to Durkheim as anomie. Three different paragraphs on the same factual event. Across a run you hear every voice; no single moment gets buried under eleven parallel takes.

The combination is the contribution. A continuous-trait engine with post-hoc clustering improves on typed-agent ABMs even without observers. The multi-voiced framing would be a useful pedagogical tool even on a typed-agent engine. Together they let the same simulation be read as Marxian, Bourdieusian, Durkheimian, _and_ Axelrodian — and let you watch the disagreements.

## Why now

Three recent threads in computational social science argue, in different vocabularies, that the field needs more engagement with classical theory:

- Farrell & Shalizi on the gap between formal ABM practice and questions sociologists actually want to ask.
- Roth on cultural cascades and the methodological shortcomings of typed-agent models for identity dynamics.
- Shults on theory-driven generative social science as a programme.

None of these ships a working artefact. Nomos is one possible artefact for what they describe.

## What to watch a run for

Three patterns the engine reliably produces, depending on initial conditions and seed:

### Egalitarian start drifts to oligarchy

A `town`-scale run with an `egalitarian` start (everyone gets identical resources) and the default trait mix. Within a few hundred turns the Gini coefficient climbs past 0.5, then 0.6. A few agents accumulate wealth through trade plus inheritance. Cultural transmission pulls others toward their traits, but _habitus inertia_ — the wealth cost of drifting — keeps the trajectory uneven. Middling agents pay heavily to drift toward elite traits and fall behind in the meantime. By turn 1000 the chronicle reads Turchin (elite overproduction), Marx (sharpening contradictions), and Bourdieu (distinction crystallising) in rotation.

### Aggressive seed collapses trust

The same town, motivation mix skewed toward Power. High-dominance agents seize from weaker neighbours rapidly. Trade ties crash on each coercion. The sanction loop (prosocial witnesses refusing to trade with shamed aggressors) bites, but not enough. Population swings as predation outpaces reproduction. The chronicle reads as collapse — Turchin's disintegrative phase, Marx's rupture, Flack's slow variables eroding. Axelrod notes that the cooperative cluster never reached the density where tit-for-tat could insulate itself.

### Patience produces emergent money

A balanced mix, egalitarian start, run undisturbed for around 1000 turns. The token economy lights up: by turn 500 some agents are issuing IOUs and a few are held by three or more distinct other agents — the threshold at which we count an issuer as "circulating money." The chronicle now reads Polanyi (commodified trust hardening into a medium of exchange), Granovetter (notes travelling through the network from holder to holder), Farmer (endogenous money creation, discount priced by perceived default risk), and Axelrod (credit as the monetary form of repeated-game reciprocity). The most-held issuer is, in effect, an emergent private bank.

These three are not coded presets. They are dynamics the engine produces from initial conditions.

## Running and saving

You can run Nomos without signing in. Each browser gets an anonymous library — the runs you save are tagged with a local id and show up the next time you open the app on the same device. Signing in claims your existing anonymous runs into your account, so they follow you across browsers and devices and aren't lost if you clear local data.

Every saved run also has a shareable URL that anyone can open to replay the same configuration and seed.

## What it doesn't do, honestly

- **It's not a calibrated model of any real society.** Trait centroids and rate constants are first-pass. They produce dynamics that _look like_ the things classical theorists wrote about, but they're not fitted to a historical dataset. The point is to give those theorists something to read.
- **The observers are LLMs in personas, not Marx and Durkheim.** They're good at distinctive vocabulary and bad at saying something genuinely new.
- **City scale is bounded.** The Pixi renderer handles 5,000 agents at 60fps; the original 50,000-agent vision is still a horizon.
- **No public gallery yet.** Saved runs are private to your library (or to whoever has the share URL); there's no browsable feed of other people's runs.

## Where the design came from

The early version was a clean Sugarscape (Epstein & Axtell, 1996): minimal agents, two goods, harvest plus trade. Then a request to add motivations led to a typed-agent enum (`material / symbolic / normative / power`) with hardcoded behaviour branches. That worked, but the engine was now _programming_ the things it was meant to _observe_.

The refactor from typed motivations to continuous traits with post-hoc clustering is the move that made the project's framing ("theories as observers") actually true. A later phase added the token economy: agents short on sugar can pay sellers in private IOUs, which sometimes circulate widely enough to become a real medium of exchange. None of that is configured anywhere; it emerges from one rule — buyers may offer credit, sellers may or may not accept.

Adding Axelrod was deliberate. Without him every coercion event read as decline. With him the same predation-and-sanction data can read as _cooperation being defended_, not collapsing — same event, opposite interpretation. That disagreement is the point.

## Related reading

- Epstein & Axtell, _Growing Artificial Societies_ (1996) — the Sugarscape that Nomos descends from.
- Axelrod, _The Evolution of Cooperation_ (1984) — the multi-tournament finding that put tit-for-tat on the map.
- Bourdieu, _Distinction_ (1984) — habitus as the embodied conversion between forms of capital.
- Polanyi, _The Great Transformation_ (1944) — fictitious commodification and the counter-movement.
- Simon, _The Sciences of the Artificial_ (1969) — bounded rationality and the methodological case for studying emergent systems by building them.
- Farmer, _Making Sense of Chaos_ (2024) — the popular statement of the complexity-economics lens one of the observers reads through.
- Turchin, _Secular Cycles_ (2009) — structural-demographic theory of integrative and disintegrative phases.
- Flack & Krakauer on slow variables, robustness, and collective computation in animal societies.
