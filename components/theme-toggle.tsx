"use client";

import { useEffect, useState } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const options = [
  { value: "system", icon: Desktop, label: "System" },
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-7 w-[80px] rounded-full bg-card border border-foreground/10",
          className,
        )}
      />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0 rounded-full bg-card p-0.5 border border-foreground/10",
        className,
      )}
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative flex size-6 items-center justify-center rounded-full cursor-pointer",
              active
                ? "bg-background text-foreground border border-foreground/20"
                : "text-foreground/55 hover:text-foreground",
            )}
          >
            <Icon size={12} weight="regular" />
          </button>
        );
      })}
    </div>
  );
}
