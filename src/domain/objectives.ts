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
    label: "Step onto the grid",
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
  "forge.chain-rule": {
    zone: "backprop-forge",
    xp: 150,
    label: "Route the error back to the first layer",
  },
  "dunes.temperature-sweep": {
    zone: "token-dunes",
    xp: 120,
    label: "Sample the same prompt cold and hot",
  },
  "archive.skew-detected": {
    zone: "skew-archive",
    xp: 200,
    label: "Find the region the model never learned",
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
