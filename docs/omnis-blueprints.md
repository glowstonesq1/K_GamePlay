# OMNIS: blueprints for the four sealed universes

The Multiverse Hub, the avatar system, the skill tree and the first universe are built and playable. The first universe, the Cosmic Observatory, contains all of COGNITERRA. The four other portals are sealed, and this page specifies them. To build one, say "Execute <universe> blueprint".

## Contract for every universe

Each universe plugs into the same spine. A universe that skips any of these steps is not finished.

1. **Register the universe.** Set `playable: true` on its entry in `src/domain/omnis/universes.ts`. The portal unseals, and `travelUniverse` and `enterUniverse` accept it.
2. **Keep the domain pure.** Domain code lives in `src/domain/<universe>/` as pure functions, with a unit test for every rule the player can see. If the code is wrong, the lesson is wrong.
3. **Add objectives.** They go in `src/domain/objectives.ts`. Resonance comes only from objectives, so there is no other way to reward the player.
4. **Add a skill gate.** Add or open a node in `src/domain/omnis/skills.ts` whose `gate` is one of the new objectives. Opening a sealed node means replacing `gate: null`. A new tier extends `SKILL_IDS`, `ACCESSORY_IDS` and `Avatar.tsx`.
5. **Give it a scene.** Put it in `src/components/universes/<Name>.tsx`, mount it once, and toggle an `active` flag rather than unmounting. This is the React 19 and drei `<Html>` constraint described in `CosmicHub.tsx`.
6. **Add a debrief.** Each universe gets a pure `xxxLesson(state) → Lesson | null`, rendered by `PedagogyNote`.
7. **Offer two ways in.** Each universe gets an Architect mode and a Curiosity mode through the existing ECHO toggle. Curiosity mode is hands-on, involves no maths, and still teaches one true thing.
8. **Stay within the security envelope.** The site is a static export under a strict CSP (`connect-src 'self'`). No runtime fetches to other sites; data ships in the bundle. Any user-typed input (the Citadel's mini shell, the Atelier's code editor) is parsed by our own code. It never goes through `eval`, `new Function` or `innerHTML`.

---

## The Neon Citadel: cybersecurity (magenta `#ff3fd8`)

**Visual theme**
- **Setting:** a rain-slick night city seen from a rooftop, at miniature scale. Low-poly towers trace their outlines in magenta and cyan neon, and puddles reflect the signage. It's cyberpunk in tone but readable: three districts, each a different layer of the stack (Network docks, Application row, Human quarter).
- **Camera:** a slow 3/4 orbit. Night fog hides everything beyond the current district.

**Core gameplay loop: "Trace the breach"**
1. **The alert.** An alert fires: "Customer database leaked at 02:14".
2. **Follow the trail.** The player walks a courier drone through the districts, following packets: glowing particles moving along street-level cables.
3. **Read the evidence.** At each building they open a log terminal, a mini shell with 6 whitelisted commands (`ls`, `cat`, `grep`, `whois`, `ping`, `history`). The shell is parsed by our own code and nothing executes. The logs hold the clues: a phishing email, a reused password, an unpatched upload form.
4. **Reconstruct the attack.** The player places the evidence on a kill-chain board: phish → credential → lateral move → exfiltration. A correct chain replays the attack as a cinematic of packets lighting up the route.
5. **Harden the city.** The player then chooses one fix per link: MFA, patch, network segmentation, egress filter. The attack is replayed against the hardened city, and every link that held blinks shut.

**Curiosity mode: "Spot the phish"**
- Five emails float as paper planes, and the player taps the fake ones. Each reveals the clue they missed: a look-alike domain, urgency, or a link whose visible text doesn't match its destination.

**RPG integration**
- **Skill node:** opens `stealth-1` (Stealth, 150) by setting its gate to `citadel.killchain`.
- **Accessory:** the Shadow hood (`shadow-hood`, already modelled on the avatar).
- **Objectives:**
  - `citadel.killchain` (+150): reconstruct the attack chain.
  - `citadel.harden` (+100): stop the replayed attack.
  - `citadel.phish` (+50): Curiosity mode.

