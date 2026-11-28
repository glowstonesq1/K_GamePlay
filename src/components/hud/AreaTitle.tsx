// src/components/hud/AreaTitle.tsx
"use client";

import { selectZone, useGame } from "@/state/gameStore";

/**
 * Region-title card. Re-keyed on zone change so the parent can replay its entrance: the
 * open-world convention of announcing where you are the moment you arrive.
 */
export function AreaTitle() {
  const zone = useGame(selectZone);

  return (
    <header key={zone.id} className="pointer-events-auto min-w-0 max-w-[26rem]">
      <p className="font-mono text-[12px] text-ash">
        {zone.code}
      </p>
      <h1 className="mt-1 font-display text-4xl font-normal leading-[1.05] tracking-tight text-bone [overflow-wrap:break-word] sm:text-5xl">
        {zone.name}
      </h1>
      <p className="mt-2 text-[15px] text-ash">{zone.concept}</p>
      <p className="mt-1 hidden text-[14px] leading-snug text-bone/70 sm:block">{zone.brief}</p>
    </header>
  );
}
