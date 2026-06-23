import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

import { DOCS_INDEX } from "@/components/pages/docs-index";
import { DocsPage } from "@/components/pages/docs-page";
import { extractHeadings } from "@/lib/docs-headings";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return DOCS_INDEX.map((d) => ({ slug: d.slug }));
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const entry = DOCS_INDEX.find((d) => d.slug === slug);
  if (!entry) notFound();

  const docPath = path.join(process.cwd(), "docs", `${slug}.md`);
  let content: string;
  try {
    content = await fs.readFile(docPath, "utf8");
  } catch {
    notFound();
  }

  const headings = extractHeadings(content);
  return <DocsPage activeSlug={slug} content={content} headings={headings} />;
}
