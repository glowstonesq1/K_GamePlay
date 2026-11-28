// src/components/hud/Instrument.tsx
"use client";

import { useMemo, useState } from "react";
import { VALLEY } from "@/domain/loss/presets";
import { COLD_T, HOT_T, LOGITS, PROMPT, TOKENS } from "@/domain/tokens/corpus";
import { entropyBits, softmax } from "@/domain/tokens/sampling";
import { gameStore, useGame } from "@/state/gameStore";
import { sessionStore, useSession, type Speed } from "@/state/sessionStore";
import { ArchiveInstrument } from "./ArchiveInstrument";
import { Dial } from "./Dial";
import { ForgeInstrument } from "./ForgeInstrument";
import { Btn, Plate, Readout } from "./primitives";
import { HUB_NODES } from "@/components/worlds/hubLayout";

const STATUS = {
  idle: { text: "Ready", tone: "bone" },
  running: { text: "Descending", tone: "accent" },
  converged: { text: "Settled, ‖∇L‖ ≈ 0", tone: "accent" },
  diverged: { text: "Unstable: η too large", tone: "alarm" },
} as const;

function ValleyInstrument() {
  const probe = useSession((s) => s.probe);
  const running = useSession((s) => s.running);
  const speed = useSession((s) => s.speed);
  const showField = useSession((s) => s.showField);
  const oracle = useSession((s) => s.oracle);
  const s = sessionStore.getState();
  const status = probe ? STATUS[probe.status] : null;
  const [more, setMore] = useState(false);

  return (
    <>
      {probe ? (
        <dl className="grid grid-cols-3 gap-4">
          <Readout label="Loss L(θ)" value={probe.loss.toFixed(3)} size="lg" tone="accent" />
          <Readout label="Slope ‖∇L‖" value={probe.gradNorm < 1e-3 ? probe.gradNorm.toExponential(1) : probe.gradNorm.toFixed(3)} />
          <Readout label="Step" value={String(probe.step)} />
        </dl>
      ) : (
        <p className="text-[15px] leading-snug text-bone">
          Tap or click the terrain to drop a probe. It only knows the slope under it.
        </p>
      )}

      {status && (
        <p className="mt-3 flex items-center gap-2 text-[14px]" role="status">
          <span className={`font-mono ${status.tone === "alarm" ? "text-alarm" : status.tone === "accent" ? "text-accent" : "text-bone"}`}>
            {status.text}
          </span>
          {probe!.rises > 0 && <span className="text-signal">Loss went up on {probe!.rises} step{probe!.rises > 1 ? "s" : ""}</span>}
        </p>
      )}

      {oracle && probe && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <dl className="grid grid-cols-2 gap-4">
            <Readout label="Oracle route" value={`${oracle.length.toFixed(1)} m`} />
            <Readout label="Global floor" value={oracle.target.loss.toFixed(3)} tone="accent" />
          </dl>
          <p className="mt-2 text-[14px] leading-snug text-bone/85">
            {probe.loss - oracle.target.loss > 0.05
              ? "Your probe stopped in a shallower basin. The Oracle saw the whole map; gradient descent never does."
              : "Same floor both ways. Here, following the slope happened to be enough."}
          </p>
        </div>
      )}

      {/* Phones: dial and secondary controls fold away so the terrain stays visible. */}
      <div id="valley-more" className={`mt-4 border-t border-white/10 pt-3 ${more ? "" : "hidden sm:block"}`}>
        <Dial param="learningRate" mark={{ value: 2 / VALLEY.lambdaMax, label: "Stability edge 2/λ_max" }} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn
          variant="primary"
          disabled={!probe || probe.status === "converged" || probe.status === "diverged"}
          onClick={() => s.setRunning(!running)}
          className="min-w-24"
        >
          {running ? "Pause" : "Descend"}
        </Btn>
        <Btn disabled={!probe} onClick={() => s.resetProbe()}>
          Reset
        </Btn>
        <Btn aria-expanded={more} aria-controls="valley-more" onClick={() => setMore((m) => !m)} className="sm:hidden">
          {more ? "Less" : "Tune η"}
        </Btn>
        <div role="group" aria-label="Simulation speed" className={`flex gap-1 ${more ? "" : "max-sm:hidden"}`}>
          {([1, 10, 100] as Speed[]).map((v) => (
            <Btn key={v} pressed={speed === v} onClick={() => s.setSpeed(v)} className="min-w-12 px-2 font-mono">
              {v}×
            </Btn>
          ))}
        </div>
        <Btn
          onClick={() => s.dropBall()}
          title="Release a physical ball from the probe's start. It has momentum."
          className={more ? "" : "max-sm:hidden"}
        >
          Roll a ball
        </Btn>
        <Btn pressed={showField} onClick={() => s.toggleField()} className={more ? "" : "max-sm:hidden"}>
          Slope field
        </Btn>
        <Btn
          disabled={!(probe && (probe.status === "converged" || probe.status === "diverged") && !oracle)}
          onClick={() => s.revealOracle()}
          className={more ? "" : "max-sm:hidden"}
        >
          Reveal the Oracle
        </Btn>
      </div>
    </>
  );
}

