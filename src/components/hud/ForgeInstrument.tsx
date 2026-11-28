// src/components/hud/ForgeInstrument.tsx
"use client";

import { useEffect } from "react";
import { ensureForgeWorker, forge as forgeCtl } from "@/workers/forgeClient";
import { useSession } from "@/state/sessionStore";
import { Dial } from "./Dial";
import { Btn, Readout } from "./primitives";

export function ForgeInstrument() {
  const forge = useSession((s) => s.forge);
  const running = useSession((s) => s.forgeRunning);

  useEffect(() => {
    ensureForgeWorker();
  }, []);

  const max = forge ? Math.max(...forge.deltaMag, 1e-12) : 1;

  return (
    <>
      {forge ? (
        <>
          <dl className="grid grid-cols-3 gap-4">
            <Readout label="Loss (BCE)" value={forge.loss.toFixed(4)} size="lg" tone="accent" />
            <Readout label="Accuracy" value={`${(forge.accuracy * 100).toFixed(1)}%`} />
            <Readout label="Step" value={String(forge.step)} />
          </dl>

          <div className="mt-4 border-t border-white/10 pt-3">
            <h3 className="text-[13px] text-ash">Blame reaching each layer</h3>
            <ul className="mt-2 space-y-2">
              {forge.deltaMag.map((v, i) => (
                <li key={i} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3">
                  <span className="text-[13px] text-ash">Layer {i + 1}</span>
                  <span className="relative block h-1 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
                    <span
                      className="absolute inset-x-0 top-0 block h-1 origin-left rounded-full bg-signal"
                      style={{ transform: `scaleX(${Math.min(1, Math.max(0, v / max))})` }}
                    />
                  </span>
                  <span className="text-right font-mono text-[13px] tabular-nums text-bone">{v.toExponential(1)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[14px] leading-snug text-bone/85">
              Blame starts at the output and shrinks as it crosses each layer. That shrinking is the vanishing gradient.
            </p>
          </div>
        </>
      ) : (
        <p className="text-[15px] leading-snug text-bone" role="status">
          Warming up the forge…
        </p>
      )}

      <div className="mt-4 border-t border-white/10 pt-3">
        <Dial param="learningRate" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn variant="primary" onClick={() => forgeCtl.run(!running)} className="min-w-24">
          {running ? "Pause" : "Train"}
        </Btn>
        <Btn onClick={() => forgeCtl.step()}>Step once</Btn>
        <Btn onClick={() => forgeCtl.reset()}>Reset weights</Btn>
      </div>
    </>
  );
}
