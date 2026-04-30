# P-RAY — Future Design Discussion

Open questions and design considerations. Nothing here is committed to implementation — this is a planning scratchpad.

---

## 1. How to change the characters (8-sprite model)

### Current approach

Characters are drawn entirely with Canvas 2D primitives — arcs, rects, ellipses. Every visual detail (hat, shirt pattern, eyes, weapons) is hard-coded draw calls inside `_drawElliot`, `_drawDick`, `_drawHabib`. Palette colours are the only parameterised part.

### What "8 sprites" could mean

Typically a top-down character has 8 directional frames (N, NE, E, SE, S, SW, W, NW), possibly with walk cycle sub-frames. There are a few ways to integrate that:

**Option A — Full spritesheet replacement**
- Load a PNG spritesheet per character.
- In `Unit.draw()`, derive the facing octant from `this.facing` and the frame from `this.walkCycle`.
- Pros: richer visuals, artist-friendly, no code for each new character.
- Cons: requires a spritesheet per character at whatever resolution the canvas uses; scaling artefacts if canvas size varies. The current canvas is nearly full-window (97 vw/vh) so sprites need to be high-res or the art looks blurry with `crisp-edges` rendering.
- Migration: replace the `_drawElliot` / `_drawDick` / `_drawHabib` calls with a single `drawSprite(ctx, this.spritesheet, octant, frame)` helper. Everything else (HP bar, selection ring, ability aura, weapon) can stay as canvas primitives layered on top.

**Option B — Hybrid: sprite body + primitive overlays**
- Use a sprite only for the body/torso facing.
- Keep weapons, ability glows, HP bar, and selection indicators as canvas draw calls on top.
- Easier to author: a small 8-frame sprite at ~32×32 px looks fine at game scale, overlays handle the rest.

**Option C — Keep primitives, add directional facing**
- Currently Dick's cap bill rotates with `this.facing`, but the rest of the body doesn't.
- Full directional could be faked by: mirroring the draw (flip ctx horizontally when facing left) and drawing a facing indicator.
- Cheapest to implement, least visual fidelity.

### Questions to resolve
- What format is the "8 sprites model" — single PNG with grid layout, or separate files?
- Does each direction have multiple walk frames, or just one?
- Should ability effects (rage glow, blink flash) stay as primitives, or be part of the sprite?
- How does the canvas `97vw` sizing interact with fixed-size sprites? Need to decide on a pixel scale factor.

---

## 2. How to change the enemies

### Current approach

All 6 enemy kinds share one `Enemy` class with a constructor `if/else` block and one `draw()` method with per-kind branching. The lore direction is alien worms and snake-like worm mutations, but the current internal kind IDs are still legacy prototype names. Adding a new enemy means touching both blocks.

### Options

**Option A — Extend the existing class**
- Add another `else if (kind === 'new_enemy')` branch in the constructor and in `draw()`.
- Straightforward, keeps everything in one place.
- Gets unwieldy beyond ~8–10 types.

**Option B — Config object per kind**
- Extract stats into a lookup table: `const ENEMY_DEFS = { raider: { r: 9, speed: 48, hp: 30, ... }, ... }`.
- `Enemy` constructor does `Object.assign(this, ENEMY_DEFS[kind])`.
- Draw method still needs per-kind branching for visuals, but stats are decoupled.
- New enemies only need a config entry + a draw branch.
- Display names and sprite paths should come from an asset/content manifest so worm variants can be injected without editing behavior code.

**Option C — Sprite-based enemies (same as characters)**
- Replace per-kind draw code with spritesheet lookup.
- Uniform visual pipeline, easy to add new kinds without touching draw code.

