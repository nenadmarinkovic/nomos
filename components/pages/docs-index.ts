export interface DocsEntry {
  slug: string;
  title: string;
  blurb: string;
}

export const DOCS_INDEX: DocsEntry[] = [
  {
    slug: "about",
    title: "About Nomos",
    blurb: "What the project is, the intellectual move, three illustrative runs.",
  },
  {
    slug: "simulation",
    title: "How the simulation works",
    blurb:
      "The trait vector, per-tick walkthrough, token economy, crisis layer.",
  },
  {
    slug: "observers",
    title: "Observers & chronicle",
    blurb: "The eleven theorists, event detection, routing, pacing.",
  },
  {
    slug: "development",
    title: "Development",
    blurb: "Stack, architecture, scripts, calibration knobs, how to extend.",
  },
];
