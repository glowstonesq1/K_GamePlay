// src/domain/omnis/catdog.ts
//
// Curiosity mode: "Train the cat/dog AI". A real (tiny) naive Bayes classifier over three
// visible features, trained on whatever labels the player gives.
//
// PEDAGOGY: the starter deck is rigged the way real datasets are rigged by accident:
// every cat in it is orange and every dog is brown. Colour is therefore the single most
// reliable signal in the data, and the model leans on it. Shown a Shiba Inu (an orange
// dog with pointy ears) it says "cat". Not because it is broken, but because it learned
// exactly what the examples taught: a shortcut. The fix is more varied examples, not a
// cleverer model. That is the whole lesson of the Ethics node, in a form a ten-year-old
// can play.

export type Label = "cat" | "dog";
export type Color = "orange" | "brown" | "grey";
export type Ears = "pointy" | "floppy";
export type Snout = "short" | "long";

export interface Card {
  id: string;
  name: string;
  emoji: string;
  truth: Label;
  color: Color;
  ears: Ears;
  snout: Snout;
  note: string;
}

const card = (c: Card) => c;

export const TRAIN_DECK: readonly Card[] = [
  card({ id: "marmalade", name: "Marmalade", emoji: "🐱", truth: "cat", color: "orange", ears: "pointy", snout: "short", note: "Sleeps in sunbeams." }),
  card({ id: "ginger", name: "Ginger", emoji: "🐱", truth: "cat", color: "orange", ears: "pointy", snout: "short", note: "Knocks cups off tables." }),
  card({ id: "biscuit", name: "Biscuit", emoji: "🐱", truth: "cat", color: "orange", ears: "floppy", snout: "short", note: "A Scottish Fold: folded ears." }),
  card({ id: "tango", name: "Tango", emoji: "🐱", truth: "cat", color: "orange", ears: "pointy", snout: "short", note: "Enormous Maine Coon." }),
  card({ id: "bruno", name: "Bruno", emoji: "🐶", truth: "dog", color: "brown", ears: "floppy", snout: "long", note: "Fetches anything." }),
  card({ id: "cocoa", name: "Cocoa", emoji: "🐶", truth: "dog", color: "brown", ears: "floppy", snout: "long", note: "Afraid of the vacuum." }),
  card({ id: "hazel", name: "Hazel", emoji: "🐶", truth: "dog", color: "brown", ears: "pointy", snout: "long", note: "A shepherd: pointy ears." }),
  card({ id: "mocha", name: "Mocha", emoji: "🐶", truth: "dog", color: "brown", ears: "floppy", snout: "short", note: "A pug: squashed snout." }),
];

/** Offered after the shortcut is exposed: the examples the deck was missing. */
export const FIX_CARDS: readonly Card[] = [
  card({ id: "sunny", name: "Sunny", emoji: "🐶", truth: "dog", color: "orange", ears: "pointy", snout: "long", note: "An orange dog. They exist." }),
  card({ id: "pepper", name: "Pepper", emoji: "🐱", truth: "cat", color: "brown", ears: "pointy", snout: "short", note: "A brown cat. So do they." }),
];

export const TEST_SET: readonly Card[] = [
  card({ id: "smokey", name: "Smokey", emoji: "🐱", truth: "cat", color: "grey", ears: "pointy", snout: "short", note: "A grey cat, a colour the model has never seen." }),
  card({ id: "rex", name: "Rex", emoji: "🐶", truth: "dog", color: "brown", ears: "floppy", snout: "long", note: "As doggy as dogs get." }),
  card({ id: "kitsune", name: "Kitsune", emoji: "🐶", truth: "dog", color: "orange", ears: "pointy", snout: "long", note: "A Shiba Inu: orange, pointy ears, long snout." }),
];

const FEATURES = ["color", "ears", "snout"] as const;
const VALUES: Record<(typeof FEATURES)[number], readonly string[]> = {
  color: ["orange", "brown", "grey"],
  ears: ["pointy", "floppy"],
  snout: ["short", "long"],
};

export interface Model {
  n: Record<Label, number>;
  counts: Record<Label, Record<string, number>>;
}

export function train(examples: readonly { card: Card; label: Label }[]): Model {
  const m: Model = { n: { cat: 0, dog: 0 }, counts: { cat: {}, dog: {} } };
  for (const { card: c, label } of examples) {
    m.n[label] += 1;
    for (const f of FEATURES) {
      const k = `${f}:${c[f]}`;
      m.counts[label][k] = (m.counts[label][k] ?? 0) + 1;
    }
  }
  return m;
}

/**
 * P(cat | features) with Laplace smoothing (α = 1) and equal class priors. Smoothing is
 * why an unseen colour (grey) is neutral rather than impossible.
 */
export function predict(m: Model, c: Card): { label: Label; pCat: number } {
  const score = (label: Label) => {
    let logp = Math.log(0.5);
    for (const f of FEATURES) {
      const k = `${f}:${c[f]}`;
      logp += Math.log(((m.counts[label][k] ?? 0) + 1) / (m.n[label] + VALUES[f].length));
    }
    return logp;
  };
  const a = score("cat");
  const b = score("dog");
  const pCat = 1 / (1 + Math.exp(b - a));
  return { label: pCat >= 0.5 ? "cat" : "dog", pCat };
}

export type Stage = "labeling" | "mislabeled" | "shortcut" | "fixed";

export interface Evaluation {
  stage: Stage;
  predictions: { card: Card; label: Label; pCat: number; correct: boolean }[];
  wrongLabels: string[];
}

/**
 * Train on the player's labels and judge the test set.
 * - labeling:   not every card in the active deck has a label yet
 * - mislabeled: the player put some cards in the wrong bin (garbage in, garbage out)
 * - shortcut:   labels right, Smokey and Rex right, but the Shiba fooled it
 * - fixed:      all three test animals right
 */
export function evaluate(labels: Readonly<Record<string, Label>>, withFix: boolean): Evaluation {
  const deck = withFix ? [...TRAIN_DECK, ...FIX_CARDS] : TRAIN_DECK;
  if (deck.some((c) => !labels[c.id])) return { stage: "labeling", predictions: [], wrongLabels: [] };
  const m = train(deck.map((c) => ({ card: c, label: labels[c.id]! })));
  const predictions = TEST_SET.map((c) => {
    const p = predict(m, c);
    return { card: c, ...p, correct: p.label === c.truth };
  });
  const wrongLabels = deck.filter((c) => labels[c.id] !== c.truth).map((c) => c.name);
  if (wrongLabels.length) return { stage: "mislabeled", predictions, wrongLabels };
  const stage: Stage = predictions.every((p) => p.correct) ? "fixed" : "shortcut";
  return { stage, predictions, wrongLabels };
}