**Option D — Subclasses**
- `class Mutant extends Enemy`, `class Blinker extends Enemy`, etc.
- Each subclass owns its `draw()` and any special `update()` logic (e.g. blinker's teleport is currently interleaved in the parent `update()` — a subclass would isolate it cleanly).
- Cleanest architecture, but a larger refactor.

### Special behaviours to consider
- Blinker's teleport logic is embedded in `Enemy.update()` with early returns — should stay isolated per enemy type.
- Bigboss's slam/shockwave is similarly embedded. As new boss variants are added this pattern will get difficult.
- A small `updateSpecial(dt)` hook that subclasses or config objects can override would help.

---

## 3. Can the map scroll? Moving along a generated map

### Current state

The map is a single flat canvas equal to 97% of the window. Enemies spawn from the edges. There is no concept of world coordinates vs camera — everything is in screen space.

### What a scrolling map would require

**Separation of world and screen space**
- Introduce `camera.x, camera.y` offset.
- Every draw call becomes `ctx.translate(-camera.x, -camera.y)` at the start of each frame (or wrap all world draws in a transformed `ctx.save()/restore()`).
- Unit and enemy positions become world coordinates. Spawning, collision, loot — all stay in world space.
- HUD, ability panel, overlays stay in screen space (drawn after `ctx.restore()`).

**Map generation**
- Instead of scattering debris across `W×H`, generate a much larger world (e.g. 5000×5000) with chunked terrain sections.
- Only draw chunks that overlap the current camera viewport.
- `generateTerrain()` would become a chunk-streaming function.

**Camera movement options**
- **Follow the centroid** of living units — camera tracks where the squad is.
- **Player-controlled pan** — camera moves when units are ordered to a location that approaches the edge.
- **Scripted scroll** — the map scrolls in a fixed direction (e.g. leftward like a side-scroller) and enemies advance from ahead of the camera.

**Enemy spawning on a scrolling map**
- Current edge-spawning works for a static map. On a scrolling map, enemies should spawn at the world-space "forward edge" of the camera (not just any edge).
- Existing enemies behind the camera could either be culled or kept alive off-screen.

**Feasibility**
- The core game loop already separates `gameDt` from `realDt`, so time control still works.
- The biggest change is making all positions world-relative and adding a camera transform. Mid-size refactor — probably 150–200 lines changed, mostly in `drawBackground()`, spawn functions, and the draw call in `frame()`.

---

## 4. Supporting different terrain types (water, buildings, etc.)

### Current terrain

One terrain type: flat sandy post-apocalyptic ground with decorative debris, cracks, and dust. No terrain affects movement or gameplay.

### Design questions

- **Visual only vs gameplay-affecting?**
  - Visual: different tile/zone colours and debris sets, no movement change. Easy to add.
  - Gameplay: terrain zones slow movement (swamp), block it (walls), or deal damage (fire). Requires collision detection against terrain, which the game currently doesn't have.

- **Tile-based vs zone-based?**
  - **Tile grid**: divide the world into e.g. 64×64 px cells, each with a terrain type. Simple lookup for movement modifiers. Predictable to generate.
  - **Zone polygons**: define irregular regions (e.g. a river as a polygon). More natural but harder to query efficiently.
  - Given the current code style (no spatial data structures), a tile grid is the most compatible extension.

- **Water**
  - Visual: animated blue tiles (sine-wave shimmer).
  - Gameplay option 1: blocks all movement (treat like walls in an RTS).
  - Gameplay option 2: slows movement by 60%, allows passage. Enemies crossing it are slowed too — changes tactics.
  - Gameplay option 3: instant-kill zone (lava variant). Adds map-reading skill.

- **Buildings / ruins**
  - Visual: darker tile + drawn wall segments.
  - Gameplay: line-of-sight blocking (projectiles can't pass through), cover positions, choke points.
  - Would require projectile collision against world geometry — currently projectiles only check against enemies.

- **Compatible path forward**
  - Add a `terrain` grid (`Uint8Array`) generated alongside `generateTerrain()`.
  - `drawBackground()` draws a coloured underlay based on terrain values before the debris layer.
  - `Unit.moveTo()` and enemy movement check terrain cost (a multiplier on `speed`).
  - Start with 2 types: walkable / impassable. Water and buildings can both be impassable initially, with visuals differentiating them.

---

## 5. Improving the enemy system and loot system

### Enemy system

**Variety**
- Current 6 types cover basic archetypes. Missing: a **ranged enemy** (throws something), a **shielder** (blocks from one direction), a **healer** (buffs nearby enemies).
- Adding a ranged enemy would reuse the existing `Projectile` class — just fire from enemy toward a unit.

**Boss mechanics**
- Bigboss has one special: the slam shockwave. A second phase (at 50% HP) with a different attack pattern would raise the skill ceiling.
- Boss-specific telegraphing is good (the shrinking ring before slam). More animations could cue the next attack type.

**Difficulty scaling**
- Currently only spawn rate and enemy mix change per wave. Could also scale enemy HP and damage.
- A `waveScale` multiplier on `maxHp` and `dmg` would be simple and impactful.

**Formation behaviour**
- Enemies currently rush independently. Adding simple flocking (separation, cohesion) would make groups feel more organic and tactical. Even a cheap version (push enemies apart when overlapping) would help visually.

**Persistence across waves**
- Enemies left alive at wave end currently persist into the next wave. This is intentional but worth verifying it's a design choice: it creates pressure to clear the board before the timer ticks.

### Loot system

**Current state**
- 5 types: medkit (heal 60 HP), stimpack (trigger 5 s rage + -2 s ability CD), bomb (AoE kill), spray_gun (15 s rapid-fire), samurai_sword (20 s cleave).
- Drop is immediate on unit walk-over, no confirmation needed.
- No loot is persistent across waves — it despawns or gets picked up.

**Possible improvements**

- **Loot persistence / backpack**: dropped loot stays on the ground between waves. Players could decide to hold off engaging so loot doesn't get used at the wrong moment. Currently loot is picked up automatically on contact with no player agency.

- **More consumable types**
  - Armour shard: reduce incoming damage for N seconds.
  - Speed boost: movement speed ×1.5 for 8 s (useful for positioning).
  - Flashbang: stun all on-screen enemies for 2 s.

- **Loot economy**: currently all loot is applied to whoever walks over it. A more deliberate system: clicked loot goes to the selected unit, or prompts a choice.

- **Visual polish**: a brief floating text on pickup is already implemented for medkit (`+heal`) and stimpack (`RAGE`). All loot types could show a text pop.

- **Enemy-type specific drops**: currently the burrow brute/phase worm legacy types have a special weapon drop roll. Could extend this: dart worms drop speed boosts, husk crawlers drop medkits slightly more. This reinforces the "learn enemy behaviour to predict rewards" loop.

- **Loot expiry**: items left too long could despawn with a flashing warning. Creates urgency and prevents loot hoarding from trivialising waves.
