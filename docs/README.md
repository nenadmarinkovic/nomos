# Nomos · Documentation

Nomos is a society simulation that runs in the browser. A few thousand simple agents live on a grid. Markets, classes, conflict and money are not built in. They either show up on their own or they don't. A panel of AI observers watches the same run and writes about what they see.

These pages go further than the project [README](../README.md). They cover what Nomos is and what it argues, what happens on every turn, how the observers read a run, and how to work on the code.

## Contents

- **[About Nomos](about.md).** What this is, why it works the way it does, and what a few typical runs look like.
- **[How the simulation works](simulation.md).** The four numbers every agent carries, what happens on each turn, how IOUs work, and how things go wrong.
- **[The observers](observers.md).** Who the ten are, how the app spots something worth writing about, and how it decides who writes it.
- **[Development](development.md).** The stack, how it fits together, the scripts, the bench, the numbers worth tuning, and how to add an observer.

## Status

Version `0.9.0`. The engine, the trait-based agents, the IOU economy with bank runs, the grudge ledger the agents build themselves, the leadership signal, the ten observers and the WebGL renderer all work. Public sharing and a proper writeup are what is left before `1.0`.

See the [roadmap in the README](../README.md#roadmap) for milestones.
