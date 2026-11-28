// src/state/gameStore.test.ts
import { describe, expect, it } from "vitest";
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { createGameStore, sanitizePersisted, selectPlayerXP } from "./gameStore";
import { fromSlider, toSlider } from "@/domain/hyperparams";
import { levelFromXp, xpForLevel } from "@/domain/progression";

function memoryStorage(seed: Record<string, string> = {}): StateStorage {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const fresh = (seed?: Record<string, string>) =>
  createGameStore(createJSONStorage(() => memoryStorage(seed)));

describe("progression", () => {
  it("awards XP once per objective and derives playerXP", () => {
    const s = fresh();
    expect(s.getState().completeObjective("hub.boot")).toBe(25);
    expect(s.getState().completeObjective("hub.boot")).toBe(0);
    expect(selectPlayerXP(s.getState())).toBe(25);
  });

  it("gates travel on unlocks", () => {
    const s = fresh();
    expect(s.getState().travelTo("loss-valley")).toBe(false);
    s.getState().completeObjective("hub.boot");
    expect(s.getState().travelTo("loss-valley")).toBe(true);
    expect(s.getState().currentZone).toBe("loss-valley");
    expect(s.getState().travelTo("skew-archive")).toBe(false);
  });

  it("level curve is monotonic and consistent", () => {
    for (let l = 0; l < 20; l++) {
      expect(levelFromXp(xpForLevel(l))).toBe(l);
      expect(levelFromXp(xpForLevel(l + 1) - 1)).toBe(l);
    }
  });
});

describe("hyperparams", () => {
  it("clamps and rejects non-finite input", () => {
    const s = fresh();
    s.getState().setHyperparam("temperature", 0); // T = 0 would divide by zero in softmax
    expect(s.getState().temperature).toBe(0.1);
    s.getState().setHyperparam("learningRate", Number.NaN);
    expect(s.getState().learningRate).toBe(0.05);
    s.getState().setHyperparam("sampleSkew", 7);
    expect(s.getState().sampleSkew).toBe(1);
  });

  it("log slider centres T on 1.0 and round-trips", () => {
    expect(fromSlider("temperature", 0.5)).toBeCloseTo(1, 10);
    for (const v of [0.01, 0.03, 0.05, 1]) {
      expect(fromSlider("learningRate", toSlider("learningRate", v))).toBeCloseTo(v, 10);
    }
  });
});

describe("persistence is untrusted", () => {
  it("drops forged objectives, unearned zones, and out-of-range values", async () => {
    const forged = JSON.stringify({
      version: 1,
      state: {
        completed: { "hub.boot": true, "fake.obj": true, "__proto__": true, "forge.chain-rule": "yes" },
        currentZone: "skew-archive",
        learningRate: 1e9,
        temperature: -3,
        sampleSkew: "lots",
        xp: 999999,
      },
    });
    const s = fresh({ "cogniterra:v1": forged });
    await s.persist.rehydrate();
    const st = s.getState();
    expect(st.hydrated).toBe(true);
    expect(Object.keys(st.completed)).toEqual(["hub.boot"]);
    expect(selectPlayerXP(st)).toBe(25);
    expect(st.currentZone).toBe("hub");
    expect(st.learningRate).toBe(1);
    expect(st.temperature).toBe(0.1);
    expect(st.sampleSkew).toBe(0);
    expect("xp" in st).toBe(false);
  });

  it("marks hydrated even when the save is corrupt JSON", async () => {
    const s = fresh({ "cogniterra:v1": "{not json" });
    await s.persist.rehydrate();
    expect(s.getState().hydrated).toBe(true);
    expect(s.getState().currentZone).toBe("hub");
  });

  it("sanitize handles garbage", () => {
    for (const g of [null, 42, "x", [], { completed: null }]) {
      expect(sanitizePersisted(g).currentZone).toBe("hub");
    }
  });
});
