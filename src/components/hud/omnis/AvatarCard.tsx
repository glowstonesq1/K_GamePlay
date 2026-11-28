"use client";

import { AVATARS, AVATAR_IDS } from "@/domain/omnis/avatars";
import { SKILLS, SKILL_IDS, accessoriesOwned, type AccessoryId } from "@/domain/omnis/skills";
import { gameStore, useGame } from "@/state/gameStore";

const accName = (a: AccessoryId) => SKILL_IDS.map((id) => SKILLS[id]).find((s) => s.accessory === a)?.accessoryName ?? a;

export function AvatarCard() {
  const avatarId = useGame((s) => s.avatarId);
  const owned = useGame((s) => s.owned);
  const equipped = useGame((s) => s.equipped);
  const gear = accessoriesOwned(owned);
  const avatar = avatarId ? AVATARS[avatarId] : null;

  return (
    <section aria-label="Your explorer" className="glass pointer-events-auto w-[22rem] max-w-full p-4">
      <h2 className="font-display text-xl text-bone">Your explorer</h2>
      {!avatar ? (
        <div className="mt-3">
          <p className="text-[15px] text-ash">Pick an explorer</p>
          <div className="mt-2 flex flex-col gap-2">
            {AVATAR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => gameStore.getState().chooseAvatar(id)}
                className="min-h-11 rounded-xl border border-white/10 px-3 py-2 text-left transition-[background-color,border-color] duration-150 hover:border-white/25 hover:bg-white/5"
              >
                <span className="block text-[15px] text-bone">{AVATARS[id].name}</span>
                <span className="block text-[13px] text-ash">{AVATARS[id].blurb}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="font-display text-3xl text-bone">{avatar.name}</p>
          <p className="text-[15px] text-ash">{avatar.blurb}</p>

          <div className="mt-4 text-[13px] text-ash" id="avatar-change">Change</div>
          <div role="radiogroup" aria-labelledby="avatar-change" className="mt-1.5 flex flex-wrap gap-2">
            {AVATAR_IDS.map((id) => {
              const on = id === avatarId;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => gameStore.getState().chooseAvatar(id)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] transition-[background-color,border-color,color] duration-150 ${
                    on ? "border-accent bg-accent-soft text-bone" : "border-white/10 text-ash hover:border-white/25 hover:text-bone"
                  }`}
                >
                  {on && <span aria-hidden>✓</span>}
                  {AVATARS[id].name}
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-[13px] text-ash">Gear</div>
          {gear.length === 0 ? (
            <p className="mt-1.5 text-[15px] text-ash">Unlock skills to earn gear.</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {gear.map((a) => {
                const on = equipped.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    onClick={() => gameStore.getState().toggleAccessory(a)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] transition-[background-color,border-color,color] duration-150 ${
                      on ? "border-accent bg-accent-soft text-bone" : "border-white/10 text-ash hover:border-white/25 hover:text-bone"
                    }`}
                  >
                    {on && <span aria-hidden>✓</span>}
                    {accName(a)}
                    <span className="sr-only">{on ? ", worn" : ", not worn"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
