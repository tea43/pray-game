# P-RAY — Implementation Notes

Source: modular `src/` (served via `npm run dev`). The legacy single-file `wasteland_survivors-v4.html` has been removed.

---

## 0. Runtime Architecture (read this first)

**The game runs on Phaser 3.** Do not be misled by old docs or the presence of vanilla-Canvas-style code in `src/render/` and `src/entities/` — those files are still used but via a bridge.

| Layer | File | Role |
|---|---|---|
| Entry point | `index.html` → `src/phaser/game.js` | Phaser `Game` instance + scene list |
| Main scene | `src/phaser/scenes/GameScene.js` | Game loop, camera, draw dispatch |
| Input | `src/phaser/systems/InputSystem.js` | All mouse + keyboard handling |
| Canvas bridge | `GameScene._draw()` via `G.ctx` | Phaser `CanvasTexture` wraps a Canvas 2D context; existing render code writes to `G.ctx`; `refresh()` uploads to GPU each frame |
| Shared logic | `src/entities/`, `src/config/`, `src/state.js`, `src/render/`, `src/systems/` (minus deleted vanilla files) | Zero Phaser dependency — used by both scene and shared code |

**What was deleted (do not recreate):**
- `src/main.js` — the old vanilla `requestAnimationFrame` loop; never loaded
- `src/systems/input.js` — vanilla event listeners; only imported by main.js
- `src/systems/menu.js` — vanilla menu wiring; only imported by main.js
- `src/render/units.js`, `src/render/enemies.js`, `src/render/loot.js`, `src/utils/canvas.js` — empty Phase 4 stubs

**World / camera:**
- `G.WORLD_W = G.W * 3`, `G.WORLD_H = G.PLAY_BOTTOM * 3` — world is 9× screen area
- `G.camera = {x, y}` — top-left of viewport in world space; updated each frame in `GameScene._updateCamera()`
- Screen → world: `wx = screenX + G.camera.x`, `wy = screenY + G.camera.y`
- All entity positions are world-space; `_draw()` applies `ctx.translate(-G.camera.x, -G.camera.y)` before drawing entities

---

## Retrospective: How agents got confused (2025-05)

An agent session spent hours editing `src/main.js` and `src/systems/input.js` — neither of which were loaded by the game — because:

1. `docs/rejected/phaser_port_plan.md` was mislabelled **REJECTED** when the port was actually complete and active.
2. `docs/index.md` had no mention of the real entry point.
3. `src/main.js` still existed alongside `src/phaser/game.js`, looking like the real entry.
4. `implementation_notes.md` (this file) referenced `frame()` — a function from the deleted vanilla loop.

**How to avoid repeating this:** The entry-point warning is now the first thing in `docs/index.md`. The phaser port doc is in `executed/`. `src/main.js` is deleted. If you ever see a file named `src/main.js` in this repo, it was incorrectly recreated — delete it.

---

Definition tables live in `src/config/`:

- `src/config/heroes.js` — `HERO_DEFS`
- `src/config/enemies.js` — `ENEMY_DEFS`
- `src/config/loot.js` — `LOOT_DEFS`
- `src/config/waves.js` — `WAVE_DEFS`

Run `node scripts/check-game-data.js` after changing those definitions. It validates the core hero, enemy, loot, and wave configuration.

---

## 1. Active Pause

The game uses an **activity-driven time-flow system** rather than a simple boolean pause.

### State fields (line ~2161)

| Field | Type | Purpose |
|---|---|---|
| `state.timeFlow` | `float 0..1` | Current game speed multiplier (smoothly animated) |
| `state.manualPause` | `bool` | Set when SPACE forces time to x0 |
| `state.timeSpeed` | `int 0..3` | Forced speed level from `+` / `-`; x0 pauses, x1/x2/x3 advance time even when idle |
| `state.gameOver` | `bool` | Suppresses flow regardless |

### Game loop logic (`frame()`, ~line 2893)

