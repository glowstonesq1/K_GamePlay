// src/components/hud/ZoneStrip.tsx
"use client";

import { OBJECTIVES } from "@/domain/objectives";
import { isZoneUnlocked, ZONE_IDS, ZONES } from "@/domain/zones";
import { gameStore, useGame } from "@/state/gameStore";
import { LockIcon } from "./primitives";

/**
 * Compass-style zone strip. Current zone carries a marker bar under it; locked zones show
 * a lock glyph and say what opens them, so the state never rests on colour alone.
 */
export function ZoneStrip() {
  const current = useGame((s) => s.currentZone);
  const completed = useGame((s) => s.completed);

  return (
    <nav aria-label="Zones" className="pointer-events-auto">
      <ol className="flex items-stretch border-y border-line bg-panel/60 backdrop-blur-sm">
        {ZONE_IDS.map((id) => {
          const z = ZONES[id];
          const open = isZoneUnlocked(id, completed);
          const here = id === current;
          const gate = z.unlockedBy ? OBJECTIVES[z.unlockedBy].label : "";
          return (
            <li key={id} className="flex-1 sm:flex-none">
              <button
                type="button"
                disabled={!open}
                aria-current={here ? "location" : undefined}
                aria-label={open ? `${z.code} ${z.name}` : `${z.code} ${z.name}, locked. Opens when you: ${gate}`}
                title={open ? z.name : `Opens when you: ${gate}`}
                onClick={() => gameStore.getState().travelTo(id)}
                className="relative flex min-h-11 w-full items-center justify-center gap-1.5 px-3 font-mono text-[14px] text-ash transition-colors duration-150 hover:text-bone disabled:cursor-not-allowed disabled:text-ash/50 aria-[current=location]:text-bio sm:px-4"
              >
                {!open && <LockIcon />}
                <span>{z.code}</span>
                <span className="hidden font-sans lg:inline">{z.name}</span>
                <span
                  aria-hidden
                  className={`absolute inset-x-2 -bottom-px h-0.5 origin-center bg-bio transition-transform duration-300 ${here ? "scale-x-100" : "scale-x-0"}`}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
