// src/components/hud/XpBlock.tsx
"use client";

import { levelProgress } from "@/domain/progression";
import { selectPlayerXP, useGame } from "@/state/gameStore";
import { Panel } from "./Panel";

const SEGMENTS = 20;
const pad = (n: number, w: number) => String(n).padStart(w, "0");

export function XpBlock() {
  const xp = useGame(selectPlayerXP);
  const { level, intoLevel, levelSpan, fraction } = levelProgress(xp);
  const lit = Math.floor(fraction * SEGMENTS);

  return (
    <Panel tag="XP" label="Field rank" className="w-full sm:w-[17rem]">
      <div className="flex items-end justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-ash">Lvl</span>
        <span className="font-display text-3xl font-bold sm:text-4xl leading-none tabular-nums">{pad(level, 2)}</span>
      </div>

      <div
        role="progressbar"
        aria-label="Progress to next level"
        aria-valuemin={0}
        aria-valuemax={levelSpan}
        aria-valuenow={intoLevel}
        aria-valuetext={`${intoLevel} of ${levelSpan} XP to level ${level + 1}`}
        className="mt-2 grid gap-[2px] sm:mt-3"
        style={{ gridTemplateColumns: `repeat(${SEGMENTS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={`h-2 sm:h-3 ${i < lit ? "bg-bio" : "bg-rule"}`} />
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-ash">
        <span>
          <span className="text-bone">{pad(intoLevel, 4)}</span> / {pad(levelSpan, 4)}
        </span>
        <span>Σ {pad(xp, 5)}</span>
      </div>
    </Panel>
  );
}
