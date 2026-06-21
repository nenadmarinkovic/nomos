import type { SimulationConfig } from "@/lib/config";
import { Engine, type EngineSnapshot } from "@/lib/engine";
import { serializeWorld, type WorldFrame } from "@/lib/world";

/** Messages the main thread sends the worker. */
export type WorkerInbound =
  | { type: "init"; config: SimulationConfig; speed: number }
  | { type: "setSpeed"; speed: number }
  | { type: "resume" }
  | { type: "pause" }
  | { type: "stop" };

/** Messages the worker sends back. */
export interface FrameMessage {
  type: "frame";
  snapshot: EngineSnapshot;
  frame: WorldFrame;
}

const BASE_TICK_MS = 200;

type TimerId = ReturnType<typeof setTimeout>;
type Schedule = (cb: () => void, ms: number) => TimerId;
type Cancel = (id: TimerId) => void;

/**
 * The engine-side of the worker, free of any Worker globals so it can be
 * driven and tested directly. It owns the `Engine`, runs the tick loop on its
 * own schedule, and emits a serialized frame after each tick. The `schedule`
 * and `cancel` hooks default to `setTimeout`/`clearTimeout` but are injectable
 * for deterministic stepping in tests.
 */
export class SimWorkerCore {
  private engine: Engine | null = null;
  private running = false;
  private speed = 1;
  private timer: TimerId | null = null;

  constructor(
    private readonly emit: (msg: FrameMessage, transfer: ArrayBuffer[]) => void,
    private readonly schedule: Schedule = (cb, ms) => setTimeout(cb, ms),
    private readonly cancel: Cancel = (id) => clearTimeout(id),
  ) {}

  handle(msg: WorkerInbound): void {
    switch (msg.type) {
      case "init":
        this.stopLoop();
        this.engine = new Engine(msg.config);
        this.speed = msg.speed;
        this.running = false;
        this.postFrame();
        break;
      case "setSpeed":
        this.speed = msg.speed;
        break;
      case "resume":
        if (!this.running && this.engine) {
          this.running = true;
          // Tick once immediately so the simulation visibly advances the
          // moment Resume is clicked, instead of waiting up to BASE_TICK_MS
          // for the first scheduled tick. Then settle into the normal loop.
          this.engine.tick();
          this.postFrame();
          this.loop();
        }
        break;
      case "pause":
        this.running = false;
        this.stopLoop();
        break;
      case "stop":
        this.running = false;
        this.stopLoop();
        this.engine = null;
        break;
    }
  }

  private loop(): void {
    if (!this.running || !this.engine) return;
    const interval = BASE_TICK_MS / this.speed;
    this.timer = this.schedule(() => {
      if (!this.running || !this.engine) return;
      this.engine.tick();
      this.postFrame();
      this.loop();
    }, interval);
  }

  private stopLoop(): void {
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }
  }

  private postFrame(): void {
    if (!this.engine) return;
    const { frame, transfer } = serializeWorld(this.engine);
    this.emit({ type: "frame", snapshot: this.engine.getSnapshot(), frame }, transfer);
  }
}
