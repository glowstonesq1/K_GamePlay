// src/domain/zones.ts
import type { ObjectiveId } from "./objectives";
import type { Hyperparam } from "./hyperparams";

export const ZONE_IDS = [
  "hub",
  "loss-valley",
  "backprop-forge",
  "token-dunes",
  "skew-archive",
] as const;

export type ZoneId = (typeof ZONE_IDS)[number];

export interface ZoneDef {
  id: ZoneId;
  code: string;
  name: string;
  /** The real concept this zone teaches. Shown in the HUD; keep it accurate. */
  concept: string;
  /** One line of player-facing copy. */
  brief: string;
  /** Which dials the HUD exposes here. Anything else is hidden, not disabled. */
  controls: readonly Hyperparam[];
  /** Objective that opens this zone. null = open from the start. */
  unlockedBy: ObjectiveId | null;
}

export const ZONES: Readonly<Record<ZoneId, ZoneDef>> = {
  hub: {
    id: "hub",
    code: "Z0",
    name: "The Observatory",
    concept: "Four worlds, one sky",
    brief: "Each light up there is a way machines learn. Pick one and fall in.",
    controls: [],
    unlockedBy: null,
  },
  "loss-valley": {
    id: "loss-valley",
    code: "Z1",
    name: "The Loss Valley",
    // PEDAGOGY: Height = L(θ). The player's ball only knows the local slope, so
    // it follows −∇L. It does not know where the global minimum is (Module 3 Oracle
    // path is revealed only after the run).
    concept: "Gradient descent",
    brief: "You can only feel the slope under your feet. Trust it, or don't.",
    controls: ["learningRate"],
    unlockedBy: "hub.boot",
  },
  "backprop-forge": {
    id: "backprop-forge",
    code: "Z2",
    name: "The Neural Core",
    // PEDAGOGY: Error at the output flows backward; each edge's share is
    // the product of local derivatives along the path (chain rule).
    concept: "Backpropagation",
    brief: "Blame travels backward. Every wire gets its share.",
    controls: ["learningRate"],
    unlockedBy: "valley.first-descent",
  },
  "token-dunes": {
    id: "token-dunes",
    code: "Z3",
    name: "The Token Forest",
    // PEDAGOGY: Tree height = softmax(logits / T). Low T grows one giant, high T levels
    // the grove. The forest literally is the sampling distribution; seeds are draws.
    concept: "Next-token sampling",
    brief: "Every tree is a word the model might say next. Height is how likely. Temperature reshapes the forest.",
    controls: ["temperature"],
    // Opens alongside Z2 rather than after it: Z2's content lands in Module 6, and a
    // hard chain would wall off Z3 and Z4 until then.
    unlockedBy: "valley.first-descent",
  },
  "skew-archive": {
    id: "skew-archive",
    code: "Z4",
    name: "The Mirror Realm",
    // PEDAGOGY: Bias lives in the data, not the body. sampleSkew controls how
    // unrepresentative the training sample is; the avatar's *perception* of the
    // world degrades for under-sampled regions. The avatar itself moves normally.
    concept: "Dataset bias",
    brief: "The model learned from a lopsided archive. Go see what it can't see.",
    controls: ["sampleSkew"],
    unlockedBy: "dunes.temperature-sweep",
  },
};

export function isZoneUnlocked(
  zone: ZoneId,
  completed: Partial<Record<ObjectiveId, true>>,
): boolean {
  const gate = ZONES[zone].unlockedBy;
  return gate === null || completed[gate] === true;
}

export function isZoneId(v: unknown): v is ZoneId {
  return typeof v === "string" && (ZONE_IDS as readonly string[]).includes(v);
}
