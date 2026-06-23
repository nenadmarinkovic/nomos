"use client";

import {
  LANDSCAPE_INFO,
  MOTIVATION_INFO,
  SCALE_INFO,
  SETTLEMENT_INFO,
  SOPHISTICATION_INFO,
  TOPOLOGY_INFO,
  equalityBucket,
  type AgentMotivation,
  type AgentSophistication,
  type SimulationConfig,
} from "@/lib/config";
import { useSimulationStore } from "@/lib/store";

export function RunConditions() {
  const config = useSimulationStore((s) => s.config);
  return <RunConditionsCard config={config} />;
}

function RunConditionsCard({ config }: { config: SimulationConfig }) {
  const world = config.world;
  const agents = config.agents;
  const motivationMix = formatMix(
    agents.motivation,
    (k) => MOTIVATION_INFO[k as AgentMotivation]?.label ?? k,
  );
  const sophistMix = formatMix(
    agents.sophistication,
    (k) => SOPHISTICATION_INFO[k as AgentSophistication]?.label ?? k,
  );

  const worldParts = [
    SCALE_INFO[world.scale].label,
    LANDSCAPE_INFO[world.landscape].label.toLowerCase(),
    SETTLEMENT_INFO[world.initialSettlement].label.toLowerCase(),
    `${equalityBucket(world.equality).label.toLowerCase()} start`,
    `seed ${config.seed}`,
  ];

  const rules: string[] = [];
  rules.push(world.reproduction ? "reproduction" : "no reproduction");
  rules.push(world.inheritance ?? true ? "inheritance" : "no inheritance");
  rules.push(
    world.culturalTransmission ?? true
      ? "cultural drift"
      : "no cultural drift",
  );
  rules.push(world.conflict ?? true ? "conflict" : "no conflict");
  rules.push(`${TOPOLOGY_INFO[agents.topology].label.toLowerCase()} trade`);

  const physicsParts = [
    `lifespan ${world.physics.lifespan}t`,
    `vision ${world.physics.vision}`,
    `metabolism ${world.physics.metabolism.toFixed(1)}`,
    `regrowth ${Math.round(world.physics.regrowthRate * 100)}%`,
    `heterogeneity ${world.physics.heterogeneity.toFixed(2)}`,
  ];

  return (
    <section className="rounded-md border border-foreground/10 bg-card/40 px-4 py-3">
      <div className="flex items-center justify-between gap-2 pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Initial conditions
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          {agents.kind.replace(/_/g, " ")}
        </p>
      </div>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1 font-mono text-[11px] leading-relaxed">
        <Row label="World" value={worldParts.join(" · ")} />
        <Row label="Rules" value={rules.join(" · ")} />
        <Row label="Mix" value={motivationMix} />
        <Row label="Cognition" value={sophistMix} />
        <Row label="Physics" value={physicsParts.join(" · ")} />
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground/85">{value}</dd>
    </>
  );
}

function formatMix<K extends string>(
  weights: Record<K, number | undefined> | Partial<Record<K, number>>,
  labelFor: (k: K) => string,
): string {
  const entries = Object.entries(weights) as [K, number | undefined][];
  const positive = entries.filter(([, w]) => (w ?? 0) > 0);
  const total = positive.reduce((s, [, w]) => s + (w ?? 0), 0);
  if (total <= 0) return "—";
  return positive
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(
      ([k, w]) =>
        `${Math.round(((w ?? 0) / total) * 100)}% ${labelFor(k).toLowerCase()}`,
    )
    .join(" · ");
}
