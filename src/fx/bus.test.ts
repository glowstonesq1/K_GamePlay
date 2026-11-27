import { describe, it, expect } from "vitest";
import { fx, type FxEvent } from "@/fx/bus";

describe("fx bus", () => {
  it("delivers emitted events", () => {
    const got: FxEvent[] = [];
    const off = fx.on((e) => got.push(e));
    fx.emit({ kind: "reward" });
    fx.emit({ kind: "rise", at: [1, 2, 3], color: "#fff" });
    off();
    expect(got).toEqual([{ kind: "reward" }, { kind: "rise", at: [1, 2, 3], color: "#fff" }]);
  });

  it("stops delivery after unsubscribe", () => {
    let n = 0;
    const off = fx.on(() => n++);
    fx.emit({ kind: "reward" });
    off();
    fx.emit({ kind: "reward" });
    expect(n).toBe(1);
  });

  it("notifies all listeners", () => {
    let a = 0;
    let b = 0;
    const offA = fx.on(() => a++);
    const offB = fx.on(() => b++);
    fx.emit({ kind: "shock", at: [0, 0, 0], color: "red" });
    offA();
    offB();
    expect([a, b]).toEqual([1, 1]);
  });
});