```js
const anyMoving = state.units.some(u => !u.dead && u.moving);
const targetFlow = state.gameOver || state.manualPause ? 0
                 : state.timeSpeed > 0 ? state.timeSpeed
                 : anyMoving ? 1
                 : 0;
state.timeFlow += (targetFlow - state.timeFlow) * Math.min(1, realDt * 12);
const gameDt = realDt * state.timeFlow;
```

- **Time only flows when at least one survivor is moving** (i.e. has a destination further than 2.5px from current position — see `Unit.moving` getter).
- Or when the player has forced speed with `+`: x1, x2, or x3. Forced speed advances time even when survivors are idle.
- `timeFlow` interpolates toward the current target speed at a rate of `12× per second`, giving a smooth slow-down/resume feel rather than a hard cut.
- `gameDt` is applied to all gameplay (unit/enemy update, wave timer, loot pickup, explosions, shockwaves). `realDt` is used for UI-only effects (dust particles, move markers, bolts, loot bob animation, screen shake decay).

### Pause indicators

- HUD `#timeBar` element switches between `.flowing` (green dot) and `.paused` (amber dot) CSS classes.
- When `timeFlow < 1`, a purple translucent overlay is drawn over the play area. When `timeFlow < 0.5` (mostly paused), horizontal scan lines are added on top (`updateHUD` + draw section ~line 3189).

### Controls

- **SPACE**: forces time to x0.
- **+**: raises forced speed to x1, x2, then x3.
- **-**: lowers forced speed to x2, x1, then x0.
- **Moving a unit**: sets `unit.tx/ty`, which makes `unit.moving` true, which drives `targetFlow = 1`.
- Stopping all units (`S` key → `unit.stop()`) sets `tx = x, ty = y`, so `moving` becomes false immediately.

---

## 2. Character Drawing

Each of the three player characters (Elliot, Dick, Habib) is drawn entirely with Canvas 2D primitives — no sprite sheets.

### Draw dispatch (`Unit.draw()`, line ~518)

```
draw(ctx)
  → ground shadow ellipse
  → ability aura rings (blinkFlash, rageTimer)
  → selection indicator (pulsing ellipse + dashed path to target)
  → ctx.save() + ctx.translate(x, y + wobble)
       → _drawElliot / _drawDick / _drawHabib
  → ctx.restore()
  → Habib's ambient electric sparks (world-space)
  → _drawWeapon() → weapon-type dispatch
  → swing arc flash
  → HP bar
  → active weapon ring + countdown label
```

### Walk wobble

`const wobble = this.moving ? Math.sin(this.walkCycle) * 1.2 : 0;`

`walkCycle` increments at `9 rad/s` while moving. The body is translated ±1.2px vertically, giving a bob effect.

### Character-specific drawing

| Character | Body | Head | Weapon |
|---|---|---|---|
| **Elliot** | Pink shirt with floral pattern (acc1/acc2 ellipses + flower petals), shorts, skin face, straw hat with band | Hat brim ellipse + hatTop ellipse + dark eyes + small mouth arc | `longClub` (single long club, 40px, tape wrap near grip) |
| **Dick** | Bare muscular torso (skin with shade lines, abs rects, nipple dots), skinDark shorts | Baseball cap with a bill that **rotates with `this.facing`**, glowing red eyes during rage | `dualClubs` (two short clubs, alternating left/right per swing via `dualSide` flag) |
| **Habib** | White collared shirt with shadow sector + V-neck line, red shorts, exposed fist circles | Dark hair arc, plain dark eyes, static electric sparks at body edge when ability ready | `thrownClub` (two stub clubs in hands; front arm extends during `throwArm > 0`, smear when fully released) |

### Hurt flash

`flashBoost = this.hurtFlash > 0 ? this.hurtFlash : 0` — when non-zero, the shirt/skin fill color is overridden with a lighter tint (`#ffa090`, `#ffcaba`, etc.). `hurtFlash` decays at `5/s`.

