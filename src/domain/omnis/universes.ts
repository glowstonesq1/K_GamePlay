// src/domain/omnis/universes.ts
//
// OMNIS is a hub of universes, each a whole subject. COGNITERRA (the Cosmic Observatory
// and its four worlds) is the "ai" universe; the others are sealed until built, and their
// specs live in docs/omnis-blueprints.md.

export const UNIVERSE_IDS = ["hub", "ai", "cybersec", "dsa", "creative", "literacy"] as const;
export type UniverseId = (typeof UNIVERSE_IDS)[number];

export interface UniverseDef {
  id: UniverseId;
  name: string;
  subject: string;
  tagline: string;
  /** Portal glow. Mirrored by nothing in CSS: the HUD retints via data-world only inside a universe. */
  accent: string;
  playable: boolean;
}

export const UNIVERSES: Readonly<Record<UniverseId, UniverseDef>> = {
  hub: {
    id: "hub",
    name: "The Multiverse Hub",
    subject: "Every subject, one doorway",
    tagline: "Pick who you are, then pick where to go.",
    accent: "#c9d4ff",
    playable: true,
  },
  ai: {
    id: "ai",
    name: "The Cosmic Observatory",
    subject: "AI and machine learning",
    tagline: "Four worlds that each take one piece of how machines learn.",
    accent: "#5ee7ff",
    playable: true,
  },
  cybersec: {
    id: "cybersec",
    name: "The Neon Citadel",
    subject: "Cybersecurity",
    tagline: "A city that runs on trust, and every way that trust breaks.",
    accent: "#ff3fd8",
    playable: false,
  },
  dsa: {
    id: "dsa",
    name: "The Voxel Foundry",
    subject: "Data structures and algorithms",
    tagline: "Build the structure, then race it.",
    accent: "#7dff6a",
    playable: false,
  },
  creative: {
    id: "creative",
    name: "The Paper Atelier",
    subject: "Creative coding",
    tagline: "Loops that draw, noise that paints.",
    accent: "#ff9f43",
    playable: false,
  },
  literacy: {
    id: "literacy",
    name: "The Lantern Library",
    subject: "Everyday tech literacy",
    tagline: "How the internet, passwords and your phone actually work.",
    accent: "#f4e4c1",
    playable: false,
  },
};

export function isUniverseId(v: unknown): v is UniverseId {
  return typeof v === "string" && (UNIVERSE_IDS as readonly string[]).includes(v);
}
