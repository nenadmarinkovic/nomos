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
          <DialogTitle>The society has died out</DialogTitle>
          <DialogDescription>
            No survivors remain. The simulation has halted — nothing further can
            emerge from an empty world.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-baseline gap-3 border-y border-foreground/10 py-3">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Extinct at turn
          </span>
          <span className="font-mono text-[24px] leading-none tabular-nums text-foreground">
            {turn.toLocaleString()}
          </span>
        </div>

        <section>
          <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Outcome
          </h3>
          <div className="grid grid-cols-3 divide-x divide-foreground/10 rounded-sm border border-foreground/10">
            <Stat label="Started" value={startCount.toLocaleString()} />
            <Stat label="Peak" value={peakAlive.toLocaleString()} />
            <Stat label="Final Gini" value={snapshot.gini.toFixed(3)} />
          </div>
        </section>

        <section className="mt-3">
          <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Conditions
          </h3>
          <div className="grid grid-cols-3 divide-x divide-foreground/10 rounded-sm border border-foreground/10">
            <Stat
              label="Lifespan"
              value={`${config.world.physics.lifespan}t`}
            />
            <Stat
              label="Metabolism"
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
