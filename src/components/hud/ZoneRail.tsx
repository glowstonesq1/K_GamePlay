// src/components/hud/ZoneRail.tsx
"use client";

import { OBJECTIVES } from "@/domain/objectives";
import { isZoneUnlocked, ZONE_IDS, ZONES } from "@/domain/zones";
import { gameStore, useGame } from "@/state/gameStore";
import { Panel } from "./Panel";

export function ZoneRail() {
  const current = useGame((s) => s.currentZone);
  const completed = useGame((s) => s.completed);

  return (
    <Panel tag="MAP" label="Zones" className="w-full sm:max-w-[17rem]">
      <ol className="-m-3 grid grid-cols-5 divide-x divide-rule sm:block sm:divide-x-0 sm:divide-y">
        {ZONE_IDS.map((id) => {
          const z = ZONES[id];
          const open = isZoneUnlocked(id, completed);
          const here = id === current;
          const gate = z.unlockedBy ? OBJECTIVES[z.unlockedBy].label : null;

          return (
            <li key={id}>
              <button
                type="button"
                disabled={!open}
                aria-current={here ? "location" : undefined}
                onClick={() => gameStore.getState().travelTo(id)}
                title={!open && gate ? `Locked. ${gate}.` : undefined}
                className={[
                  "flex w-full flex-col items-center gap-1 px-1 py-2 text-left sm:flex-row sm:gap-3 sm:px-3 text-xs uppercase tracking-[0.15em] transition-colors",
                  here && "bg-bio font-bold text-void",
                  !here && open && "hover:bg-bone hover:text-void",
                  !open && "cursor-not-allowed text-ash/70",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="tabular-nums sm:w-6">{z.code}</span>
                <span className="sr-only sm:not-sr-only sm:flex-1 sm:truncate">{z.name}</span>
                {!open && (
                  <span
                    aria-label="locked"
                    className="h-1.5 w-6 sm:h-3 bg-[repeating-linear-gradient(-45deg,var(--color-signal)_0_3px,transparent_3px_6px)]"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
