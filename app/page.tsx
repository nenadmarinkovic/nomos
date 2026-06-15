"use client";

import { useState } from "react";

import { InitialConditionsDialog } from "@/components/initial-conditions-dialog";
import { Sidebar, type SectionKey } from "@/components/sidebar";
import { SimulationCanvas } from "@/components/simulation-canvas";
import { SiteHeader } from "@/components/site-header";
import {
  DEFAULT_CONFIG,
  SCALE_INFO,
  SimulationConfig,
} from "@/lib/config";

export default function Home() {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [turn, setTurn] = useState(0);
  const [section, setSection] = useState<SectionKey>("world");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <SiteHeader
        running={running}
        turn={turn}
        onRunToggle={() => setRunning((r) => !r)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={section}
          onSelect={setSection}
          agentCount={SCALE_INFO[config.scale].agents}
          observerCount={config.observers.length}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
        <main className="flex flex-1 overflow-hidden">
          <SimulationCanvas running={running} />
        </main>
      </div>

      <InitialConditionsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={config}
        onApply={(next) => {
          setConfig(next);
          setRunning(false);
          setTurn(0);
        }}
      />
    </div>
  );
}
