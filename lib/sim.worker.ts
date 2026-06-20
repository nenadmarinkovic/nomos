import { SimWorkerCore, type WorkerInbound } from "@/lib/sim-worker-core";

// Minimal Worker glue: wire the testable core to the worker's message ports.
// `self` is typed loosely here to avoid pulling in the WebWorker lib globally.
const ctx = self as unknown as {
  postMessage: (msg: unknown, transfer: Transferable[]) => void;
  onmessage: ((e: MessageEvent) => void) | null;
};

const core = new SimWorkerCore((msg, transfer) => ctx.postMessage(msg, transfer));

ctx.onmessage = (e: MessageEvent) => core.handle(e.data as WorkerInbound);
