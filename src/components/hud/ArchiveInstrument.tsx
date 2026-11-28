// src/components/hud/ArchiveInstrument.tsx
"use client";

import { GAP_DETECT_PTS, GAP_FIXED_PTS, useSession } from "@/state/sessionStore";
import { Dial } from "./Dial";
import { Readout } from "./primitives";

export function ArchiveInstrument() {
  const archive = useSession((s) => s.archive);
  const avatarInB = useSession((s) => s.avatarInB);
  const { accA, accB, gapPts, train } = archive;
  const shareB = train.length ? (train.filter((p) => p.group === 1).length / train.length) * 100 : 0;
  const gapTone = gapPts >= GAP_DETECT_PTS ? "alarm" : gapPts < GAP_FIXED_PTS ? "accent" : "signal";

  return (
    <>
      <dl className="grid grid-cols-3 gap-4">
        <Readout label="Accuracy, group A" value={`${(accA * 100).toFixed(1)}%`} />
        <Readout label="Accuracy, group B" value={`${(accB * 100).toFixed(1)}%`} tone={gapPts >= GAP_DETECT_PTS ? "alarm" : "bone"} />
        <Readout label="Gap" value={`${gapPts.toFixed(1)} pts`} size="lg" tone={gapTone} />
      </dl>

      <p className="mt-3 text-[14px] text-bone/85">
        Group B is <span className="font-mono tabular-nums">{shareB.toFixed(0)}%</span> of the training sample
      </p>

      <div className="mt-4 border-t border-white/10 pt-3">
        <Dial param="sampleSkew" />
      </div>

      <p className="mt-3 text-[14px] text-bone" role="status">
        {avatarInB ? "You are standing in group B's region" : "You are in group A's region. Tap the floor to walk east."}
      </p>
      <p className="mt-2 text-[14px] leading-snug text-bone/85">
        Same rule for everyone. The model only learned the part of it it was shown.
      </p>
    </>
  );
}
