// src/domain/tokens/corpus.ts

/**
 * One prompt, a ten-token slice of vocabulary, hand-set logits.
 *
 * PEDAGOGY: Real vocabularies hold ~50k–200k tokens and the long tail matters: at high T
 * thousands of individually-unlikely tokens together soak up real probability mass.
 * Ten tokens keep the dunes readable; the copy says this is a slice, not the vocabulary.
 * Tokens here are whole words for readability; real tokenizers split sub-words.
 */
export const PROMPT = "The cat sat on the";

export const TOKENS: readonly { text: string; logit: number }[] = [
  { text: "mat", logit: 3.2 },
  { text: "floor", logit: 2.5 },
  { text: "sofa", logit: 2.0 },
  { text: "bed", logit: 1.6 },
  { text: "table", logit: 1.0 },
  { text: "roof", logit: 0.6 },
  { text: "keyboard", logit: -0.1 },
  { text: "moon", logit: -0.9 },
  { text: "idea", logit: -1.7 },
  { text: "banana", logit: -2.3 },
];

export const LOGITS = TOKENS.map((t) => t.logit);

/** Temperatures that count as "cold" and "hot" for the sweep objective. */
export const COLD_T = 0.5;
export const HOT_T = 2;
