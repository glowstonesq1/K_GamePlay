// src/components/hud/ObjectiveTracker.tsx
"use client";

import { useEffect, useState } from "react";
import { OBJECTIVES, type ObjectiveId } from "@/domain/objectives";
import { useGame } from "@/state/gameStore";
import { CheckIcon, Plate } from "./primitives";

const IDS = Object.keys(OBJECTIVES) as ObjectiveId[];

/** Quest-log tracker: only the current zone's objectives, the next open one highlighted. */
export function ObjectiveTracker() {
  const zone = useGame((s) => s.currentZone);
  const completed = useGame((s) => s.completed);
  const [open, setOpen] = useState(true);
  // Start folded on phones; the terrain needs the room more than the list does.
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  }, []);
  const echo = useGame((s) => s.echo);
  // At the Observatory the two ECHO modes have separate quest logs.
  const curious = zone === "hub" && echo === "curiosity";
  const list = IDS.filter((id) => OBJECTIVES[id].zone === zone && id.startsWith("curiosity.") === curious);
  if (list.length === 0) return null;
  const next = list.find((id) => !completed[id]);

  return (
    <Plate label="Objectives" className="w-full sm:w-[21rem]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="-m-1 flex min-h-11 w-[calc(100%+0.5rem)] items-center justify-between rounded-xl p-1 text-left"
      >
        <span className="text-[13px] text-ash">Objectives</span>
        <span className="font-mono text-[13px] tabular-nums text-ash">
          {list.filter((id) => completed[id]).length}/{list.length}
        </span>
      </button>
      {open && (
        <ul className="mt-1 space-y-2">
          {list.map((id) => {
            const done = completed[id] === true;
            return (
              <li
                key={id}
                className={`flex items-start gap-2.5 text-[15px] leading-snug ${done ? "text-ash line-through decoration-ash/60" : id === next ? "text-bone" : "text-bone/70"}`}
              >
                <span className={done ? "text-accent" : id === next ? "text-signal" : "text-ash"}>
                  <CheckIcon done={done} />
                </span>
                <span className="min-w-0 flex-1">{OBJECTIVES[id].label}</span>
                <span className="font-mono text-[13px] tabular-nums text-ash">+{OBJECTIVES[id].xp}</span>
                <span className="sr-only">{done ? "done" : "not done"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Plate>
  );
}
