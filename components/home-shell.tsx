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

const SIDEBAR_COOKIE = "sidebar-collapsed";

export function HomeShell({ defaultCollapsed }: { defaultCollapsed: boolean }) {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [turn, setTurn] = useState(0);
  const [section, setSection] = useState<SectionKey>("world");
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultCollapsed);

  const toggleSidebar = () =>
    setSidebarCollapsed((v) => {
      const next = !v;
      document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    });

  return (
    <div className="flex h-screen flex-col">
      <SiteHeader
        running={running}
        turn={turn}
        onRun={() => setRunDialogOpen(true)}
        onPause={() => setRunning(false)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={section}
          onSelect={setSection}
          agentCount={SCALE_INFO[config.scale].agents}
          observerCount={config.observers.length}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />
        <main className="flex flex-1 overflow-hidden">
          <SimulationCanvas running={running} />
        </main>
      </div>

      <InitialConditionsDialog
        open={runDialogOpen}
        onOpenChange={setRunDialogOpen}
        config={config}
        onRun={(next) => {
          setConfig(next);
          setTurn(0);
          setRunning(true);
        }}
      />
    </div>
  );
}
