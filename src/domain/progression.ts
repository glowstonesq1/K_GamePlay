// src/domain/progression.ts

/** Cumulative XP required to reach `level`. Quadratic: each level costs a bit more than the last. */
const XP_PER_LEVEL_UNIT = 50;

export function xpForLevel(level: number): number {
  return XP_PER_LEVEL_UNIT * level * level;
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / XP_PER_LEVEL_UNIT));
}

export interface LevelProgress {
  level: number;
  intoLevel: number;
  levelSpan: number;
  /** [0, 1) */
  fraction: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const span = xpForLevel(level + 1) - floor;
  const into = Math.max(0, xp) - floor;
  return { level, intoLevel: into, levelSpan: span, fraction: into / span };
}
