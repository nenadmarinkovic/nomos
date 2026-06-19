"use client";

import Image from "next/image";
import Link from "next/link";
import { PauseIcon, PlayIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface SiteHeaderProps {
  running: boolean;
  onRun: () => void;
  onPause: () => void;
}

export function SiteHeader({ running, onRun, onPause }: SiteHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-foreground/10 bg-background px-4">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Nomos" className="flex items-center">
          <Image
            src="/logo.svg"
            alt="Nomos"
            width={38}
            height={35}
            priority
            className="h-12 w-auto dark:invert"
          />
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant={running ? "secondary" : "default"}
          size="sm"
          onClick={running ? onPause : onRun}
        >
          {running ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
          {running ? "Pause" : "Run"}
        </Button>
      </div>
    </header>
  );
}
