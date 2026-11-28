"use client";

import { SKILLS, SKILL_IDS, resonance, skillState, type SkillPath } from "@/domain/omnis/skills";
import { gameStore, useGame } from "@/state/gameStore";
import { CheckIcon, LockIcon } from "../primitives";

const PATHS: { id: SkillPath; label: string }[] = [
  { id: "logic", label: "Logic" },
  { id: "ethics", label: "Ethics" },
  { id: "stealth", label: "Stealth" },
  { id: "creativity", label: "Creativity" },
];

const base =
  "flex min-h-11 w-full flex-col items-start gap-0.5 rounded-xl border px-2 py-2 text-left text-[13px] transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed";

export function SkillTreePanel() {
  const completed = useGame((s) => s.completed);
  const owned = useGame((s) => s.owned);
  const equipped = useGame((s) => s.equipped);
  const r = resonance(completed, owned);

  return (
    <section aria-label="Skill tree" className="glass pointer-events-auto w-[22rem] max-w-full p-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-xl text-bone">Skill tree</h2>
        <dl>
          <dt className="text-right text-[13px] text-ash">Resonance</dt>
          <dd className="text-right">
            <span className="font-mono text-[34px] leading-none tabular-nums text-accent">{r.available}</span>
            <span className="ml-2 font-mono text-[13px] tabular-nums text-ash">{r.earned} earned · {r.spent} spent</span>
          </dd>
        </dl>
      </div>

      <div className="mt-3 grid max-h-[60vh] grid-cols-4 gap-1.5 overflow-y-auto">
        {PATHS.map((p) => {
          const nodes = SKILL_IDS.map((id) => SKILLS[id]).filter((s) => s.path === p.id).sort((a, b) => a.tier - b.tier);
          return (
            <div key={p.id} className="flex min-w-0 flex-col items-stretch">
              <div className="mb-1.5 text-center text-[13px] text-ash">{p.label}</div>
              {nodes.map((s, i) => {
                const st = skillState(s.id, completed, owned);
                const worn = equipped.includes(s.accessory);
                return (
                  <div key={s.id} className="flex flex-col items-center">
                    {i > 0 && <div aria-hidden className="h-3 w-px bg-white/15" />}
                    {st.kind === "owned" ? (
                      <button
                        type="button"
                        aria-pressed={worn}
                        onClick={() => gameStore.getState().toggleAccessory(s.accessory)}
                        className={`${base} border-accent bg-accent-soft text-bone ring-1 ring-accent hover:brightness-110`}
                      >
                        <span className="flex items-center gap-1 text-accent"><CheckIcon done />{s.name}</span>
                        <span>{s.accessoryName}</span>
                        <span className="text-ash">{worn ? "Worn" : "Not worn"}</span>
                      </button>
                    ) : st.kind === "ready" ? (
                      <button
                        type="button"
                        onClick={() => gameStore.getState().unlockSkill(s.id)}
                        className={`${base} border-accent/60 bg-white/5 text-bone shadow-[0_0_18px_-6px_var(--world-accent)] hover:border-accent hover:bg-white/10`}
                      >
                        <span>{s.name}</span>
                        <span className="text-accent">Unlock · {s.cost}</span>
                      </button>
                    ) : (
                      <button type="button" disabled className={`${base} border-white/10 text-ash opacity-70`}>
                        <span className="flex items-center gap-1">{(st.kind === "gated" || st.kind === "sealed") && <LockIcon />}{s.name}</span>
                        <span>{st.kind === "short" ? `Need ${st.need} more Resonance` : st.reason}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
