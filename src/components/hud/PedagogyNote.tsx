// src/components/hud/PedagogyNote.tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { VALLEY } from "@/domain/loss/presets";
import { valleyLesson } from "@/domain/optim/lesson";
import { useGame } from "@/state/gameStore";
import { useSession } from "@/state/sessionStore";

/**
 * The debrief. Appears only once a descent has finished, so it explains what the player
 * just watched instead of pre-empting it. Re-keyed per outcome: a new run, a new note.
 */
export function PedagogyNote() {
  const zone = useGame((s) => s.currentZone);
  const probe = useSession((s) => s.probe);
  const eta = useGame((s) => s.learningRate);
  const reduce = useReducedMotion();
  const lesson = zone === "loss-valley" ? valleyLesson(VALLEY, probe, eta) : null;
  const key = lesson ? `${lesson.kind}-${probe?.step}` : "none";
  const [dismissed, setDismissed] = useState<string | null>(null);

  const show = lesson && dismissed !== key;

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          key={key}
          aria-live="polite"
          aria-label="What just happened"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
          transition={{ duration: 0.6, delay: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="glass pointer-events-auto w-full p-5 sm:w-[25rem]"
        >
          <p className="text-[12px] text-ash">What just happened</p>
          <h2 className="mt-1 font-display text-[28px] leading-tight text-bone">{lesson.title}</h2>
          <p className="mt-3 font-mono text-[15px] text-accent">θ ← θ − η∇L(θ)</p>
          <p className="mt-3 text-[14px] leading-relaxed text-bone/80">{lesson.body}</p>
          <div className="mt-4 flex items-end justify-between gap-4 border-t border-white/10 pt-3">
            <div>
              <p className="text-[12px] text-ash">{lesson.figure.label}</p>
              <p className="mt-1 font-mono text-lg tabular-nums text-bone">{lesson.figure.value}</p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(key)}
              className="min-h-11 rounded-full px-4 text-[14px] text-ash transition-[color,background-color] duration-150 hover:bg-white/5 hover:text-bone"
            >
              Got it
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
