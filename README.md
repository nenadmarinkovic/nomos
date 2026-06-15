# Nomos

A society simulation where agents follow simple rules and AI theorists observe what emerges.

> **Status:** In development

## Architecture

1. **Initial conditions** — population, resource landscape, starting equality, reproduction. Kept as minimal as defensible (Epstein's Rawlsian commitment).
2. **Agent model** — one or two simple rules for movement, exchange, harvest, metabolism, adaptation.
3. **Simulation engine** — agents follow rules, society emerges. Trade, law, states, politics, conflict aren't programmed — they emerge or don't.
4. **Observers** — AI theorists (Bourdieu, Durkheim, Marx, Luhmann, Ibn Khaldun, Turchin, Schelling, Epstein, Flack) watch the same field and describe what they see in their own vocabulary.

## Stack

**Frontend**

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5
- Tailwind CSS v4
- Phosphor Icons
- Local fonts: Newsreader (serif) and Google Sans Flex (sans)

**Simulation runtime** _(planned)_

- PixiJS (WebGL) for the agent field — targeting 100k agents at 60fps
- Web Workers off the main thread for the tick loop
- D3 for territory contours and the subsystem force graph
- Zustand for cross-component state, Framer Motion for narrator transitions

**Data**

- Prisma + SQLite for local development
- PostgreSQL (Hetzner-managed) once multi-user and shareable runs land

**Observers**

- Mistral API (`mistral-small`) for per-theorist narration on significant events
- One Mistral call per active observer per significant event — not per tick

**Infrastructure**

- Hetzner VPS (Falkenstein) running Dokploy for deploy + reverse proxy
- [Better Auth](https://www.better-auth.com) for auth (when user accounts are added)

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If styles look stale after a config change, clear Turbopack's cache:

```bash
rm -rf .next && npm run dev
```

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
```
