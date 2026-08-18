import type { SimulationConfig } from "@/lib/config";
import { Engine, type EngineSnapshot } from "@/lib/engine";
import { serializeWorld, type WorldFrame } from "@/lib/world";

export type WorkerInbound =
  | { type: "init"; config: SimulationConfig; speed: number }
  | { type: "setSpeed"; speed: number }
  | { type: "resume" }
  | { type: "pause" }
  | { type: "stop" };

export interface FrameMessage {
  type: "frame";
  snapshot: EngineSnapshot;
  frame: WorldFrame;
}

const BASE_TICK_MS = 450;

type TimerId = ReturnType<typeof setTimeout>;
type Schedule = (cb: () => void, ms: number) => TimerId;
type Cancel = (id: TimerId) => void;

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
      if (this.engine.getSnapshot().alive === 0) {
        this.running = false;
        this.stopLoop();
        return;
      }
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
    this.emit(
      { type: "frame", snapshot: this.engine.getSnapshot(), frame },
      transfer,
    );
  }
}
