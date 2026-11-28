import { describe, expect, it } from "vitest";
import { evaluate, FIX_CARDS, TRAIN_DECK, type Label } from "./catdog";
import { resonance, skillState, SKILLS, accessoriesOwned } from "./skills";

const truth = (cards: readonly { id: string; truth: Label }[]) =>
  Object.fromEntries(cards.map((c) => [c.id, c.truth])) as Record<string, Label>;

describe("cat/dog shortcut", () => {
  it("waits until every card is labelled", () => {
    expect(evaluate({}, false).stage).toBe("labeling");
  });
  it("learns 'orange means cat' from the starter deck and fools itself on the Shiba", () => {
    const e = evaluate(truth(TRAIN_DECK), false);
    expect(e.stage).toBe("shortcut");
    const byId = Object.fromEntries(e.predictions.map((p) => [p.card.id, p]));
    expect(byId.smokey!.correct).toBe(true);
    expect(byId.rex!.correct).toBe(true);
    expect(byId.kitsune!.label).toBe("cat");
  });
  it("is fixed by more varied examples, not a new model", () => {
    const e = evaluate(truth([...TRAIN_DECK, ...FIX_CARDS]), true);
    expect(e.stage).toBe("fixed");
  });
  it("reports wrong labels as the player's data problem", () => {
    const labels = truth(TRAIN_DECK);
    labels.marmalade = "dog";
    const e = evaluate(labels, false);
    expect(e.stage).toBe("mislabeled");
    expect(e.wrongLabels).toEqual(["Marmalade"]);
  });
});

describe("skills and resonance", () => {
  it("resonance is earned from objectives and spent on skills", () => {
    const completed = { "hub.boot": true, "valley.first-descent": true } as const;
    expect(resonance(completed, {})).toEqual({ earned: 125, spent: 0, available: 125 });
    expect(resonance(completed, { "logic-1": true })).toEqual({ earned: 125, spent: 100, available: 25 });
  });
  it("needs the gate, then the resonance", () => {
    expect(skillState("logic-1", { "hub.boot": true }, {}).kind).toBe("gated");
    expect(skillState("logic-1", { "valley.first-descent": true }, {}).kind).toBe("ready");
    expect(skillState("logic-2", { "valley.first-descent": true, "forge.fit": true }, {}).kind).toBe("gated");
    // Finishing Curiosity mode (two objectives, 100) plus the hub boot pays for Ethics.
    expect(skillState("ethics-1", { "hub.boot": true, "curiosity.first-model": true, "curiosity.shortcut": true }, {})).toEqual({ kind: "ready" });
    expect(skillState("ethics-1", { "curiosity.shortcut": true }, {})).toEqual({ kind: "short", need: 50 });
    expect(skillState("logic-1", { "valley.first-descent": true }, { "ethics-1": true })).toEqual({ kind: "short", need: 100 });
  });
  it("never opens sealed universes' nodes", () => {
    const all = Object.fromEntries(Object.keys(SKILLS).map((k) => [k, true]));
    expect(skillState("stealth-1", all as never, {}).kind).toBe("sealed");
  });
  it("grants one accessory per owned node", () => {
    expect(accessoriesOwned({ "logic-1": true, "ethics-1": true })).toEqual(["lattice-visor", "halo"]);
  });
});
