"use client";

import { CheckIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export interface Step {
  key: string;
  label: string;
  description: string;
}

interface StepperProps {
  steps: readonly Step[];
  step: number;
  maxReached: number;
  onSelect: (i: number) => void;
}

export function Stepper({ steps, step, maxReached, onSelect }: StepperProps) {
  const inset = 100 / (steps.length * 2);
  const trackSpan = 100 - inset * 2;

  return (
    <div className="shrink-0 px-5 pb-1 pt-5 sm:px-6 sm:pb-2 sm:pt-6">
      <div className="relative">
        <div
          className="absolute h-px bg-foreground/10"
          style={{ top: 18, left: `${inset}%`, right: `${inset}%` }}
        />
        <div
          className="absolute h-[2px] bg-foreground"
          style={{
            top: 17.5,
            left: `${inset}%`,
            width: `${(step / (steps.length - 1)) * trackSpan}%`,
            transition: "width 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
          }}
        >
          {steps.map((s, i) => {
            const isCurrent = i === step;
            const isComplete = i < step;
            const isReachable = i <= maxReached;
            const isFuture = !isReachable && !isCurrent;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelect(i)}
                className={cn(
                  "group flex flex-col items-center border-0 bg-transparent p-0 text-center",
                  isCurrent
                    ? "cursor-default"
                    : isReachable
                      ? "cursor-pointer"
                      : "cursor-default",
                )}
              >
                <div
                  className={cn(
                    "mb-3 transition-transform duration-300 ease-out",
                    isReachable && !isCurrent && "group-hover:scale-110",
                  )}
                >
                  <div
                    className={cn(
                      "relative z-10 flex size-9 items-center justify-center rounded-full border-2 bg-card ring-offset-0 transition-[border-color,background-color,color,transform,box-shadow] duration-400",
                      (isCurrent || isComplete) &&
                        "border-foreground bg-foreground",
                      !isCurrent && !isComplete && "border-foreground/15",
                      isCurrent && "ring-4 ring-foreground/10",
                    )}
                    style={{
                      transitionTimingFunction:
                        "cubic-bezier(0.34, 1.56, 0.64, 1)",
                      transform: isFuture ? "scale(0.85)" : "scale(1)",
                    }}
                  >
                    {isComplete ? (
                      <CheckIcon
                        size={13}
                        weight="bold"
                        className="text-background"
                      />
                    ) : (
                      <span
                        className={cn(
                          "font-mono text-[11px] font-medium tabular-nums",
                          isCurrent
                            ? "text-background"
                            : "text-muted-foreground",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    "font-sans text-sm font-medium leading-none",
                    isCurrent || isComplete
                      ? "text-foreground"
                      : isReachable
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50",
                  )}
                >
                  {s.label}
                </div>
                <div
                  className={cn(
                    "mt-1 hidden max-w-[180px] font-sans text-[11px] leading-snug sm:block",
                    isCurrent
                      ? "text-muted-foreground"
                      : isComplete
                        ? "text-muted-foreground/70"
                        : "text-muted-foreground/40",
                  )}
                >
                  {s.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
