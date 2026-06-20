"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ChroniclePanel } from "@/components/chronicle-panel";
import { FloatingWindows } from "@/components/floating-windows";
import { ObserverNarrator } from "@/components/observer-narrator";
import { Sidebar, type SectionKey } from "@/components/sidebar";
import { SimulationCanvas } from "@/components/simulation-canvas";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SCALE_INFO } from "@/lib/config";
import { getRun } from "@/lib/runs-api";
import { useSimulationStore } from "@/lib/store";

const SIDEBAR_COOKIE = "sidebar-collapsed";

export function HomeShell({
  defaultCollapsed,
  sharedRunId,
}: {
  defaultCollapsed: boolean;
  sharedRunId?: string;
}) {
  const config = useSimulationStore((s) => s.config);
  const running = useSimulationStore((s) => s.running);
  const started = useSimulationStore((s) => s.started);
  const turn = useSimulationStore((s) => s.turn);
  const snapshot = useSimulationStore((s) => s.snapshot);
  const pauseRun = useSimulationStore((s) => s.pauseRun);
  const resumeRun = useSimulationStore((s) => s.resumeRun);
  const stopRun = useSimulationStore((s) => s.stopRun);
  const replayRun = useSimulationStore((s) => s.replayRun);

  const router = useRouter();
  const sharedHandled = useRef(false);

  // A shared link (`/?run=<id>`) loads that run and replays it, then strips
  // the param so a reload doesn't restart it. Deterministic replay means the
  // visitor sees exactly the run that was shared. A bad or deleted id just
  // falls through to the normal home screen.
  useEffect(() => {
    if (!sharedRunId || sharedHandled.current) return;
    sharedHandled.current = true;
    let cancelled = false;
    getRun(sharedRunId)
      .then((detail) => {
        if (!cancelled) replayRun(detail.config);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) router.replace("/");
      });
    return () => {
      cancelled = true;
    };
  }, [sharedRunId, replayRun, router]);

  const paused = started && !running;

  const [section, setSection] = useState<SectionKey>("world");
  const showChronicle = section === "observers" || section === "log";
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
        paused={paused}
        sidebarCollapsed={sidebarCollapsed}
        activeSection={section}
        onToggleSidebar={toggleSidebar}
        onPause={pauseRun}
        onResume={resumeRun}
        onStop={stopRun}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={section}
          onSelect={setSection}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="relative flex flex-1 overflow-hidden">
                <SimulationCanvas running={running} />
                <FloatingWindows />
              </div>
            </div>
            {showChronicle && <ChroniclePanel />}
          </div>
          <SiteFooter
            turn={turn}
            agentCount={SCALE_INFO[config.world.scale].agents}
            aliveCount={snapshot.alive}
            gini={snapshot.gini}
            observerCount={config.observers.length}
            started={started}
          />
        </main>
      </div>

      <ObserverNarrator />
    </div>
  );
}
