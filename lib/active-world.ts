import type { WorldView } from "@/lib/world";

export const activeWorldRef: { current: WorldView | null } = { current: null };

export const activeFrameAtRef: { current: number } = { current: 0 };

export const activeIntervalRef: { current: number } = { current: 200 };
