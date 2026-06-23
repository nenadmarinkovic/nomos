# Nomos · Documentation

Nomos is a generative society simulation in the browser. A grid of agents follows local rules; macro phenomena — markets, classes, conflict, money — emerge or fail to emerge from those rules. A panel of AI theorists watches the same field and narrates what they see in their own vocabulary.

These docs go deeper than the project [README](../README.md). They explain what Nomos *is* (and what it argues), how the simulation works tick by tick, how the observers read it, and how to develop on the codebase.

## Contents

- **[About Nomos](about.md)** — what the project is, the intellectual move, why it exists, three illustrative runs you might recognise from your own.
- **[How the simulation works](simulation.md)** — the trait vector, what happens each tick, the token economy, the endogenous crisis layer.
- **[Observers and the chronicle](observers.md)** — the eleven theorists, how significant events are detected, how routing produces a multi-voice reading.
- **[Development](development.md)** — stack, architecture, scripts, the bench, calibration knobs, how to add a new observer.

## Status

Version `0.8.0`. The simulation core, the trait-based agent model, the token economy, the eleven observers, and the Pixi WebGL renderer are all working. Accounts/public-sharing and a polished writeup are the two remaining items before a `1.0`.

See the [roadmap in the README](../README.md#roadmap) for milestones.
