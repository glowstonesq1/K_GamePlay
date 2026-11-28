"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FIX_CARDS, TRAIN_DECK, evaluate, type Card, type Evaluation, type Label } from "@/domain/omnis/catdog";
import { getFunFact } from "@/domain/omnis/funFacts";
import { sessionStore } from "@/state/sessionStore";
import { Btn } from "../primitives";

const SWATCH: Record<string, string> = { orange: "#f59e0b", brown: "#8b5a2b", grey: "#9ca3af" };
const CONFETTI = ["var(--color-cyan)", "var(--color-violet)", "var(--color-rose)", "var(--color-gold)", "var(--color-star)"];

function CardView({
  card, selected, onSelect, onDrop, reduce,
}: {
  card: Card;
  selected: boolean;
  onSelect: () => void;
  onDrop: (x: number, y: number) => void;
  reduce: boolean;
}) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${card.name}, ${card.color}, ${card.ears} ears, ${card.snout} snout`}
      title={card.note}
      drag
      dragSnapToOrigin
      dragMomentum={false}
      whileDrag={reduce ? undefined : { scale: 1.06, zIndex: 50 }}
      onTap={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); }
      }}
      onDragEnd={(_, info) => onDrop(info.point.x - window.scrollX, info.point.y - window.scrollY)}
      className={`relative flex min-h-11 w-[7.25rem] cursor-grab touch-none select-none flex-col gap-1 rounded-xl border bg-black/50 p-2 text-left active:cursor-grabbing ${
        selected ? "border-accent ring-1 ring-accent" : "border-white/10"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[14px] text-bone">
        <span aria-hidden className="text-lg">{card.emoji}</span>
        {card.name}
        {selected && <span className="ml-auto text-[12px] text-accent">Selected</span>}
      </span>
      {/* One compact line of features: the bins have to fit five cards each without scrolling. */}
      <span className="flex items-center gap-1.5 text-[12px] leading-tight text-ash">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: SWATCH[card.color] }} />
        <span>
          {card.color} · {card.ears} · {card.snout} snout
        </span>
      </span>
    </motion.div>
  );
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const a = (i / 40) * Math.PI * 2 + (i % 3) * 0.2;
        const d = 70 + ((i * 37) % 90);
        return { x: Math.cos(a) * d, y: Math.sin(a) * d - 30, c: CONFETTI[i % CONFETTI.length]!, r: (i * 53) % 360, s: 5 + (i % 3) * 2 };
      }),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-0">
      {bits.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-[2px]"
          style={{ background: b.c, width: b.s, height: b.s }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: b.x, y: b.y + 40, opacity: 0, rotate: b.r }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

const pct = (p: { label: Label; pCat: number }) => Math.round((p.label === "cat" ? p.pCat : 1 - p.pCat) * 100);
const cap = (l: string) => l[0]!.toUpperCase() + l.slice(1);

export function CuriosityLab() {
  const reduce = !!useReducedMotion();
  const [labels, setLabels] = useState<Record<string, Label>>({});
  const [withFix, setWithFix] = useState(false);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [fact, setFact] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const dogRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const resultEnd = useRef<HTMLDivElement>(null);
  const reduceScroll = useReducedMotion();
  // The verdict lands below the bins; bring it into view inside the scrolling panel.
  useEffect(() => {
    if (result) resultEnd.current?.scrollIntoView({ block: "nearest", behavior: reduceScroll ? "auto" : "smooth" });
  }, [result, reduceScroll]);

  const deck = withFix ? [...TRAIN_DECK, ...FIX_CARDS] : TRAIN_DECK;
  const allLabelled = deck.every((c) => labels[c.id]);

  const loadFact = useCallback(() => {
    let live = true;
    getFunFact().then((f) => live && setFact(f));
    return () => { live = false; };
  }, []);
  useEffect(() => loadFact(), [loadFact]);

  const assign = (id: string, to: Label | null) => {
    setResult(null);
    setSelected(null);
    setLabels((l) => {
      const n = { ...l };
      if (to) n[id] = to; else delete n[id];
      return n;
    });
  };

  const hit = (el: HTMLElement | null, x: number, y: number) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const drop = (id: string, x: number, y: number) => {
    if (hit(catRef.current, x, y)) assign(id, "cat");
    else if (hit(dogRef.current, x, y)) assign(id, "dog");
    else if (hit(trayRef.current, x, y)) assign(id, null);
  };

  const tapSelect = (id: string) => setSelected((s) => (s === id ? null : id));

  const train = () => {
    const ev = evaluate(labels, withFix);
    setResult(ev);
    if (ev.stage === "shortcut" || ev.stage === "fixed") sessionStore.getState().award("curiosity.first-model");
    if (ev.stage === "fixed") sessionStore.getState().award("curiosity.shortcut");
  };

  const reset = () => {
    setLabels({});
    setWithFix(false);
    setResult(null);
    setSelected(null);
  };

  const renderCard = (c: Card) => (
    <CardView key={c.id} card={c} reduce={reduce} selected={selected === c.id} onSelect={() => tapSelect(c.id)} onDrop={(x, y) => drop(c.id, x, y)} />
  );

  const bin = (label: Label, ref: React.RefObject<HTMLDivElement | null>) => {
    const inBin = deck.filter((c) => labels[c.id] === label);
    return (
      <div
        ref={ref}
        role="group"
        aria-label={`${cap(label)} bin`}
        onClick={() => { if (selected) assign(selected, label); }}
        className={`min-h-28 flex-1 rounded-xl border border-dashed p-2 ${selected ? "border-accent/70 bg-white/5" : "border-white/20"}`}
      >
        <div className="mb-1.5 flex items-center justify-between text-[14px] text-bone">
          <span><span aria-hidden>{label === "cat" ? "🐱" : "🐶"} </span>{cap(label)}</span>
          <span className="font-mono text-[13px] tabular-nums text-ash">{inBin.length}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">{inBin.map(renderCard)}</div>
        {selected && (
          // A real button, so keyboard and switch users can place cards too.
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); assign(selected, label); }}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-white/15 text-[13px] text-bone transition-[background-color] duration-150 hover:bg-white/5"
          >
            Put it in {cap(label)}
          </button>
        )}
      </div>
    );
  };

  const tray = deck.filter((c) => !labels[c.id]);
  const predictions = result && (result.stage === "shortcut" || result.stage === "fixed") ? result.predictions : null;

  return (
    <section aria-label="Train the cat/dog AI" className="glass pointer-events-auto relative max-h-[calc(100dvh-11rem)] w-[26rem] max-w-full overflow-y-auto p-4">
      <h2 className="font-display text-xl text-bone">Train the cat/dog AI</h2>
      <p className="mt-1 text-[14px] text-ash">Sort each animal into the right bin. Drag it, or tap a card and then a bin.</p>

      <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
        <div
          ref={trayRef}
          onClick={() => { if (selected && labels[selected]) assign(selected, null); }}
          className="min-h-14 rounded-xl bg-white/5 p-2"
          aria-label="Unlabelled animals"
          role="group"
        >
          {tray.length ? <div className="flex flex-wrap gap-1.5">{tray.map(renderCard)}</div> : <p className="text-[14px] text-ash">Every animal is sorted.</p>}
        </div>

        <div className="mt-2 flex gap-2">
          {bin("cat", catRef)}
          {bin("dog", dogRef)}
        </div>

        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <Btn variant="primary" disabled={!allLabelled} onClick={train}>Train my AI</Btn>
          <Btn onClick={reset}>Start over</Btn>
          {!allLabelled && <span className="text-[13px] text-ash">Sort every animal first.</span>}
          {result?.stage === "fixed" && !reduce && <Confetti />}
        </div>

        <div aria-live="polite">
          {result?.stage === "mislabeled" && (
            <p className="mt-3 rounded-xl bg-white/5 p-3 text-[14px] text-bone">
              Some examples are in the wrong bin: {result.wrongLabels.join(", ")}. Your AI learns exactly what you show it.
            </p>
          )}

          {predictions && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {predictions.map((p) => (
                <li key={p.card.id} className="flex min-h-11 items-center gap-2 rounded-xl bg-white/5 px-3 text-[14px] text-bone">
                  <span aria-hidden className="text-lg">{p.card.emoji}</span>
                  <span>{p.card.name}</span>
                  <span className="ml-auto text-ash">Your AI says: {cap(p.label)} {pct(p)}%</span>
                  <span className={p.correct ? "text-signal" : "text-alarm"}>
                    <span aria-hidden>{p.correct ? "✓ " : "✗ "}</span>{p.correct ? "right" : "wrong"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {result?.stage === "shortcut" && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3">
              <h3 className="font-display text-lg text-bone">Your AI found a shortcut</h3>
              <p className="mt-1 text-[14px] text-bone">
                Every cat you showed it was orange and every dog was brown, so it learned &ldquo;orange means cat&rdquo;. Kitsune is an orange
                dog, so it guessed wrong. It isn&apos;t broken. It learned exactly what the examples taught.
              </p>
              <Btn variant="primary" className="mt-2" onClick={() => { setWithFix(true); setResult(null); }}>Add two new examples</Btn>
            </div>
          )}

          {result?.stage === "fixed" && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3">
              <h3 className="font-display text-lg text-bone">Fixed with better data, not a cleverer AI</h3>
              <p className="mt-1 text-[14px] text-bone">
                The AI is the same. The examples changed. That is why who and what is in a dataset matters.
              </p>
              <p className="mt-1 text-[14px] text-accent">The Ethics node in the skill tree is now open.</p>
            </div>
          )}
          <div ref={resultEnd} aria-hidden />
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/5 p-3">
          <p className="flex-1 text-[14px] text-bone"><span className="text-ash">Fun fact: </span>{fact ?? "Looking one up..."}</p>
          <Btn className="px-3 text-[14px]" onClick={() => { setFact(null); loadFact(); }}>Another</Btn>
        </div>
      </div>
    </section>
  );
}
