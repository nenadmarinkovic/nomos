"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

import { DOCS_INDEX } from "@/components/pages/docs-index";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const activeSlug = extractSlug(pathname);

  return (
    <ScrollArea className="flex-1">
      {activeSlug ? <DocsTopNav activeSlug={activeSlug} /> : null}
      {children}
    </ScrollArea>
  );
}

function extractSlug(pathname: string): string | null {
  const match = /^\/docs\/([a-zA-Z0-9_-]+)/.exec(pathname);
  return match ? match[1] : null;
}

function DocsTopNav({ activeSlug }: { activeSlug: string }) {
  const navRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [pill, setPill] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const nav = navRef.current;
      const tab = tabsRef.current.get(activeSlug);
      if (!nav || !tab) return;
      const navRect = nav.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      setPill({
        left: tabRect.left - navRect.left,
        top: tabRect.top - navRect.top,
        width: tabRect.width,
        height: tabRect.height,
      });
      // Enable transitions on the next frame so the first measurement
      // doesn't slide in from (0, 0).
      requestAnimationFrame(() => setAnimated(true));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeSlug]);

  return (
    <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-sm">
      <nav
        ref={navRef}
        className="relative mx-auto flex w-full max-w-2xl flex-wrap items-center gap-1 px-6 py-3"
      >
        {pill ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 rounded-md bg-foreground/[0.08] will-change-transform"
            style={{
              transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`,
              width: pill.width,
              height: pill.height,
              transition: animated
                ? "transform 320ms cubic-bezier(0.32, 0.72, 0.24, 1), width 320ms cubic-bezier(0.32, 0.72, 0.24, 1), height 320ms cubic-bezier(0.32, 0.72, 0.24, 1)"
                : undefined,
            }}
          />
        ) : null}
        {DOCS_INDEX.map((entry) => (
          <Link
            key={entry.slug}
            ref={(el) => {
              if (el) tabsRef.current.set(entry.slug, el);
              else tabsRef.current.delete(entry.slug);
            }}
            href={`/docs/${entry.slug}`}
            className={cn(
              "relative z-[1] rounded-md px-3 py-1.5 font-sans text-[13px] transition-colors duration-200",
              activeSlug === entry.slug
                ? "text-foreground"
                : "text-foreground/65 hover:text-foreground",
            )}
          >
            {entry.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