function DunesInstrument() {
  const T = useGame((s) => s.temperature);
  const samples = useSession((s) => s.samples);
  const p = useMemo(() => softmax(LOGITS, T), [T]);
  const H = entropyBits(p);
  const top = p[0]!;

  return (
    <>
      <dl className="grid grid-cols-2 gap-4">
        <Readout label="Entropy, bits" value={H.toFixed(2)} size="lg" tone="accent" />
        <Readout label={`P("${TOKENS[0]!.text}")`} value={`${(top * 100).toFixed(1)}%`} />
      </dl>
      <div className="mt-4 border-t border-white/10 pt-3">
        <Dial param="temperature" mark={{ value: 1, label: "Raw model odds at T =" }} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Btn variant="primary" onClick={() => sessionStore.getState().sampleToken()}>
          Sample next word
        </Btn>
        <Btn onClick={() => sessionStore.getState().sampleBatch(100)}>Shake 100</Btn>
      </div>
      <p className="mt-2 text-[13px] text-ash">
        Try once at T ≤ {COLD_T} and once at T ≥ {HOT_T}. Then shake 100 seeds and compare the piles to the trees.
      </p>
      <div className="mt-3 text-[15px]" aria-live="polite">
        <span className="text-ash">{PROMPT} </span>
        <span className="font-mono text-signal">{samples[0]?.token ?? "…"}</span>
      </div>
      {samples.length > 1 && (
        <ol aria-label="Earlier samples" className="mt-2 flex flex-wrap gap-1.5">
          {samples.slice(1).map((x) => (
            <li key={x.id} className="rounded-full border border-white/10 px-2.5 py-0.5 font-mono text-[13px] text-bone/80">
              {x.token} <span className="text-ash">T{x.temperature.toFixed(1)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function Instrument() {
  const zone = useGame((s) => s.currentZone);
  const valleyOpen = useGame((s) => s.completed["hub.boot"] === true);

  return (
    <Plate label="Instrument" className="w-full sm:w-[25rem]">
      {zone === "loss-valley" && <ValleyInstrument />}
      {zone === "token-dunes" && <DunesInstrument />}
      {zone === "hub" && (
        <div>
          <p className="text-[15px] leading-snug text-bone">
            Four worlds hang in this sky, each one a piece of how machines learn. Start with the valley: everything else is built on rolling downhill.
          </p>
          <Btn variant="primary" className="mt-3" disabled={!valleyOpen} onClick={() => sessionStore.getState().travel("loss-valley", HUB_NODES[0]!.pos)}>
            Enter the Loss Valley
          </Btn>
        </div>
      )}
      {zone === "backprop-forge" && <ForgeInstrument />}
      {zone === "skew-archive" && <ArchiveInstrument />}
    </Plate>
  );
}
