# Phaser 3 Port Plan

> **STATUS: COMPLETE.** The Phaser port is the active runtime. `index.html` loads `src/phaser/game.js`. The old vanilla Canvas 2D entry (`src/main.js`) has been deleted.
>
> **⚠️ CRITICAL NOTE FOR AGENTS:** This doc was previously mislabelled "REJECTED" and stored under `docs/rejected/`. That caused an entire session of wasted work editing vanilla-canvas files that were never loaded. Do NOT edit `src/main.js` — it no longer exists. All game code runs through `src/phaser/game.js` → `GameScene.js`.

Port `P-RAY: The Game` from vanilla Canvas 2D + Vite to **Phaser 3**.

---

## Key Phaser 4 Facts (vs 3)

| Topic | Phaser 4 behaviour |
|---|---|
| Renderer | WebGL only (Canvas deprecated). `Phaser.WEBGL` in config. |
| Import | `import Phaser from 'phaser'` → resolves to `dist/phaser.esm.js` via package `exports` map. Works with Vite out of the box. |
| Scene API | Identical to Phaser 3: `create()`, `update(time, delta)`, `this.scene`, `this.input`, `this.sound`, etc. |
| Graphics | `Phaser.GameObjects.Graphics` still exists with same API. New `pathDetailThreshold` option (perf hint, not required). |
| Geometry | `Geom.Point` removed → use `Phaser.Math.Vector2` or plain `{x,y}`. Our `utils/math.js` already uses plain `{x,y}`, so no change needed. |
| Math | `Phaser.Math.TAU` is now `PI*2` (corrected from v3's wrong `PI/2`). Irrelevant to us — we use native JS `Math`. |
| Tint | `setTintFill()` removed → `setTint(c).setTintMode(Phaser.TintModes.FILL)`. Only relevant if we tint sprites later. |
| Masks | `BitmapMask` removed → `Mask` filter. Not used in this game. |
| Sound | Same `WebAudioSoundManager` API as v3. |
| Input | Same `InputPlugin` API as v3: `pointerdown`, `pointermove`, keyboard keys. |
| Scale | Same `Phaser.Scale.RESIZE` + `Phaser.Scale.CENTER_BOTH`. |
| `roundPixels` | Defaults to `false` in v4 (was `true` in v3). Fine for this game. |

---

## Guiding Principles

- Keep game logic files (`config/`, `state.js`, `utils/`) as-is — zero DOM/Canvas coupling.
- Replace the rendering layer (raw Canvas 2D calls) with Phaser `Graphics` objects initially.
- Replace the custom `requestAnimationFrame` loop in `main.js` with Phaser's `update(time, delta)`.
- Replace the Web Audio layer (`systems/audio.js`) with Phaser Sound Manager.
- Keep the modular file structure; change only what each file imports/exports.

---

## Phase Map

| # | Phase | Goal | Status |
|---|---|---|---|
| 0 | Scaffold | Phaser boots, blank scene visible, `npm run dev` works | ✅ DONE |
| 1 | State + Config | Game state and config wired into `GameScene` | ✅ DONE |
| 2 | Input | Mouse select, drag-box, right-click, keyboard | ✅ DONE |
| 3 | Rendering | Canvas 2D bridge via CanvasTexture; all existing render code works unchanged | ✅ DONE |
| 4 | Game Loop | Time-flow, wave spawning, win/loss in `update()` | ✅ DONE |
| 5 | HUD + Menu | Scene stack: MenuScene, HUDScene, PauseScene, VictoryScene, GameOverScene | ✅ DONE |
| 6 | Audio | Web Audio → Phaser Sound Manager | ✅ DONE |
| 7 | Polish | Camera shake, Phaser particle emitters, tweens, per-entity Graphics | ✅ DONE (DPR fix) |

### Architecture note (Phases 0–7)

Phases 0–5 were completed together. Key discovery: the existing render code (background, effects, entity `draw(ctx)`) is dense Canvas 2D with gradients, shadows, and composite ops that don't map to Phaser Graphics. Rather than rewriting ~2000 lines of drawing code, we use a **CanvasTexture bridge**:

- `this.textures.createCanvas('game-layer', W*dpr, H*dpr)` creates a CanvasTexture at physical pixel dimensions.
- `G.ctx = canvasTex.getContext(); G.ctx.scale(dpr, dpr)` points the existing render pipeline at that canvas; drawing coordinates stay in CSS pixel space.
- A full-screen `this.add.image(0,0,'game-layer').setDisplaySize(W,H)` displays the rendered frame at CSS size each tick.
- `canvasTex.refresh()` uploads the canvas pixels to the GPU texture after each draw pass.
- All existing render files (`render/background.js`, `render/effects.js`, `render/hud.js`, entity `draw(ctx)`) work completely unchanged.
- Gradients, shadows, composite operations, `setLineDash` — all preserved.
- Physical-pixel canvas eliminates blurriness on retina / HiDPI displays (Phase 7 DPR fix).

**Phase 6 audio**: `src/systems/audio.js` (Web Audio API) was kept as-is — its lazy-init, variant-pool, cooldown, and synthetic-fallback logic are battle-tested. The Phaser scenes simply import `initAudio`, `playSfx`, and `playMusic` from it:
- `MenuScene._showTitle()` calls `initAudio()` + `playMusic('menu')`.
- `GameScene._startNewGame()` calls `playMusic('game')`.
- `VictoryScene.create()` and `GameOverScene.create()` call `playMusic('menu')`.

Future Phase 8+ can incrementally replace individual render routines with native Phaser Graphics for sprite injection / lighting support when needed.

---

## Phase 0 — Scaffold

**Goal**: Phaser 4 boots, renders a coloured background, `npm run dev` works.

Steps:
1. Create `src/phaser/game.js` — instantiates `Phaser.Game` and registers all scenes.
2. Update `index.html` to import `src/phaser/game.js` instead of `src/main.js`. Keep `src/main.js` untouched as a reference until port is complete.
3. `BootScene` preloads assets (audio manifest, any images/atlases), then transitions to `MenuScene`.
4. Confirm Vite HMR still works.

Phaser 4 game config:
```js
import Phaser from 'phaser';

const config = {
  type: Phaser.WEBGL,           // WebGL; Canvas renderer is deprecated in v4
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1208',
  scene: [BootScene, MenuScene, GameScene, HUDScene, PauseScene, VictoryScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

export default new Phaser.Game(config);
```

---

## Phase 1 — State + Config

**Goal**: `state.js`, `config/heroes.js`, `config/enemies.js`, `config/loot.js`, `config/waves.js`, `config/difficulty.js` imported into `GameScene` unchanged.

Steps:
1. Import `state` and `createInitialState` inside `GameScene.create()`.
2. Attach to `this.gameState` — no global `G` object.
3. Audit every `G.x` usage and replace:

| `globals.js` | Phaser 4 equivalent |
|---|---|
| `G.canvas` | `this.sys.canvas` |
| `G.ctx` | not needed (Phaser renders for you) |
| `G.W`, `G.H` | `this.scale.width`, `this.scale.height` |
| `G.PANEL_H` | constant in scene config |
| `G.PLAY_BOTTOM` | computed from scale |

4. `generateTerrain()` called in `GameScene.create()`, result stored on `this`.

---

## Phase 2 — Input

**Goal**: click to select survivor, drag-box, shift-click, right-click move/attack-move, keyboard abilities/pause/speed.

Phaser 4 tools (same API as v3):
- `this.input.on('pointerdown' | 'pointermove' | 'pointerup', handler)` for mouse.
- `this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)` for keys.
- Drag-box: track `pointerdown` position, draw a `Graphics` rectangle during drag, resolve on `pointerup`.

Port `src/systems/input.js` logic into an `InputSystem` class that receives the scene reference and registers listeners in its `init(scene)` method.

---

## Phase 3 — Rendering

**Goal**: every entity type visible on screen using `Phaser.GameObjects.Graphics`.

**Strategy (simple first pass)**: one persistent `Graphics` object per depth layer. Each frame: `graphics.clear()` then redraw everything. This is a 1-to-1 port of the current Canvas loop with minimal refactor risk.

Render layers and `setDepth` values:

| Layer | Depth | Contents |
|---|---|---|
| background | 0 | terrain, debris, vignette |
| loot | 10 | loot icons |
| enemies | 20 | enemy worm segments |
| units | 30 | survivor bodies |
| projectiles | 40 | thrown club, spray bullets |
| effects | 50 | particles, bolts, explosions, shockwaves |
| HUD | 60 | portraits, HP bars, wave counter (in HUDScene) |
| overlay | 70 | pause/victory/game-over overlays |

Render file mapping (old → new):

| Old | New | Change |
|---|---|---|
| `render/background.js` | `render/background.js` | Replace `ctx.*` with `graphics.*` calls |
| `render/units.js` | `render/units.js` | Same, draw to units `Graphics` |
| `render/enemies.js` | `render/enemies.js` | Same |
| `render/loot.js` | `render/loot.js` | Same |
| `render/effects.js` | `render/effects.js` | Same |
| `render/hud.js` | `render/hud.js` | Use `Phaser.GameObjects.Text` for numbers/labels; `Graphics` for bars and borders |

**Canvas 2D → Phaser 4 Graphics cheat-sheet:**

| Canvas 2D | Phaser 4 Graphics |
|---|---|
| `ctx.fillStyle = color` | `g.fillStyle(hexInt, alpha)` |
| `ctx.strokeStyle = color` | `g.lineStyle(width, hexInt, alpha)` |
| `ctx.fillRect(x,y,w,h)` | `g.fillRect(x,y,w,h)` |
| `ctx.strokeRect(x,y,w,h)` | `g.strokeRect(x,y,w,h)` |
| `ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill()` | `g.fillCircle(x,y,r)` |
| `ctx.beginPath(); ctx.moveTo / lineTo; ctx.stroke()` | `g.beginPath(); g.moveTo / lineTo; g.strokePath()` |
| `ctx.save() / restore()` | not needed — `fillStyle`/`lineStyle` set per call |
| `ctx.globalAlpha = a` | pass alpha into `fillStyle(color, alpha)` |
| `ctx.translate / rotate / scale` | use `g.translateCanvas / rotateCanvas / scaleCanvas` (or draw manually with trig) |
| `ctx.fillText(str, x, y)` | `this.add.text(x, y, str, style)` — Text game object, not Graphics |

**Color format**: Phaser `Graphics` takes hex integers (`0xff0000`), not CSS strings. Build a small helper in `utils/canvas.js`:
```js
export function cssToHex(css) {
  return parseInt(css.replace('#', ''), 16);
}
```

---

## Phase 4 — Game Loop

**Goal**: activity-driven time-flow, wave spawning, win/loss running inside Phaser's `update(time, delta)`.

```js
// GameScene.update(time, delta)
const dt = delta / 1000; // Phaser gives delta in ms; our systems expect seconds
updateTime(this.gameState, dt);
updateSpawning(this.gameState, dt);
updateUnits(this.gameState, dt);
updateEnemies(this.gameState, dt);
updateProjectiles(this.gameState, dt);
updateEffects(this.gameState, dt);
drawFrame(this.layers, this.gameState);
checkWinLoss(this);
```

`systems/time.js`, `systems/spawning.js`, `systems/combat.js`, `systems/abilities.js`, `systems/loot.js` are all pure logic — no DOM/Canvas coupling. Port by injecting `state` as a parameter instead of importing from `globals.js`.

Win/loss:
```js
if (state.gameOver) this.scene.start('GameOverScene');
if (state.victory) this.scene.start('VictoryScene');
```

---

## Phase 5 — HUD + Menu Scenes

**Goal**: proper Phaser scene stack for all UI states.

Scene list:

| Scene key | Purpose |
|---|---|
| `BootScene` | Preload assets, transition to `MenuScene` |
| `MenuScene` | Title screen, start button, difficulty picker |
| `GameScene` | Main gameplay loop |
| `HUDScene` | Runs in parallel with `GameScene` via `this.scene.launch('HUDScene')`. Owns portrait panel, HP bars, wave counter, score, HOW TO PLAY button. |
| `PauseScene` | Overlay: volume, resume, restart. Launched on top of `GameScene`. |
| `VictoryScene` | Victory video/overlay |
| `GameOverScene` | Defeat screen |

Running `HUDScene` in parallel keeps HUD code cleanly separated:
```js
// In GameScene.create():
this.scene.launch('HUDScene', { gameState: this.gameState });
```

Pass `gameState` as scene `init` data so the HUD can read HP, wave, score each frame.

---

## Phase 6 — Audio

**Goal**: replace `src/systems/audio.js` (Web Audio API) with Phaser 4 Sound Manager.

Phaser 4 sound API is unchanged from v3. Plan:

1. In `BootScene.preload()`, iterate `manifest.json` and `this.load.audio(key, path)` for each variant.
2. Create `src/phaser/systems/AudioSystem.js` wrapping `scene.sound` with the same `playSfx(event)` / `playMusic(track)` surface as the old `audio.js`.
3. Delete `src/systems/audio.js` once verified.

```js
// AudioSystem.js
export class AudioSystem {
  constructor(scene) { this.scene = scene; }
  playSfx(event, opts = {}) {
    const key = pickVariant(event);   // same variant-pool logic as before
    if (key) this.scene.sound.play(key, opts);
  }
  playMusic(track) { /* loop a music key */ }
}
```

---

## Phase 7 — Polish (ongoing)

- Camera shake on explosions: `this.cameras.main.shake(duration, intensity)`.
- Replace manual particle arrays with `Phaser.GameObjects.Particles.ParticleEmitter` for dust, blood, sparks.
- Tween-based floating texts: `this.tweens.add({ targets: textObj, y: y-40, alpha: 0, duration: 800 })`.
- Per-entity `Graphics` objects with `setDepth` for cleaner z-ordering (replaces single clear-redraw layers).
- Prepare for sprite injection (Phase 8 of original plan): drawing code lives in one method per entity, easy to swap for `Sprite`.

---

## Final File Layout

```
src/
  phaser/
    game.js                 # Phaser.Game config + scene list
    scenes/
      BootScene.js
      MenuScene.js
      GameScene.js
      HUDScene.js
      PauseScene.js
      VictoryScene.js
      GameOverScene.js
    systems/
      InputSystem.js
      TimeSystem.js
      AudioSystem.js
      SpawnSystem.js
      CombatSystem.js
      AbilitySystem.js
      LootSystem.js
    render/
      background.js         # Phaser Graphics, replaces render/background.js
      units.js
      enemies.js
      loot.js
      effects.js
      hud.js
  config/                   # UNCHANGED
  entities/                 # draw calls stripped; logic kept
  state.js                  # UNCHANGED
  utils/
    math.js                 # UNCHANGED
    canvas.js               # add cssToHex helper; ctx helpers become unused
```

Old `src/systems/` and `src/render/` files deleted once each has a Phaser equivalent.

---

## What Stays Exactly the Same

- `config/heroes.js`, `config/enemies.js`, `config/loot.js`, `config/waves.js`, `config/difficulty.js`
- `state.js`
- `utils/math.js`
- All logic inside `systems/combat.js`, `systems/abilities.js`, `systems/loot.js`, `systems/spawning.js`
- Entity stat/AI logic inside `Unit.js` and `Enemy.js` (strip drawing calls only)

---

## What Gets Replaced

| Old | New |
|---|---|
| `src/main.js` (bootstrap, rAF loop) | `GameScene.create()` + `GameScene.update()` |
| `globals.js` | Scene properties + `this.scale` |
| `render/*.js` (ctx calls) | `render/*.js` (Phaser Graphics calls) |
| `systems/input.js` | `InputSystem.js` using Phaser Input |
| `systems/audio.js` | `AudioSystem.js` using Phaser Sound |
| `systems/menu.js` | `MenuScene.js`, `PauseScene.js` |
| `systems/time.js` | `TimeSystem.js` (loop removed, logic kept) |

---

## Risk / Decision Log

| Topic | Decision |
|---|---|
| Renderer type | `Phaser.WEBGL` — Canvas is deprecated in v4, no reason to use it |
| Single Graphics layer vs per-entity | Single clear-redraw layer first (Phase 3); per-entity in Phase 7 |
| `globals.js` | Removed; scene properties replace all `G.*` references |
| Audio timing | Phaser Sound respects browser autoplay rules the same way the old Web Audio layer did — initialize after first user interaction |
| `wasteland_survivors-v4.html` | Never touched; permanent single-file reference |
| `src/main.js` | Kept as reference; `index.html` entry switches to `src/phaser/game.js` in Phase 0 |
