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

describe("OMNIS layer", () => {
  it("loads a v1 save with OMNIS defaults", () => {
    const st = sanitizePersisted({ completed: { "hub.boot": true }, currentZone: "hub" });
    expect(st.universe).toBe("hub");
    expect(st.avatarId).toBeNull();
    expect(st.owned).toEqual({});
    expect(st.echo).toBe("architect");
  });
  it("drops skills a save can't afford or hasn't earned, and gear it doesn't own", () => {
    const st = sanitizePersisted({
      completed: { "hub.boot": true, "valley.first-descent": true },
      owned: { "logic-1": true, "logic-2": true, "ethics-1": true, "stealth-1": true },
      equipped: ["lattice-visor", "halo", "nonsense"],
      universe: "cybersec",
      avatarId: "mallory",
    });
    expect(st.owned).toEqual({ "logic-1": true });
    expect(st.equipped).toEqual(["lattice-visor"]);
    expect(st.universe).toBe("hub");
    expect(st.avatarId).toBeNull();
  });
  it("unlocks only ready skills, spends resonance, and auto-equips the reward", () => {
    const s = fresh();
    expect(s.getState().unlockSkill("logic-1")).toBe(false);
    s.getState().completeObjective("valley.first-descent");
    expect(s.getState().unlockSkill("logic-1")).toBe(true);
    expect(s.getState().unlockSkill("logic-1")).toBe(false);
    expect(s.getState().equipped).toEqual(["lattice-visor"]);
    s.getState().toggleAccessory("lattice-visor");
    expect(s.getState().equipped).toEqual([]);
    s.getState().toggleAccessory("halo");
    expect(s.getState().equipped).toEqual([]);
  });
  it("refuses sealed universes", () => {
    const s = fresh();
    expect(s.getState().enterUniverse("cybersec")).toBe(false);
    expect(s.getState().enterUniverse("ai")).toBe(true);
    expect(s.getState().universe).toBe("ai");
  });
});