### Mini-portraits in the ability panel

`drawAbilityPanel()` (line ~2745) calls the same `_drawElliot/_drawDick/_drawHabib` methods with `ctx.scale(0.65, 0.65)` at the portrait centre. Selection ring is suppressed by temporarily setting `u.selected = false`.

---

## 3. Fight System

### Unit auto-attack (`Unit.update()`, line ~265)

Each frame (per `gameDt`):
1. If the unit has an `aggroTarget` set (from a player right-click on an enemy) and it is within `atkRange + 40`, keep it. Otherwise auto-scan all enemies for the nearest one within `atkRange`.
2. If a target is within `atkRange` and `atkCd <= 0` → call `attack(target)`.

### `attack(enemy)` dispatch (line ~314)

| Condition | Behaviour |
|---|---|
| `activeWeapon === 'shotgun'` | Displayed as **Shotgun**. Fires 5 `ShotgunBullet` in a ±0.35 rad cone. Each bullet travels at 480 px/s up to 320 px. Damage = `atkDmg * 0.5`. `atkRate` = 1.10 s (5× slower than original 0.22 s). |
| `activeWeapon === 'samurai_sword'` | Instant AoE cleave: all enemies within 80 px and within 120° arc take `atkDmg` (×2.2 base), get knocked back 120 px/s, and receive gold spark particles. |
| `weaponType === 'thrownClub'` | Creates a boomerang-style `Projectile` that flies toward the target point, hits once on outbound collision, then returns to Habib and disappears when caught. |
| `weaponType === 'dualClubs'` | Toggles `dualSide`, applies melee damage + knockback directly. Rage doubles knockback (80 → 140) and particle count. |
| default (`longClub`) | Melee: direct `hp -= dmg`, knockback vector from `this.facing`. |

### Damage stats

| Character | Base dmg | Attack rate (s) | Range (px) |
|---|---|---|---|
| Elliot | 32 | 0.55 | 56 |
| Dick | 24 (×2 rage) | 0.34 (×0.4 rate during rage) | 36 |
| Habib | 36 | 0.90 | 220 |

`atkDmg` and `atkRate` are getters that multiply base values by rage/active weapon modifiers.

### Abilities

| Character | Key | Effect | Cooldown |
|---|---|---|---|
| Elliot | Q – BLINK | Teleports up to 240 px toward cursor. Leaves/arrives with particle puff + ring flash. | 6 s |
| Dick | W – RAGE | Sets `rageTimer = 5 s`. While active: ×2 dmg, ×0.4 atkRate (faster), ×1.75 knockback, red aura ring + glowing eyes. | 12 s |
| Habib | E – CHAIN LTG | Chains to up to 4 enemies within 200 px each. Each hit: 30 dmg + 1.8 s stun + small knockback. Renders a multi-segment zigzag bolt. | 8 s |

Abilities are triggered from the `keydown` handler via `unit.cast()` → `_blink/_rage/_chainLightning`.

### Enemy melee

Enemies move toward the nearest live unit. On contact (`d < r + target.r - 2`) with `dmgCd <= 0`:
- `target.hp -= this.dmg`
- `dmgCd = 0.75 s`
- 6 damage particles + screen shake

### Knockback

Applied as velocity on the enemy: `knockX/Y += force`. In `Enemy.update()` knockback decays exponentially (`decay = 0.001 ^ dt`), scaled by `kbResist` (bosses resist more: bigboss 0.18, miniboss 0.35).

---

## 4. Enemy Drawing

All enemies share `Enemy.draw()` (line ~1787) with per-`kind` branching.

### Shared structure

