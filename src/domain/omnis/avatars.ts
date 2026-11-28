// src/domain/omnis/avatars.ts
//
// Three stylised explorers. Deliberately not photoreal: primitives that try to look
// human land in the uncanny valley; proportion, palette and silhouette carry identity.

export const AVATAR_IDS = ["nova", "atlas", "sage"] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export interface AvatarDef {
  id: AvatarId;
  name: string;
  blurb: string;
  height: number; // metres-ish, scene units
  build: number; // shoulder width factor
  skin: string;
  hair: string;
  hairStyle: "crop" | "beanie" | "long";
  outfit: string;
  trim: string;
}

export const AVATARS: Readonly<Record<AvatarId, AvatarDef>> = {
  nova: {
    id: "nova", name: "Nova", blurb: "Quick, curious, first through every door.",
    height: 1.75, build: 1, skin: "#c98b6a", hair: "#1d1a22", hairStyle: "crop",
    outfit: "#1f6f86", trim: "#5ee7ff",
  },
  atlas: {
    id: "atlas", name: "Atlas", blurb: "Steady hands. Reads the map twice.",
    height: 1.85, build: 1.18, skin: "#8a5a3c", hair: "#3b2a57", hairStyle: "beanie",
    outfit: "#4b3a8a", trim: "#a78bfa",
  },
  sage: {
    id: "sage", name: "Sage", blurb: "Asks why before how.",
    height: 1.68, build: 0.92, skin: "#e6b99a", hair: "#7a2843", hairStyle: "long",
    outfit: "#7a2843", trim: "#ff5c8a",
  },
};

export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === "string" && (AVATAR_IDS as readonly string[]).includes(v);
}
