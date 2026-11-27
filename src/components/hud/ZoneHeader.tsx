// src/components/hud/ZoneHeader.tsx
"use client";

import { selectZone, useGame } from "@/state/gameStore";

export function ZoneHeader() {
  const zone = useGame(selectZone);

  return (
    <div className="pointer-events-auto max-w-[22rem]">
      <p className="text-[10px] uppercase tracking-[0.3em] text-ash">Cogniterra // field unit</p>
      <h1 className="mt-1 flex items-baseline gap-3 font-display leading-none">
        <span className="text-4xl font-bold text-bio sm:text-6xl">{zone.code}</span>
        <span className="text-xl font-bold uppercase tracking-tight sm:text-2xl">{zone.name}</span>
      </h1>
      <div className="mt-2 border-l-4 sm:mt-3 border-bio pl-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-bio">{zone.concept}</p>
        <p className="mt-1 text-sm leading-snug text-bone/90">{zone.brief}</p>
      </div>
    </div>
  );
}
