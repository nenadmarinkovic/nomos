"use client";

import { useState } from "react";

import {
  InitialConditionsDialog,
  STEPS,
} from "@/components/initial-conditions-dialog";
import { Sidebar, type SectionKey } from "@/components/sidebar";
import { SimulationCanvas } from "@/components/simulation-canvas";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Stepper } from "@/components/stepper";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import { DEFAULT_CONFIG, SCALE_INFO, SimulationConfig } from "@/lib/config";

const SIDEBAR_COOKIE = "sidebar-collapsed";

export function HomeShell({ defaultCollapsed }: { defaultCollapsed: boolean }) {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [turn, setTurn] = useState(0);
  const [section, setSection] = useState<SectionKey>("world");
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultCollapsed);
  const [dialogStep, setDialogStep] = useState(0);
  const [dialogMaxReached, setDialogMaxReached] = useState(0);

  const toggleSidebar = () =>
    setSidebarCollapsed((v) => {
      const next = !v;
      document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    });

  const openRunDialog = () => {
    setDialogStep(0);
    setDialogMaxReached(0);
    setRunDialogOpen(true);
  };

  return (
    <div className="flex h-screen flex-col">
      <SiteHeader
        running={running}
        sidebarCollapsed={sidebarCollapsed}
        activeSection={section}
        onToggleSidebar={toggleSidebar}
        onRun={openRunDialog}
        onPause={() => setRunning(false)}
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
            <SimulationCanvas running={running} />
          </div>
          <SiteFooter
            turn={turn}
            agentCount={SCALE_INFO[config.scale].agents}
            observerCount={config.observers.length}
          />
        </main>
      </div>

      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogPortal>
          <div
            data-stepper-portal
            className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center sm:top-6"
          >
            <div className="pointer-events-auto w-[min(96vw,40rem)] rounded-2xl border border-foreground/10 bg-card/95 shadow-xl backdrop-blur-md">
              <Stepper
                steps={STEPS}
                step={dialogStep}
                maxReached={dialogMaxReached}
                onSelect={(i) => {
                  if (i <= dialogMaxReached) setDialogStep(i);
                }}
              />
            </div>
          </div>
        </DialogPortal>
        <InitialConditionsDialog
          open={runDialogOpen}
          onClose={() => setRunDialogOpen(false)}
          config={config}
          onRun={(next) => {
            setConfig(next);
            setTurn(0);
            setRunning(true);
          }}
          step={dialogStep}
          maxReached={dialogMaxReached}
          onStepChange={setDialogStep}
          onMaxReachedChange={setDialogMaxReached}
        />
      </Dialog>
    </div>
  );
}
