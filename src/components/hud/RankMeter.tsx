// src/components/hud/RankMeter.tsx
"use client";

import { levelProgress } from "@/domain/progression";
import { selectPlayerXP, useGame } from "@/state/gameStore";

export function RankMeter() {
  const xp = useGame(selectPlayerXP);
  const { level, intoLevel, levelSpan, fraction } = levelProgress(xp);

  return (
    <section aria-label="Rank" className="pointer-events-auto w-[11rem] text-right sm:w-[14rem]">
      <div className="flex items-baseline justify-end gap-2">
        <span className="text-[13px] text-ash">Rank</span>
        <span className="font-mono text-[34px] font-light leading-none tabular-nums text-bone sm:text-[40px]">
          {level}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progress to next rank"
        aria-valuemin={0}
        aria-valuemax={levelSpan}
        aria-valuenow={intoLevel}
        aria-valuetext={`${intoLevel} of ${levelSpan} experience to rank ${level + 1}`}
        className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]"
      >
        <div
          className="h-full origin-left rounded-full bg-accent shadow-[0_0_10px_var(--world-accent)] transition-transform duration-700 ease-[var(--ease-out-quint)]"
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[13px] tabular-nums text-ash">
        {intoLevel} / {levelSpan} xp
      </p>
    </section>
  );
}