**Tech implementation notes**
- **City:** instanced towers (`<Instances>` from drei). Neon uses emissive strips at HDR values, so the existing Bloom picks them up. Rain is a GPU particle shader with velocity stretched along y.
- **Packet routes:** `CatmullRomCurve3` along street splines, with particles placed by `curve.getPointAt(t)`.
- **Terminal:** a DOM overlay with our own tokenizer, whitelisted commands only, and output rendered as text nodes. A test asserts unknown input returns "command not found" and nothing else.
- **Kill-chain board:** reuse the drag-and-tap pattern from `CuriosityLab` (motion drag with hit-testing, plus a tap fallback).
- **Pedagogy guard:** never show working exploit code. The lesson is detection and defence; attacks appear only as replays of logs.

---

## The Voxel Foundry: data structures and algorithms (green `#7dff6a`)

**Visual theme**
- **Setting:** a voxel workshop floating in a green-lit void. Every data structure is a physical voxel build:
  - An array is a row of numbered crates on a conveyor.
  - A stack is a spring-loaded tube.
  - A queue is a turnstile.
  - A binary search tree is a scaffold that grows branches.
  - A graph is a set of islands linked by rope bridges.
- **Style:** chunky and toy-like, with soft ambient occlusion. Cartoon rather than Minecraft: no textures, just flat-shaded voxels with a 1-pixel darker edge.

**Core gameplay loop: "Build it, then race it"**
1. **The order.** A work order arrives, for example "Find crate #42 among 1,000".
2. **The build.** The player picks a structure and builds it voxel by voxel: insertions animate crates sliding into place.
3. **The race.** Two robots run the same query on two structures side by side, for example linear scan versus binary search on a sorted array, or BST lookup versus list lookup. A step counter ticks above each robot. The player watches O(n) lose to O(log n) in real time, then scales n up with a slider until the gap is undeniable.
4. **The breaking point.** A degenerate case is in the deck on purpose: inserting sorted data turns the BST into a stick. The player sees lookup collapse back to O(n) and unlocks "self-balancing" (one rotation animation, AVL-style) to fix it.

**Curiosity mode: "Line up the robots"**
- The player sorts eight robots by height using only "swap two neighbours", which is bubble sort by hand.
- A step counter shows how many swaps it took, then a second machine does the same job with merge sort in fewer steps.

**RPG integration**
- **Skill node:** adds a new Logic tier, `logic-3` ("Algorithmic logic", 250), gated by `foundry.balance`.
- **Accessory:** the Voxel gauntlet (`voxel-gauntlet`, a new entry in `ACCESSORY_IDS` and `Avatar.tsx`).
- **Objectives:**
  - `foundry.race` (+120): win a race by choosing the faster structure.
  - `foundry.balance` (+150): rebalance a degenerate BST.
  - `foundry.robots` (+50): Curiosity mode.

**Tech implementation notes**
- **Voxels:** one `InstancedMesh` per material, up to about 20k cubes. Positions come from a pure `layout(structure)` function in `src/domain/dsa/`. The algorithm steps are generators (`function* binarySearch`) that yield states, so the animation and the step counter come from the same source of truth, and tests assert exact step counts.
- **Physics:** `@react-three/rapier` only for juice (crates bouncing on insert). It never decides an algorithm's outcome.
- **Graphs:** BFS and DFS as generators. Bridges light up in visit order, and a visited-set HUD shows the frontier.
- **The "Godot voxel" idea in R3F:** chunked greedy meshing is unnecessary at this scale, so instancing is simpler and fast enough. Revisit only if a level needs more than 50k voxels.

---

## The Paper Atelier: creative coding (orange `#ff9f43`)

**Visual theme**
- **Setting:** a paper-craft studio. Layered cut-paper planes with soft drop shadows, a cork wall, and a desk lamp casting warm light.
- **Art:** the player's art appears on paper sheets pinned to the wall, as a live canvas texture on a plane.
- **Style:** 2.5D cartoon with hand-cut edges, using a noise-displaced outline shader.

**Core gameplay loop: "Loops that draw"**
1. **The prompt card.** A card shows a target image: concentric circles, a spiral, a grid of jittered squares, a flow field.
2. **Program with blocks.** The player builds a tiny program from blocks (`repeat n`, `move`, `turn`, `color`, `random`, `noise`) that snap together like paper tabs.
3. **Watch it draw.** Each run animates a paper turtle drawing the result stroke by stroke.
4. **Score it.** A match score compares the drawing to the target using pixel IoU on a downsampled raster. The lesson: one loop with one changing parameter makes most of the patterns people call "generative art".
5. **Advanced levels.** These unlock seeded randomness: the same seed gives the same art, and a different seed gives a sibling. Then Perlin-style noise: why noise looks natural where `random()` looks like TV static.

