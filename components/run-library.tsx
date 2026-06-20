"use client";

import { useCallback, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  CircleNotchIcon,
  FloppyDiskIcon,
  LinkIcon,
  PlayIcon,
  TrashIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SCALE_INFO } from "@/lib/config";
import {
  deleteRun,
  getRun,
  listRuns,
  saveRun,
  type RunSummary,
} from "@/lib/runs-api";
import { useSimulationStore } from "@/lib/store";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function RunLibrary() {
  const started = useSimulationStore((s) => s.started);
  const scale = useSimulationStore((s) => s.config.world.scale);
  const replayRun = useSimulationStore((s) => s.replayRun);

  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRuns(await listRuns());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load runs");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(`${SCALE_INFO[scale].label} run`);
      void refresh();
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      // Read the freshest state at click time, not at render time.
      const s = useSimulationStore.getState();
      const summary = await saveRun({
        name: trimmed,
        config: s.config,
        turn: s.turn,
        alive: s.snapshot.alive,
        gini: s.snapshot.gini,
        totalWealth: s.snapshot.totalWealth,
        history: s.history,
        chronicle: s.chronicle,
      });
      setRuns((prev) => [summary, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save run");
    } finally {
      setSaving(false);
    }
  }

  async function handleReplay(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const detail = await getRun(id);
      replayRun(detail.config);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load run");
      setBusyId(null);
    }
  }

  async function handleShare(id: string) {
    const url = `${window.location.origin}/?run=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(
        () => setCopiedId((c) => (c === id ? null : c)),
        1500,
      );
    } catch {
      setError("Could not copy the link to your clipboard");
    }
  }

  async function handleDelete(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteRun(id);
      setRuns((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete run");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              aria-label="Run library"
              className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <ArchiveIcon size={18} weight="regular" />
            </DialogTrigger>
          }
        />
        <TooltipContent side="bottom" sideOffset={6}>
          Run library
        </TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run library</DialogTitle>
          <DialogDescription>
            Save the current run and replay any saved one. Runs are
            deterministic, so a replay unfolds exactly as it first did.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="run-name"
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70"
              >
                Save current run
              </label>
              <input
                id="run-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSave();
                }}
                placeholder="Name this run"
                disabled={!started || saving}
                className="h-8 w-full rounded-md border border-foreground/10 bg-card px-2.5 font-sans text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-foreground/25 disabled:opacity-50"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!started || saving || !name.trim()}
            >
              {saving ? (
                <CircleNotchIcon className="animate-spin" />
              ) : (
                <FloppyDiskIcon weight="fill" />
              )}
              Save
            </Button>
          </div>
          {!started && (
            <p className="text-xs text-muted-foreground">
              Start a run from the setup screen to save it.
            </p>
          )}

          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
              Saved runs
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <CircleNotchIcon className="animate-spin" />
                Loading…
              </div>
            ) : runs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No saved runs yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {runs.map((run) => (
                  <li
                    key={run.id}
                    className="flex items-center gap-3 rounded-lg border border-foreground/10 bg-card/60 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">
                        {run.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                        <span>{timeAgo(run.createdAt)}</span>
                        <span>turn {run.turn.toLocaleString()}</span>
                        <span>Gini {run.gini.toFixed(2)}</span>
                        <span>{run.alive.toLocaleString()} alive</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReplay(run.id)}
                      disabled={busyId !== null}
                    >
                      {busyId === run.id ? (
                        <CircleNotchIcon className="animate-spin" />
                      ) : (
                        <PlayIcon weight="fill" />
                      )}
                      Replay
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Copy link to ${run.name}`}
                      onClick={() => handleShare(run.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedId === run.id ? (
                        <CheckIcon className="text-emerald-500" />
                      ) : (
                        <LinkIcon />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${run.name}`}
                      onClick={() => handleDelete(run.id)}
                      disabled={busyId !== null}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <TrashIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
