import { describe, it, expect } from "vitest";
import { parseToWorker, parseFromWorker, GRID } from "@/domain/nn/protocol";

describe("parseToWorker", () => {
  it("accepts valid messages", () => {
    expect(parseToWorker({ type: "init", seed: 5, lr: 0.1 })).toEqual({ type: "init", seed: 5, lr: 0.1 });
    expect(parseToWorker({ type: "run", running: true })).toEqual({ type: "run", running: true });
    expect(parseToWorker({ type: "step" })).toEqual({ type: "step" });
    expect(parseToWorker({ type: "lr", lr: 0.01 })).toEqual({ type: "lr", lr: 0.01 });
    expect(parseToWorker({ type: "reset", seed: 9 })).toEqual({ type: "reset", seed: 9 });
  });

  it("clamps lr", () => {
    expect(parseToWorker({ type: "lr", lr: 50 })).toEqual({ type: "lr", lr: 1 });
    expect(parseToWorker({ type: "lr", lr: -3 })).toEqual({ type: "lr", lr: 1e-4 });
    expect(parseToWorker({ type: "init", seed: 1, lr: 50 })).toMatchObject({ lr: 1 });
  });

  it("rejects malformed input", () => {
    const bad: unknown[] = [
      null,
      undefined,
      "init",
      5,
      [],
      [{ type: "step" }],
      {},
      { type: "nope" },
      { type: "lr", lr: NaN },
      { type: "lr", lr: Infinity },
      { type: "lr", lr: "0.1" },
      { type: "init", seed: NaN, lr: 0.1 },
      { type: "init", seed: 1, lr: null },
      { type: "reset", seed: "1" },
      { type: "reset", seed: Infinity },
      { type: "run", running: "yes" },
    ];
    for (const b of bad) expect(parseToWorker(b)).toBeNull();
  });

  it("coerces seed to unsigned 32-bit integer", () => {
    expect(parseToWorker({ type: "reset", seed: -1 })).toEqual({ type: "reset", seed: 4294967295 });
    expect(parseToWorker({ type: "reset", seed: 3.9 })).toEqual({ type: "reset", seed: 3 });
    expect(parseToWorker({ type: "reset", seed: 2 ** 32 + 7 })).toEqual({ type: "reset", seed: 7 });
  });
});

const snapshot = (): Record<string, unknown> => ({
  type: "snapshot",
  step: 10,
  loss: 0.5,
  accuracy: 0.8,
  W: [new Float32Array(16), new Float32Array(64), new Float32Array(8)],
  gW: [new Float32Array(16), new Float32Array(64), new Float32Array(8)],
  deltaMag: [0.1, 0.2, 0.3],
  grid: new Float32Array(GRID * GRID),
  manual: false,
});

describe("parseFromWorker", () => {
  it("accepts a valid snapshot", () => {
    expect(parseFromWorker(snapshot())).not.toBeNull();
  });

  it("rejects invalid snapshots", () => {
    const mutate = (f: (s: Record<string, unknown>) => void) => {
      const s = snapshot();
      f(s);
      return parseFromWorker(s);
    };
    expect(mutate((s) => (s.W = [new Float32Array(15), new Float32Array(64), new Float32Array(8)]))).toBeNull();
    expect(mutate((s) => (s.W = [Array(16).fill(0), Array(64).fill(0), Array(8).fill(0)]))).toBeNull();
    expect(mutate((s) => (s.gW = [new Float32Array(16), new Float32Array(64)]))).toBeNull();
    expect(mutate((s) => (s.loss = NaN))).toBeNull();
    expect(mutate((s) => (s.grid = new Float32Array(GRID * GRID - 1)))).toBeNull();
    expect(mutate((s) => delete s.manual)).toBeNull();
    expect(mutate((s) => (s.type = "other"))).toBeNull();
    expect(mutate((s) => (s.deltaMag = [0.1, 0.2]))).toBeNull();
    expect(parseFromWorker(null)).toBeNull();
  });

  it("validates dataset messages", () => {
    expect(parseFromWorker({ type: "dataset", X: [[0, 1], [2, 3]], Y: [0, 1] })).not.toBeNull();
    expect(parseFromWorker({ type: "dataset", X: [[0, 1]], Y: [2] })).toBeNull();
    expect(parseFromWorker({ type: "dataset", X: [[0, 1, 2]], Y: [1] })).toBeNull();
    expect(parseFromWorker({ type: "dataset", X: [[0, 1], [1, 1]], Y: [1] })).toBeNull();
  });
});
