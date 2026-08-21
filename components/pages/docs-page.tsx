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

function rewriteDocsLink(href: string | undefined): string | undefined {
  if (!href) return href;

  if (href.startsWith("../")) return href;
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
    pre({ children }) {
      return <>{children}</>;
    },

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
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
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
            <pre
              className="overflow-x-auto px-3 py-3 font-mono text-sm leading-[1.45] text-foreground/85"
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

  const body = content?.replace(/^\s*#\s+.+\n+/, "") ?? null;

  const articleRef = useRef<HTMLElement>(null);
  const activeHeadingId = useActiveHeading(articleRef, activeSlug);

  if (activeSlug === null || !entry) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col px-6 pb-16 pt-16">
        <DocsLanding />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-12 px-6 pb-16 pt-16">
      <div className="min-w-0 flex-1">
        <Header
          eyebrow="Documentation"
          title={entry.title}
          lead={entry.blurb}
        />
        {body ? (
          <article
            ref={articleRef}
            className="prose prose-neutral mt-10 max-w-none dark:prose-invert prose-headings:tracking-tight prose-headings:text-foreground prose-h1:text-3xl prose-h1:font-light prose-h2:text-xl prose-h2:font-light prose-h2:mt-10 prose-h3:text-lg prose-h3:font-normal prose-h3:mt-8 prose-h3:text-foreground/90 prose-h2:scroll-mt-20 prose-h3:scroll-mt-20 prose-p:text-base prose-p:text-foreground/75 prose-li:text-base prose-li:text-foreground/75 prose-strong:text-foreground prose-strong:font-semibold prose-em:text-foreground prose-em:italic prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:font-mono prose-code:text-sm prose-code:text-foreground prose-code:bg-foreground/6 prose-code:px-1 prose-code:py-px prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-card/50 prose-pre:border prose-pre:border-foreground/10 prose-pre:text-sm prose-table:text-sm prose-table:text-foreground/80 prose-th:font-mono prose-th:uppercase prose-th:tracking-wide prose-th:text-xs prose-th:text-muted-foreground prose-th:font-medium prose-blockquote:border-l-foreground/20 prose-blockquote:italic prose-blockquote:text-foreground/70"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
              components={components}
            >
              {body}
            </ReactMarkdown>
          </article>
        ) : (
          <p className="mt-8 text-muted-foreground">There is no page here.</p>
        )}
        <DocsSeeAlso activeSlug={activeSlug} />
      </div>

      {headings.length > 0 ? (
        <aside className="hidden w-56 shrink-0 pt-7.5 xl:block">
          <DocsToc headings={headings} activeId={activeHeadingId} />
        </aside>
      ) : null}
    </div>
  );
}

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
  const onJump = (slug: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const target = document.getElementById(slug);
    if (!target) return;
    e.preventDefault();

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `#${slug}`);
    }
  };

  return (
    <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
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
                  "-ml-px block border-l border-transparent py-0.5 text-[12.5px] leading-snug transition-colors",
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
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-base text-foreground/80 sm:text-lg">{lead}</p>
    </header>
  );
}

function DocsSeeAlso({ activeSlug }: { activeSlug: string }) {
  const others = DOCS_INDEX.filter((d) => d.slug !== activeSlug);
  return (
    <nav className="mt-16 border-t border-foreground/10 pt-6">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        See also
      </p>
      <ul className="mt-3 space-y-2">
        {others.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/docs/${entry.slug}`}
              className="text-[14px] text-foreground/80 hover:text-foreground hover:underline"
            >
              {entry.title}
            </Link>
            <span className="ml-2 text-sm text-muted-foreground">
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
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Documentation
        </p>
        <h1 className="mt-3 text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          What Nomos is, how it runs, and how to change it.
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
          A few thousand simple agents live on a grid. They gather food, trade,
          fight, have children and die. Markets, classes, money and conflict are
          not built in. They either show up on their own or they do not. A group
          of AI observers watches the same run and writes about it. These pages
          explain how all of that works.
        </p>
        <p className="mt-6 text-start text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
          Nomos is an{" "}
          <a
            href="https://github.com/nenadmarinkovic/nomos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand transition-[filter] hover:brightness-90"
          >
            open-source
          </a>{" "}
          project by{" "}
          <a
            href="https://nenadmarinkovic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand transition-[filter] hover:brightness-90"
          >
            Nenad Marinković
          </a>
          .
        </p>
      </header>

      <ul className="mt-10 space-y-3">
        {DOCS_INDEX.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/docs/${entry.slug}`}
              className="block rounded-md border border-foreground/10 bg-card/40 px-4 py-3 transition-colors hover:border-foreground/20 hover:bg-card/60"
            >
              <div className="text-lg leading-tight text-foreground">
                {entry.title}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.blurb}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
