"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

export interface WelcomeStep {
  /** Step ordinal, e.g. "01". Kept as a string so we can use non-numeric markers if useful. */
  n: string;
  title: string;
  /** HTML allowed — &lt;em&gt; and inline accents render. */
  body: string;
}

/**
 * Long-form intro that takes over a page until the user has started a run.
 * Mirrors the welcome panel of the Field page so every page reads as part
 * of the same essay when the simulation is idle.
 */
export function PageWelcome({
  eyebrow,
  headline,
  lead,
  steps,
  outro,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  lead: React.ReactNode;
  steps: WelcomeStep[];
  outro?: React.ReactNode;
}) {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto flex max-w-2xl flex-col px-6 pb-16 pt-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          {headline}
        </h1>
        <div className="mt-5 font-serif text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
          {lead}
        </div>

        <ol className="mt-10 space-y-5">
          {steps.map((s) => (
            <li key={s.n} className="grid grid-cols-[2.5rem_1fr] gap-4">
              <span className="pt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {s.n}
              </span>
              <div>
                <div className="font-serif text-lg leading-tight text-foreground">
                  {s.title}
                </div>
                <p
                  className="mt-1.5 font-sans text-[13px] leading-relaxed text-foreground/75 sm:text-sm"
                  dangerouslySetInnerHTML={{ __html: s.body }}
                />
              </div>
            </li>
          ))}
        </ol>

        {outro && (
          <div className="mt-10 font-serif text-[15px] italic leading-relaxed text-muted-foreground">
            {outro}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
