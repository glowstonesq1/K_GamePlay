// src/domain/omnis/funFacts.ts
//
// Curiosity mode's "AI fun fact". Served from this bundle through an async function shaped
// like an API call, so a real endpoint can replace it later without touching the UI.
// It is local on purpose: the static site's CSP (connect-src 'self') blocks outside fetches.
// Every line here is a checkable claim; keep it that way.

export const FUN_FACTS: readonly string[] = [
  "The word \"robot\" comes from a 1920 Czech play, R.U.R., by Karel Čapek. It's from \"robota\", meaning forced labour.",
  "In 1997 IBM's Deep Blue beat the reigning world chess champion, Garry Kasparov, in a six-game match.",
  "In 2016 DeepMind's AlphaGo beat Lee Sedol at Go, a game with more possible positions than there are atoms in the observable universe.",
  "The term \"artificial intelligence\" was coined for a 1956 summer workshop at Dartmouth College.",
  "ELIZA, a 1960s chatbot that mostly rephrased your own words back as questions, convinced some users it understood them.",
  "Spam filters were one of the first everyday uses of machine learning: they learn which words show up more in junk than in real mail.",
  "Language models don't read whole words. They read tokens, which are often pieces of words, so \"unbelievable\" might be three tokens.",
  "A model can be very confident and still wrong. Confidence is a number it computes, not a guarantee.",
];

/** Mock API: resolves after a short, realistic delay. `pick` is injectable for tests. */
export function getFunFact(pick: () => number = Math.random): Promise<string> {
  const fact = FUN_FACTS[Math.floor(pick() * FUN_FACTS.length) % FUN_FACTS.length]!;
  return new Promise((resolve) => setTimeout(() => resolve(fact), 250));
}
