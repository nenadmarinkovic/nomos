"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Shared layout primitives for the control groups below the sidebar nav.
 *
 * Every group is a title followed by rows, and every row is a label on the
 * left with its control flush to the right edge, on one shared row height.
 * Keeping these in one place is what stops the four control components from
 * drifting apart on padding, type size, and alignment.
 */

/**
 * The sidebar's tonal ladder. Four steps, all alpha on `foreground`, which is
 * pure black in light and pure white in dark — so the greys stay neutral
 * instead of picking up the warm tint `muted-foreground` carries, and they
 * invert correctly without a second set of values.
 *
 * Icons always take the tier of the text they sit next to; nothing in the
 * sidebar gets a colour of its own.
 */
export const SIDEBAR_TONE = {
  /** Where you are, and who you are. Reads first. */
  strong: "text-foreground",
  /** Everything you can click or read: nav links, control labels. */
  body: "text-foreground/75",
  /** Secondary controls that shouldn't compete: menu triggers, inline actions. */
  support: "text-foreground/55",
  /** Signposts you read once and stop seeing: group headings. */
  faint: "text-foreground/40",
} as const;

export function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-foreground/10 px-3 py-2">
      <div className="flex h-6 items-center justify-between gap-2">
        <h2
          className={cn(
            "font-mono text-xs uppercase tracking-[0.16em]",
            SIDEBAR_TONE.faint,
          )}
        >
          {title}
        </h2>
        {action}
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

export function SidebarSectionAction({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline",
        SIDEBAR_TONE.support,
      )}
    >
      {children}
    </button>
  );
}

export function SidebarRow({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  /** Set when the row's control is a labellable input, so the label clicks through. */
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-7 items-center justify-between gap-2",
        SIDEBAR_TONE.body,
        className,
      )}
    >
      {htmlFor ? (
        <Label
          htmlFor={htmlFor}
          className="flex-1 cursor-pointer text-xs font-normal text-inherit"
        >
          {label}
        </Label>
      ) : (
        <span className="flex-1 text-xs">{label}</span>
      )}
      {children}
    </div>
  );
}
