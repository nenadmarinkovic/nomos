"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MiniSimWindow } from "@/components/mini-sim-window";
import { ObserverNarrator } from "@/components/observer-narrator";
import { Sidebar, sectionFromPath } from "@/components/sidebar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SCALE_INFO } from "@/lib/config";
import { getRun } from "@/lib/runs-api";
import { useSimulationStore } from "@/lib/store";

const SIDEBAR_COOKIE = "sidebar-collapsed";

export function AppShell({
  defaultCollapsed,
  children,
}: {
  defaultCollapsed: boolean;
  children: React.ReactNode;
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
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const sharedRunId = searchParams?.get("run") ?? undefined;
  const sharedHandled = useRef(false);

  // A shared link (`/?run=<id>`) loads that run and replays it, then strips
  // the param so a reload doesn't restart it.
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
  const section = sectionFromPath(pathname);
  const isField = section === "world";

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
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <main className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">{children}</div>
          <SiteFooter
            turn={turn}
            agentCount={SCALE_INFO[config.world.scale].agents}
            aliveCount={snapshot.alive}
            gini={snapshot.gini}
            observerCount={config.observers.length}
            started={started}
          />
          {!isField && <MiniSimWindow />}
        </main>
      </div>

      <ObserverNarrator />
    </div>
  );
}
