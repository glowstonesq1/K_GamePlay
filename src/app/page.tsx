import { Scene } from "@/components/scene/Scene";
import { Hud } from "@/components/hud/Hud";

export default function Page() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-void">
      <Scene />
      <Hud />
    </main>
  );
}
