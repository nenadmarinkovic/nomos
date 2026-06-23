"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { DOCS_INDEX } from "@/components/pages/docs-index";
import type { DocHeading } from "@/lib/docs-headings";
import { cn } from "@/lib/utils";

SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("javascript", typescript);
SyntaxHighlighter.registerLanguage("js", typescript);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("sh", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("json", json);

const DOCS_SLUGS = new Set(DOCS_INDEX.map((d) => d.slug));

/** Rewrites file-relative doc links (`about.md`, `observers.md#section`)
 *  into the app's URL routing (`/docs/about`, `/docs/observers#section`).
 *  Links to the project README at the repo root (`../README.md`) point
 *  to GitHub. Everything else passes through unchanged. */
function rewriteDocsLink(href: string | undefined): string | undefined {
  if (!href) return href;
  // `../README.md` (and any `../README.md#anchor`) → keep as-is for now;
  // these refer to the project's repo-root README. We could rewrite to a
  // GitHub URL once we know the repo, but the file path keeps it working
  // on GitHub's docs renderer.
  if (href.startsWith("../")) return href;
  // Local doc-to-doc, with optional anchor: `slug.md` or `slug.md#anchor`.
  const m = /^([a-zA-Z0-9_-]+)\.md(#.*)?$/.exec(href);
  if (m && DOCS_SLUGS.has(m[1])) {
    return `/docs/${m[1]}${m[2] ?? ""}`;
  }
  return href;
}

export function DocsPage({
  activeSlug,
  content,
  headings,
}: {
  activeSlug: string | null;
  content: string | null;
  headings: DocHeading[];
}) {
  const { resolvedTheme } = useTheme();
  const codeStyle = resolvedTheme === "dark" ? oneDark : oneLight;

  const components: Components = {
    // Passthrough — react-markdown wraps fenced code in <pre>, but our
    // `code` component below renders its own bordered card. Unwrapping
    // here keeps us from getting a prose <pre> border around it.
    pre({ children }) {
      return <>{children}</>;
    },
    // Rewrite in-app doc-to-doc links from the file-relative form used in
    // the markdown source (`about.md`, `observers.md#section`) to the
    // app's URL routing (`/docs/about`, `/docs/observers#section`). The
    // raw .md links still resolve correctly when the docs are read on
    // GitHub or in a file browser.
    a({ href, children, ...rest }) {
      const rewritten = rewriteDocsLink(href);
      const isExternal =
        rewritten?.startsWith("http://") || rewritten?.startsWith("https://");
      return (
        <a
          href={rewritten}
          {...(isExternal
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          {...rest}
        >
          {children}
        </a>
      );
    },
    code(props) {
      const { className, children, ...rest } = props;
      const code = String(children).replace(/\n$/, "");
      // Inline vs block detection in react-markdown v10: there's no
      // `inline` prop anymore. Block fences always contain a newline;
      // inline backticks never do.
      const match = /language-(\w+)/.exec(className ?? "");
      const isInline = !code.includes("\n");
      if (isInline) {
        return (
          <code className={className} {...rest}>
            {children}
          </code>
        );
      }
      const lang = match ? match[1] : null;
      return (
        <div className="not-prose my-6 overflow-hidden rounded-md border border-foreground/10 bg-card/40">
          {lang ? (
            <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {lang}
              </span>
            </div>
          ) : null}
          {lang ? (
            <SyntaxHighlighter
              language={lang}
              style={codeStyle}
              customStyle={{
                margin: 0,
                padding: "12px 14px",
                background: "transparent",
                fontSize: "13.5px",
                lineHeight: "1.55",
              }}
              codeTagProps={{
                style: { fontFamily: "var(--font-mono)" },
              }}
            >
              {code}
            </SyntaxHighlighter>
          ) : (
            // No language — render verbatim so ASCII diagrams and the
            // like keep their alignment. Strict monospace, no kerning.
            <pre
              className="overflow-x-auto px-3 py-3 font-mono text-[13px] leading-[1.45] text-foreground/85"
              style={{ fontVariantLigatures: "none" }}
            >
              <code>{code}</code>
            </pre>
          )}
        </div>
      );
    },
  };

  const entry =
    activeSlug !== null ? DOCS_INDEX.find((d) => d.slug === activeSlug) : null;
  // Strip the leading "# Title" from the markdown — the page header
  // below already shows it as the h1, so we'd otherwise render it twice.
  const body = content?.replace(/^\s*#\s+.+\n+/, "") ?? null;

  const articleRef = useRef<HTMLElement>(null);
  const activeHeadingId = useActiveHeading(articleRef, activeSlug);

  // Landing has no TOC — keep the narrow centred welcome layout.
  if (activeSlug === null || !entry) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col px-6 pb-16 pt-16">
        <DocsLanding />
      </div>
    );
  }

  // Article pages: content on the left, sticky TOC on the right at xl+.
  return (
    <div className="mx-auto flex w-full max-w-5xl gap-12 px-6 pb-16 pt-16">
      <div className="min-w-0 flex-1">
        <Header
          eyebrow="Documentation"
          title={entry.title}
          lead={entry.blurb}
        />
        {body ? (
          <article ref={articleRef} className="prose prose-neutral mt-10 max-w-none dark:prose-invert prose-headings:font-serif prose-headings:tracking-tight prose-h1:text-[34px] prose-h1:font-normal prose-h1:leading-tight prose-h2:text-[24px] prose-h2:font-normal prose-h2:mt-12 prose-h3:text-[19px] prose-h3:font-medium prose-h3:mt-8 prose-h2:scroll-mt-20 prose-h3:scroll-mt-20 prose-p:font-serif prose-p:text-[18px] prose-p:leading-relaxed prose-p:text-foreground/85 prose-li:font-serif prose-li:text-[18px] prose-li:leading-relaxed prose-li:text-foreground/85 prose-strong:text-foreground prose-strong:font-semibold prose-em:text-foreground prose-em:italic prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:font-mono prose-code:text-[14px] prose-code:bg-foreground/[0.06] prose-code:px-1 prose-code:py-px prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-card/50 prose-pre:border prose-pre:border-foreground/10 prose-pre:text-[13px] prose-table:text-[14px] prose-th:font-mono prose-th:uppercase prose-th:tracking-wide prose-th:text-[10px] prose-th:text-muted-foreground prose-th:font-medium prose-blockquote:border-l-foreground/20 prose-blockquote:font-serif prose-blockquote:italic">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
              components={components}
            >
              {body}
            </ReactMarkdown>
          </article>
        ) : (
          <p className="mt-8 font-serif italic text-muted-foreground">
            That doc page is not in the index.
          </p>
        )}
        <DocsSeeAlso activeSlug={activeSlug} />
      </div>

      {headings.length > 0 ? (
        <aside className="hidden w-56 shrink-0 xl:block">
          <DocsToc headings={headings} activeId={activeHeadingId} />
        </aside>
      ) : null}
    </div>
  );
}

/** Track the heading currently nearest the top of the scroll viewport.
 *  Re-attaches when the article changes (route navigation). */
function useActiveHeading(
  articleRef: React.RefObject<HTMLElement | null>,
  activeSlug: string | null,
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const viewport = article.closest(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null;
    if (!viewport) return;

    const compute = () => {
      const hs = Array.from(
        article.querySelectorAll<HTMLElement>("h2[id], h3[id]"),
      );
      if (hs.length === 0) {
        setActiveId(null);
        return;
      }
      // Trigger line ~120px below the sticky top nav; pick the last
      // heading whose top has crossed it.
      const triggerY = 120;
      const viewportTop = viewport.getBoundingClientRect().top;
      let next: string = hs[0].id;
      for (const h of hs) {
        const rectTop = h.getBoundingClientRect().top - viewportTop;
        if (rectTop <= triggerY) {
          next = h.id;
        } else {
          break;
        }
      }
      setActiveId(next);
    };

    let frame: number | null = null;
    const onScroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        compute();
      });
    };

    compute();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [articleRef, activeSlug]);

  return activeId;
}

