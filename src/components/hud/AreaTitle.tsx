// src/components/hud/AreaTitle.tsx
"use client";

import { selectZone, useGame } from "@/state/gameStore";

/**
 * Region-title card. Re-keyed on zone change so it replays its entrance: the open-world
 * convention of announcing where you are the moment you arrive.
 */
export function AreaTitle() {
  const zone = useGame(selectZone);

  return (
    <header key={zone.id} className="anim-area pointer-events-auto min-w-0 max-w-[26rem]">
      <p className="text-[13px] text-ash">
        Cogniterra <span className="font-mono text-bio">{zone.code}</span>
      </p>
      <h1 className="mt-1 font-display text-[30px] font-bold leading-[1.05] text-bone [overflow-wrap:break-word] sm:text-[44px]">
        {zone.name}
      </h1>
      <p className="mt-2 text-[15px] text-bio">{zone.concept}</p>
      <p className="mt-1 hidden text-[15px] leading-snug text-bone/80 sm:block">{zone.brief}</p>
    </header>
  );
}
