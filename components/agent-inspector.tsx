"use client";

import { useDraggable } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { XIcon } from "@phosphor-icons/react";

import { activeWorldRef } from "@/lib/active-world";
import { useSimulationStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface AgentSnapshot {
  id: number;
  alive: boolean;
  x: number;
  y: number;
  sugar: number;
  spice: number;
  age: number;
  maxAge: number;
  vision: number;
  sugarMetab: number;
  spiceMetab: number;
  motivation: string;
}

export function AgentInspectorOverlay({
  selectedId,
  position,
  onClose,
}: {
  selectedId: number;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: "inspector" });
  const turn = useSimulationStore((s) => s.turn);
  const [snap, setSnap] = useState<AgentSnapshot | null>(null);

  useEffect(() => {
    const world = activeWorldRef.current;
    if (!world) {
      setSnap(null);
      return;
    }
    const a = world.agents[selectedId];
    if (!a) {
      setSnap(null);
      return;
    }
    setSnap({
      id: a.id,
      alive: a.alive,
      x: a.x,
      y: a.y,
      sugar: a.sugar,
      spice: a.spice,
      age: a.age,
      maxAge: a.maxAge,
      vision: a.vision,
      sugarMetab: a.sugarMetab,
      spiceMetab: a.spiceMetab,
      motivation: a.motivation,
    });
  }, [turn, selectedId]);

  if (!snap) return null;

  const x = position.x + (transform?.x ?? 0);
  const y = position.y + (transform?.y ?? 0);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
      className={cn(
        "pointer-events-auto absolute left-0 top-0 w-64 rounded-md border border-foreground/15 bg-card/95 font-sans text-foreground backdrop-blur-md",
      )}
    >
      <div
        {...listeners}
        {...attributes}
        className={cn(
          "flex items-center justify-between gap-2 border-b border-foreground/10 px-3 py-2",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Agent #{snap.id}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close inspector"
          className="cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <XIcon size={12} weight="bold" />
        </button>
      </div>
      <div className="px-3 py-3">
        {!snap.alive ? (
          <p className="font-serif text-[13px] italic text-foreground/70">
            Deceased.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
            <InspectorRow label="Motivation" value={snap.motivation} />
            <InspectorRow
              label="Wealth"
              value={(snap.sugar + snap.spice).toFixed(1)}
            />
            <InspectorRow label="Sugar" value={snap.sugar.toFixed(1)} />
            <InspectorRow label="Spice" value={snap.spice.toFixed(1)} />
            <InspectorRow label="Position" value={`${snap.x}, ${snap.y}`} />
            <InspectorRow
              label="Age"
              value={`${snap.age} / ${snap.maxAge}`}
            />
            <InspectorRow label="Vision" value={snap.vision.toString()} />
            <InspectorRow
              label="Metabolism"
              value={`${snap.sugarMetab.toFixed(1)} / ${snap.spiceMetab.toFixed(1)}`}
            />
          </dl>
        )}
      </div>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right font-mono tabular-nums text-foreground">
        {value}
      </dd>
    </>
  );
}
