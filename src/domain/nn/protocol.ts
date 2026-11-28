// src/domain/nn/protocol.ts
//
// Message contract between the main thread and the trainer worker.
//
// SECURITY: postMessage is an input boundary. Both sides validate every message shape and
// clamp every number before use; unknown or malformed messages are dropped, never thrown
// on. Workers are same-origin here, but validating keeps a bad message from wedging the
// training loop and keeps the contract honest if the worker is ever reused.

export const NET_SIZES = [2, 8, 8, 1] as const;
export const GRID = 40;
export const LR_RANGE = [1e-4, 1] as const;

export type ToWorker =
  | { type: "init"; seed: number; lr: number }
  | { type: "run"; running: boolean }
  | { type: "step" }
  | { type: "lr"; lr: number }
  | { type: "reset"; seed: number };

export interface Snapshot {
  type: "snapshot";
  step: number;
  loss: number;
  accuracy: number;
  /** Flattened weights per layer (Float32 for transfer). */
  W: Float32Array[];
  /** Flattened |∂L/∂W| per layer, from the latest step. */
  gW: Float32Array[];
  /** Mean |δ| per layer (index 0 = first weight layer). Shows blame reaching each layer. */
  deltaMag: number[];
  /** GRID×GRID predicted probabilities over the input square [-1.6, 1.6]². */
  grid: Float32Array;
  /** True if this snapshot came from a single manual "step" (play the backward pulse). */
  manual: boolean;
}

export interface DatasetMsg {
  type: "dataset";
  X: number[][];
  Y: number[];
}

export type FromWorker = Snapshot | DatasetMsg;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function parseToWorker(raw: unknown): ToWorker | null {
  if (raw === null || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  switch (m.type) {
    case "init":
      if (!finite(m.seed) || !finite(m.lr)) return null;
      return { type: "init", seed: Math.trunc(m.seed) >>> 0, lr: clamp(m.lr, ...LR_RANGE) };
    case "run":
      return typeof m.running === "boolean" ? { type: "run", running: m.running } : null;
    case "step":
      return { type: "step" };
    case "lr":
      return finite(m.lr) ? { type: "lr", lr: clamp(m.lr, ...LR_RANGE) } : null;
    case "reset":
      return finite(m.seed) ? { type: "reset", seed: Math.trunc(m.seed) >>> 0 } : null;
    default:
      return null;
  }
}

const layerCount = NET_SIZES.length - 1;
const weightLen = (l: number) => NET_SIZES[l]! * NET_SIZES[l + 1]!;

export function parseFromWorker(raw: unknown): FromWorker | null {
  if (raw === null || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.type === "dataset") {
    if (!Array.isArray(m.X) || !Array.isArray(m.Y) || m.X.length !== m.Y.length || m.X.length > 2000) return null;
    const okX = m.X.every((p) => Array.isArray(p) && p.length === 2 && p.every(finite));
    const okY = m.Y.every((y) => y === 0 || y === 1);
    return okX && okY ? { type: "dataset", X: m.X as number[][], Y: m.Y as number[] } : null;
  }
  if (m.type !== "snapshot") return null;
  if (!finite(m.step) || !finite(m.loss) || !finite(m.accuracy) || typeof m.manual !== "boolean") return null;
  const arrOk = (a: unknown) =>
    Array.isArray(a) && a.length === layerCount && a.every((w, l) => w instanceof Float32Array && w.length === weightLen(l));
  if (!arrOk(m.W) || !arrOk(m.gW)) return null;
  if (!Array.isArray(m.deltaMag) || m.deltaMag.length !== layerCount || !m.deltaMag.every(finite)) return null;
  if (!(m.grid instanceof Float32Array) || m.grid.length !== GRID * GRID) return null;
  return m as unknown as Snapshot;
}