**Curiosity mode: "Paint with rules"**
- The player picks three rules from cards ("every stroke turns 10° more", "colours cycle", "stop at the edge") and watches the turtle paint.
- There is no target to match: the goal is to make something they like and pin it to the wall.

**RPG integration**
- **Skill node:** opens `creativity-1` (Creativity, 150) by setting its gate to `atelier.spiral`.
- **Accessory:** the Prism crown (`prism-crown`, already modelled on the avatar).
- **Objectives:**
  - `atelier.spiral` (+120): match the spiral target at IoU ≥ 0.8.
  - `atelier.seed` (+80): reproduce a friend's art from its seed.
  - `atelier.rules` (+50): Curiosity mode.

**Tech implementation notes**
- **Interpreter:** blocks compile to a tiny instruction list run by our own interpreter in `src/domain/creative/turtle.ts`. It's pure, step-limited to 10k operations, and tested. The output goes to an `OffscreenCanvas` that feeds a `CanvasTexture`, so `eval` and user JavaScript are never involved.
- **Paper look:** `meshStandardMaterial` on extruded `Shape` geometry with a small random z-offset per layer, plus a contact-shadow plane (drei `<ContactShadows>`).
- **Noise:** a seeded 2D value-noise function in the domain, shared with the scoring raster so what you see is what is scored.

---

## The Lantern Library: everyday tech literacy (parchment `#f4e4c1`)

**Visual theme**
- **Setting:** a warm, candle-lit library at dusk. Tall shelves, floating lanterns, and a reading table under a skylight. It's the calmest universe on purpose, aimed at people who say "I'm not a tech person".
- **The books:** each topic is a book on a lectern that opens into a small 3D diorama.

**Core gameplay loop: "Follow the lantern"**
- Each book is a short interactive diorama with one hands-on question:
  1. **How a web page reaches you.** Carry a lantern (a packet) from the laptop, through the router and DNS ("the library index card"), to the server and back. Wrong turns are allowed, and the lantern goes out.
  2. **Passwords.** Build a password from word tiles and watch a meter estimate guesses-to-crack. The meter is a real entropy estimate in the domain, never a fake bar. Then see why four random words beat `P@ssw0rd!`.
  3. **What "the cloud" is.** Zoom from a phone photo to a real building full of computers.
  4. **Cookies and tracking.** A mock shop follows a paper-doll shopper from shelf to shelf. Toggle cookie consent and watch which shelves can still "see" them.
  5. **Spotting misinformation.** Three headlines, each with a "check the source" magnifier.
- Each book closes with a single "teach it back" card: the player picks the sentence that best explains it to a friend.

**Curiosity mode**
- This universe is already Curiosity-first. Its Architect mode adds the numbers: packet hops and latency, entropy in bits, cookie lifetimes.

**RPG integration**
- **Skill node:** adds a new Ethics tier, `ethics-3` ("Civic ethics", 250), gated by `library.five-books`.
- **Accessory:** the Lantern (`lantern`, a new accessory: a small glowing lantern hanging from the avatar's hand).
- **Objectives:**
  - `library.packet` (+60)
  - `library.password` (+60)
  - `library.cookies` (+60)
  - `library.five-books` (+120): finish all five.

**Tech implementation notes**
- **Lighting:** warm light comes from point lights capped at 4, with lantern glow from additive sprites (reuse the halo texture from `CosmicHub`).
- **Accessibility first:** every diorama has a DOM text twin, the book's own page, readable by screen readers and keyboard-navigable. This universe is the one most likely to be used by people with assistive tech.
- **Password meter:** a pure `estimateGuesses(pw)` in `src/domain/literacy/` with tests. The password never leaves the page and is never stored or persisted.

---

## Build order

1. **The Lantern Library.** It's the cheapest (dioramas plus DOM, no new physics), it widens the audience the most, and it adds the Ethics tier 3 the tree already has room for.
2. **The Voxel Foundry.** The generator-based algorithm domain is straightforward to test, and the instanced voxels are cheap.
3. **The Neon Citadel.** It needs the most content design (realistic but safe logs) and its own security review of the mini shell.
4. **The Paper Atelier.** Its interpreter and scoring raster are the most engineering, and it pays off once players have Resonance to spend on Creativity.
