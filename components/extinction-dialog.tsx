"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowClockwiseIcon, StopIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SCALE_INFO } from "@/lib/config";
import { useSimulationStore } from "@/lib/store";

export function ExtinctionDialog() {
  const started = useSimulationStore((s) => s.started);
  const snapshot = useSimulationStore((s) => s.snapshot);
  const turn = useSimulationStore((s) => s.turn);
  const runId = useSimulationStore((s) => s.runId);
  const config = useSimulationStore((s) => s.config);
  const history = useSimulationStore((s) => s.history);
  const stopRun = useSimulationStore((s) => s.stopRun);
  const startRun = useSimulationStore((s) => s.startRun);

  const [open, setOpen] = useState(false);
  const seenRun = useRef<number | null>(null);

  useEffect(() => {
    const extinct = started && turn > 0 && snapshot.alive === 0;
    if (!extinct) return;
    if (seenRun.current === runId) return;
    seenRun.current = runId;
    setOpen(true);
  }, [started, snapshot.alive, turn, runId]);

  const peakAlive = history.reduce((m, h) => (h.alive > m ? h.alive : m), 0);
  const startCount = SCALE_INFO[config.world.scale].agents;

  const onStop = () => {
    setOpen(false);
    stopRun();
  };
  const onRestart = () => {
    setOpen(false);
    startRun();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Everyone died</DialogTitle>
          <DialogDescription>
            There is nobody left, so the run has stopped. Here is how it went.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-baseline gap-3 border-y border-foreground/10 py-3">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Died out on turn
          </span>
          <span className="font-mono text-[24px] leading-none tabular-nums text-foreground">
            {turn.toLocaleString()}
          </span>
        </div>

        <section>
          <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            How it went
          </h3>
          <div className="grid grid-cols-3 divide-x divide-foreground/10 rounded-sm border border-foreground/10">
            <Stat label="Started with" value={startCount.toLocaleString()} />
            <Stat label="Most alive" value={peakAlive.toLocaleString()} />
            <Stat label="Final inequality" value={snapshot.gini.toFixed(3)} />
          </div>
        </section>

        <section className="mt-3">
          <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            What you had set
          </h3>
          <div className="grid grid-cols-3 divide-x divide-foreground/10 rounded-sm border border-foreground/10">
            <Stat
              label="Lifespan"
              value={`${config.world.physics.lifespan}t`}
            />
            <Stat
              label="Food burned"
              value={config.world.physics.metabolism.toFixed(1)}
            />
            <Stat
              label="Regrowth"
              value={`${Math.round(config.world.physics.regrowthRate * 100)}%`}
            />
          </div>
        </section>

        <DialogFooter className="border-t-0">
          <Button variant="ghost" size="sm" onClick={onStop}>
            <StopIcon weight="fill" />
            Stop
          </Button>
          <Button variant="default" size="sm" onClick={onRestart}>
            <ArrowClockwiseIcon weight="fill" />
            New run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span
        className={
          muted
            ? "font-mono text-sm tabular-nums text-muted-foreground"
            : "font-mono text-sm tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
