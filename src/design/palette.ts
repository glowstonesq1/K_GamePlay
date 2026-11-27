// src/design/palette.ts
//
// WebGL can't read CSS custom properties, so the 3D layer mirrors the tokens in
// globals.css here. Change a colour in both places or neither.
export const PALETTE = {
  void: "#05070a",
  bio: "#39ffb0",
  bioDim: "#1a7a55",
  signal: "#ffb020",
  alarm: "#ff3b30",
  bone: "#e8e6e1",
  ridge: "#1b2430",
} as const;