function DocsToc({
  headings,
  activeId,
}: {
  headings: DocHeading[];
  activeId: string | null;
}) {
  const onJump =
    (slug: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Modifier-clicks / middle-clicks should keep native behaviour.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const target = document.getElementById(slug);
      if (!target) return;
      e.preventDefault();
      // scrollIntoView walks up scrollable ancestors, so the ScrollArea
      // viewport scrolls even though the browser document doesn't. The
      // prose's `scroll-mt-20` keeps the heading clear of the sticky nav.
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", `#${slug}`);
      }
    };

  return (
    <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pt-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        On this page
      </p>
      <ul className="mt-3 space-y-1.5 border-l border-foreground/10">
        {headings.map((h) => {
          const isActive = h.slug === activeId;
          return (
            <li key={h.slug}>
              <a
                href={`#${h.slug}`}
                onClick={onJump(h.slug)}
                className={cn(
                  "-ml-px block border-l border-transparent py-0.5 font-sans text-[12.5px] leading-snug transition-colors",
                  h.level === 3 ? "pl-6" : "pl-3",
                  isActive
                    ? "border-l-brand text-brand"
                    : h.level === 3
                      ? "text-foreground/50 hover:text-foreground/80"
                      : "text-foreground/65 hover:text-foreground",
                )}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Header({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <header>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 font-serif text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
        {lead}
      </p>
    </header>
  );
}

function DocsSeeAlso({ activeSlug }: { activeSlug: string }) {
  const others = DOCS_INDEX.filter((d) => d.slug !== activeSlug);
  return (
    <nav className="mt-16 border-t border-foreground/10 pt-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        See also
      </p>
      <ul className="mt-3 space-y-2">
        {others.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/docs/${entry.slug}`}
              className="font-sans text-[14px] text-foreground/80 hover:text-foreground hover:underline"
            >
              {entry.title}
            </Link>
            <span className="ml-2 font-serif text-[13px] italic text-muted-foreground">
              {entry.blurb}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DocsLanding() {
  return (
    <>
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Documentation
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          What <span className="italic text-brand">Nomos</span> is, how it
          runs, and how to extend it.
        </h1>
        <p className="mt-5 font-serif text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
          A grid of agents follows local rules; macro phenomena — markets,
          classes, conflict, money — emerge or fail to emerge from those
          rules. A panel of AI theorists watches the same field and narrates
          what they see in their own vocabulary. These pages explain what
          that actually means.
        </p>
      </header>

      <ul className="mt-10 space-y-3">
        {DOCS_INDEX.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/docs/${entry.slug}`}
              className="block rounded-md border border-foreground/10 bg-card/40 px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-card/60"
            >
              <div className="font-serif text-lg leading-tight text-foreground">
                {entry.title}
              </div>
              <p className="mt-1 font-sans text-[13px] text-muted-foreground">
                {entry.blurb}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-12 text-right font-sans text-[12px] text-muted-foreground">
        Open source project by{" "}
        <a
          href="https://github.com/nenadmarinkovic/nomos"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/80 hover:text-brand hover:underline"
        >
          Nenad Marinkovic
        </a>
        .
      </p>
    </>
  );
}
