// src/domain/omnis/skills.ts
import { OBJECTIVES, xpFromCompleted, type ObjectiveId } from "../objectives";
import type { UniverseId } from "./universes";

/*
 * RESONANCE (the player-facing name for XP) has exactly one source: completed objectives.
 * Skills SPEND it. Available = earned − Σ cost(owned). Nothing can add Resonance directly,
 * so it can't drift from what the player actually did.
 *
 * A skill node opens only when BOTH hold:
 *   gate      — a specific objective is complete (you've *done* the thing), and
 *   cost      — you have enough unspent Resonance.
 * Sealed nodes belong to universes that aren't built yet; they render but never open.
 */

export const SKILL_IDS = ["logic-1", "logic-2", "ethics-1", "ethics-2", "stealth-1", "creativity-1"] as const;
export type SkillId = (typeof SKILL_IDS)[number];
export type SkillPath = "logic" | "ethics" | "stealth" | "creativity";

export const ACCESSORY_IDS = ["lattice-visor", "orbit-rings", "halo", "cosmic-aura", "shadow-hood", "prism-crown"] as const;
export type AccessoryId = (typeof ACCESSORY_IDS)[number];

export interface SkillDef {
  id: SkillId;
  path: SkillPath;
  tier: 1 | 2;
  name: string;
  cost: number;
  /** Objective that must be complete. null = sealed (universe not built yet). */
  gate: ObjectiveId | null;
  /** Earlier node in the same path that must be owned first. */
  requires: SkillId | null;
  universe: UniverseId;
  accessory: AccessoryId;
  accessoryName: string;
}

export const SKILLS: Readonly<Record<SkillId, SkillDef>> = {
  "logic-1": {
    id: "logic-1", path: "logic", tier: 1, name: "Logic", cost: 100,
    gate: "valley.first-descent", requires: null, universe: "ai",
    accessory: "lattice-visor", accessoryName: "Lattice visor",
  },
  "logic-2": {
    id: "logic-2", path: "logic", tier: 2, name: "Deep logic", cost: 200,
    gate: "forge.fit", requires: "logic-1", universe: "ai",
    accessory: "orbit-rings", accessoryName: "Orbit rings",
  },
  "ethics-1": {
    id: "ethics-1", path: "ethics", tier: 1, name: "Ethics", cost: 100,
    gate: "curiosity.shortcut", requires: null, universe: "ai",
    accessory: "halo", accessoryName: "Fair halo",
  },
  "ethics-2": {
    id: "ethics-2", path: "ethics", tier: 2, name: "Deep ethics", cost: 200,
    gate: "archive.rebalance", requires: "ethics-1", universe: "ai",
    accessory: "cosmic-aura", accessoryName: "Cosmic aura",
  },
  "stealth-1": {
    id: "stealth-1", path: "stealth", tier: 1, name: "Stealth", cost: 150,
    gate: null, requires: null, universe: "cybersec",
    accessory: "shadow-hood", accessoryName: "Shadow hood",
  },
  "creativity-1": {
    id: "creativity-1", path: "creativity", tier: 1, name: "Creativity", cost: 150,
    gate: null, requires: null, universe: "creative",
    accessory: "prism-crown", accessoryName: "Prism crown",
  },
};

export type Owned = Partial<Record<SkillId, true>>;
type Completed = Partial<Record<ObjectiveId, true>>;

export function resonance(completed: Completed, owned: Owned) {
  const earned = xpFromCompleted(completed);
  let spent = 0;
  for (const id of SKILL_IDS) if (owned[id]) spent += SKILLS[id].cost;
  return { earned, spent, available: earned - spent };
}

export type SkillState =
  | { kind: "owned" }
  | { kind: "ready" }
  | { kind: "short"; need: number }
  | { kind: "gated"; reason: string }
  | { kind: "sealed"; reason: string };

export function skillState(id: SkillId, completed: Completed, owned: Owned): SkillState {
  const s = SKILLS[id];
  if (owned[id]) return { kind: "owned" };
  if (s.gate === null) return { kind: "sealed", reason: "Its universe isn't open yet" };
  if (s.requires && !owned[s.requires]) return { kind: "gated", reason: `Needs ${SKILLS[s.requires].name} first` };
  if (!completed[s.gate]) return { kind: "gated", reason: `Opens after: ${OBJECTIVES[s.gate].label.toLowerCase()}` };
  const { available } = resonance(completed, owned);
  if (available < s.cost) return { kind: "short", need: s.cost - available };
  return { kind: "ready" };
}

export function accessoriesOwned(owned: Owned): AccessoryId[] {
  return SKILL_IDS.filter((id) => owned[id]).map((id) => SKILLS[id].accessory);
}

export function isSkillId(v: unknown): v is SkillId {
  return typeof v === "string" && (SKILL_IDS as readonly string[]).includes(v);
}
export function isAccessoryId(v: unknown): v is AccessoryId {
  return typeof v === "string" && (ACCESSORY_IDS as readonly string[]).includes(v);
}
