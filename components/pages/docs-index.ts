export interface DocsEntry {
  slug: string;
  title: string;
  blurb: string;
}

export const DOCS_INDEX: DocsEntry[] = [
  {
    slug: "about",
    title: "About Nomos",
    blurb:
      "What this is, why it works the way it does, and what a few runs look like.",
  },
  {
    slug: "simulation",
    title: "How the simulation works",
    blurb:
      "What happens on every turn, how trade and IOUs work, and how crises start.",
  },
  {
    slug: "observers",
    title: "The observers",
    blurb:
      "Who the ten observers are, and how the app decides who writes what.",
  },
  {
    slug: "development",
    title: "Development",
    blurb:
      "How the code is put together, how to run it locally, and what to change.",
  },
];
