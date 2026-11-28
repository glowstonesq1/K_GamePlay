// src/domain/objectives.ts
import type { ZoneId } from "./zones";

/**
 * XP is never granted as a free-floating number. It comes only from completing a
 * registered objective, once. Player XP is therefore *derived* from the set of
 * completed objectives — it can't drift, double-count, or be set to 9_999_999
 * by an arbitrary caller.
 */
export const OBJECTIVES = {
  "hub.boot": {
    zone: "hub",
    xp: 25,
    label: "Open the observatory",
  },
  "valley.first-descent": {
    zone: "loss-valley",
    xp: 100,
    // PEDAGOGY: "a minimum", not "the minimum". GD guarantees neither global nor unique.
    label: "Settle into a minimum",
  },
  "valley.diverge": {
    zone: "loss-valley",
    xp: 50,
    // PEDAGOGY: Breaking the run on purpose is how you learn where η stops working.
    // Fires when a step makes the loss go UP, which small-η GD never does.
    label: "Push η until a step makes the loss go up",
  },
  "valley.bullseye": {
    zone: "loss-valley",
    xp: 75,
    // PEDAGOGY: graded by where the run ends, not by trying hard. Only a start inside the
    // global basin plus a stable η lands here; the descent itself never looks ahead.
    label: "Settle on the true floor, not just a floor",
  },
  "valley.local-trap": {
    zone: "loss-valley",
    xp: 75,
    // PEDAGOGY: the gap between "a minimum" and "the minimum" is the lesson of the zone.
    label: "Settle in a shallower basin, then reveal the Oracle's route",
  },
  "forge.chain-rule": {
    zone: "backprop-forge",
    xp: 150,
    // PEDAGOGY: one manual step, watched: forward pass, loss, blame flowing backwards.
    label: "Take one step by hand and watch the blame flow back",
  },
  "forge.fit": {
    zone: "backprop-forge",
    xp: 150,
    label: "Train until the network separates both moons",
  },
  "dunes.temperature-sweep": {
    zone: "token-dunes",
    xp: 120,
    label: "Sample the same prompt cold and hot",
  },
  "archive.skew-detected": {
    zone: "skew-archive",
    xp: 200,
    label: "Skew the sample, then walk into the region the model got wrong",
  },
  "archive.rebalance": {
    zone: "skew-archive",
    xp: 150,
    // PEDAGOGY: the fix is in the data, not in the people. Rebalance and the gap closes.
    label: "Rebalance the sample until the gap closes",
  },
} as const satisfies Record<string, { zone: ZoneId; xp: number; label: string }>;

export type ObjectiveId = keyof typeof OBJECTIVES;

export function isObjectiveId(v: unknown): v is ObjectiveId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(OBJECTIVES, v);
}

export function xpFromCompleted(completed: Partial<Record<ObjectiveId, true>>): number {
  let total = 0;
  for (const id of Object.keys(completed)) {
    if (isObjectiveId(id) && completed[id] === true) total += OBJECTIVES[id].xp;
  }
  return total;
}