1. Shadow ellipse beneath.
2. Blinker telegraph target ring + dashed trace line (drawn in world space before the body).
3. Boss aura ellipse (miniboss orange-red, bigboss lime-green, pulsing).
4. Bigboss slam charge telegraph: shrinking yellow ring.
5. `ctx.save()` + `ctx.translate(x, y + wobble)` — wobble from `Math.sin(walkCycle)`, suppressed during stun.
6. **Body**: filled circle (`this.r`) in `this.color`, dark stroke, shadow sector.
7. **Face**: skin-tone head circle at `(0, -r*0.6)`, `r*0.5`.
8. **Eyes**: per-kind rectangles with varying colours/glow.
9. **Hair/head detail**: per-kind (see table below).
10. `ctx.restore()`.
11. Blinker: `ctx.globalAlpha = 0.78` for translucency while not blinking.
12. Bigboss: ambient radiation sparkle particles emitted per frame (25% chance).
13. Weapon stub drawn at `this.facing` angle (length/width scaled by kind).
14. Stun visuals: random zigzag lines + 3 orbiting star squares.
15. HP bar (always shown for bosses; only when damaged for regular enemies). Bosses also get a name label.

### Per-kind visual summary

| Kind | r | Color | Eyes | Head detail | Notes |
|---|---|---|---|---|---|
| `raider` | 9 | `#3a2515` (dark brown) | Dark rects | Curved hair arc | Legacy fallback for Worm Hatchling |
| `ghoul` | 10 | `#4a3a25` | Yellow rects | Ear-nub rects | Legacy fallback for Husk Crawler |
| `runner` | 8 | `#5a3a20` | Wide white + dark pupils | 5 spiked hair triangles | Legacy fallback for Dart Worm |
| `mutant` | 15 | `#3a4a2a` (green) | Glowing red squares | 3 upward spine triangles | Legacy fallback for Burrow Brute |
| `blinker` | 10 | `#3a2545` (purple) | Purple glowing squares | Dark hood arc + 3 rotating wisps | Legacy fallback for Phase Worm |
| `miniboss` | 22 | `#2a1a0a` | Orange glow | Dark skull cap, beard stripe, shoulder guard triangles, chest armour rect | Named "BROOD WARDEN"; orange HP bar |
| `bigboss` | 32 | `#2a3a1a` (dark green) | Green glow + inner white rects | 5 rotating energy lines, 5 crown spikes, V-shaped extra eyes | Named "ELDER WORM"; slam attack shockwave; radiation sparkles |

### Death

When `dead` and `deathTimer < 3`: renders a widening blood puddle ellipse that fades out. After 3 s the enemy is removed from the array.

---

## 5. Map Implementation

The map is a **single, static, procedurally-generated flat canvas** — no tiling, no scrolling.

### Canvas sizing

```js
function resizeCanvas() {
  canvas.width  = Math.floor(window.innerWidth  * 0.97);
  canvas.height = Math.floor(window.innerHeight * 0.97);
}
```

On window resize, `generateTerrain()` is re-called to re-scatter decorations at the new dimensions. The play area height is `H - PANEL_H - 24` (`PLAY_BOTTOM`), reserving space for the ability panel.

### `generateTerrain()` (`src/state.js`)

Builds the tile grid and the world decoration sets:

| Field | Contents |
|---|---|
| `state.terrain` | `Uint8Array[COLS×ROWS]` — 0 ground, 1 water (passable, slow), 2 building footprint (impassable) |
| `state.buildings` | Rectangular post-soviet buildings: `{x, y, w, h, baseY, style, extraUp, seed, alpha, litWindows, _cv}` |
| `state.roads` | Two walkable asphalt strips (1 horizontal + 1 vertical), decoration only |
| `state.waterTiles` | Water tile positions for the animated shimmer pass |
| `state.cloudShadows` | 6 drifting soft shadow blobs (seeds only; positions derived from `state.time`) |
| `state.debris` / `state.cracks` / `state.dust` / `state.grassTufts` / `state.embers` | Scatter decoration (counts scale with world area) |

