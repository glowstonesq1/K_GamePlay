// src/components/hud/ZoneStrip.tsx
"use client";

import { OBJECTIVES } from "@/domain/objectives";
import { isZoneUnlocked, ZONE_IDS, ZONES } from "@/domain/zones";
import { useGame } from "@/state/gameStore";
import { sessionStore } from "@/state/sessionStore";
import { LockIcon } from "./primitives";

/**
 * Floating zone pill. The current zone sits in a soft accent capsule; locked zones show
 * a lock glyph and say what opens them, so the state never rests on colour alone.
 */
export function ZoneStrip() {
  const current = useGame((s) => s.currentZone);
  const completed = useGame((s) => s.completed);

  return (
    <nav aria-label="Zones" className="pointer-events-auto">
      <ol className="glass flex items-stretch gap-0.5 rounded-full p-1">
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
                onClick={() => sessionStore.getState().travel(id)}
                className="relative flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-3 font-mono text-[14px] text-ash transition-[background-color,color] duration-150 hover:text-bone disabled:cursor-not-allowed disabled:text-ash/50 aria-[current=location]:bg-accent-soft aria-[current=location]:text-accent sm:px-4"
              >
                {!open && <LockIcon />}
                <span>{z.code}</span>
                <span className="hidden font-sans lg:inline">{z.name.replace(/^The /, "")}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
