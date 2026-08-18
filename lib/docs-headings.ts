export interface DocHeading {
  level: 2 | 3;
  text: string;
  slug: string;
}

/** GitHub-style slugifier matching `rehype-slug` / `github-slugger`'s
 *  basic case. Lower-cases, strips punctuation, replaces whitespace with
 *  hyphens. Doesn't handle duplicate-suffix counters; the headings in
 *  these docs are unique within their pages so we don't need to. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&[a-z]+;|&#\d+;/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const lines = markdown.split("\n");
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    const text = m[2].replace(/`/g, "").trim();
    headings.push({ level, text, slug: slugify(text) });
  }
  return headings;
}