Building placement: rectangular footprints 2–5 × 2–3 tiles, ~1.5 per screen of world area, rejected if within 2 tiles of water/another building, within 1 tile of a road, inside the 3-tile world edge band, or near the hero spawn circle. Footprint tiles are marked terrain type 2, so **all collision/pathfinding semantics are identical to the old "mountain" blobs** (`isWalkable`, flow field, `nearestWalkable` unchanged). Styles: `panelka` (concrete panel block, 42%), `brick` (khrushchyovka, 30%), `industrial` (hall with gates, 28%).

Debris types (`src/render/background.js`): **0** skull, **1** car tire, **2** weathered plank, **3** concrete chunk with rebar, **4** rusty barrel lid.

### `src/render/buildings.js` — post-soviet building renderer

- Each building's facade is rendered **once** into an offscreen canvas (lazy, `mulberry32(seed)` → deterministic), at up to 2× scale for DPR crispness. Per-frame cost is one `drawImage`.
- Facade = footprint height + `extraUp` px rising above the footprint top, plus a trapezoid roof (tar patches, vents, TV antenna). Windows are a grid of intact/lit/broken/boarded panes; panelki get accent-coloured balconies; bricks get plaster-loss patches and courses; industrial gets corrugated ribs, a high window strip, and rusted X-braced gates. Weathering (damp streaks, grime band, graffiti, cracks) and directional volume shading are overlaid.
- **Occlusion**: buildings are pushed into GameScene's painter Y-sort with `y = baseY`, so entities above the base edge draw first and are hidden behind the facade. `updateBuildingOcclusion()` fades a building to ~42% alpha when a living hero is inside the occluded band (smooth lerp, `realDt * 8`).
- Lit windows store world-space centres and get a flickering additive glow at draw time (skipped while faded).
- Ground shadows (`drawBuildingShadows`) are cast bottom-right and drawn at the end of `drawBackground()`, under all entities.

### `drawBackground()` (`src/render/background.js`)

All world-space, viewport-culled. Order (back to front):

1. **Ground gradient** — cold concrete-dust palette (`#45443a` → `#2a2922`).
2. **World-anchored tile detail** — per-tile hash decides mottling specks, oil/scorch stains, concrete rubble, and rare manhole covers; anchored to tile indices so it stays put as the camera moves.
3. **Roads** — asphalt body, worn edges, faded centre dashes, hash-anchored potholes and tar patches.
4. **Water** — murky flood pools with animated oily shimmer + sky glints.
5. **Cracks**, **blood stains**, **P-RAY grass tufts** (swaying), **dust**.
6. **Cloud shadows** — large radial blobs drifting across the ground (positions are stateless functions of `state.time`).
7. **Building ground shadows**.
8. **Bioluminescent grass glow** (additive).

### `drawScreenAtmosphere()` (screen-space, called from `GameScene._draw` after the camera block)

1. **Embers** — additive drifting sparks (updated in `GameScene._updateWorld`).
2. **Rolling fog** — 5 wide soft blobs drifting horizontally at different heights.
3. **Vignette** — cold radial darkening toward corners.
4. **Colour cast** — cold steel tint plus a faint warm band at the horizon.

### Wave & enemy spawning

Enemies spawn from all four edges (`spawnEnemy()`, line ~2238):
- A random edge is picked; a point is chosen along that edge with a 40 px margin outside.
- Kind is determined by a wave-gated probability table. Legacy IDs map to the P-RAY worm direction as: hatchlings always available; husk crawlers/dart worms at wave 2; phase worms at wave 3; burrow brutes at wave 4.
- `spawnTimer` starts at 1.5 s, refills to `spawnInterval × rand(0.7, 1.3)` after each spawn.
- `spawnInterval` starts at 1.4 s and shrinks 16% per wave (floor 0.30 s).
- Wave 3+: 35% chance of a second simultaneous spawn. Wave 6+: another 35% chance of a third.
- Bosses spawn from a narrower edge band (20–80% of edge length) via `spawnBoss()`.
- Wave advances every 22 game-seconds. Miniboss at every 4th wave; Bigboss at every 9th. Victory at wave 21 completion.
