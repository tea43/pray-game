# Performance Improvements

## Completed

### Background static layer cache (`src/render/background.js`)
Ground gradient, soil mottling, soil patches, cracks, and debris are rendered once to an offscreen canvas when terrain generates and reused each frame via `drawImage`. Dynamic content (blood stains, grass sway, embers, dust, vignette) still draws every frame on top. Cache is invalidated by `clearBackgroundCache()`, called from `GameScene` after `generateTerrain()` and on resize.

### Remove `shadowBlur` from bolt and floating-text rendering (`src/render/effects.js`)
`ctx.shadowBlur` forces a full software blur pass in Canvas 2D — the single most expensive per-call operation. Replaced bolt outer glow with two stacked low-opacity thick strokes (lineWidth 30 and 14). Replaced per-junction radial gradient spark nodes with solid `arc` fills. Removed `shadowBlur` from floating damage numbers (the 1 px dark offset already provides contrast).

### DPR cap at 2× (`src/phaser/scenes/GameScene.js`)
`window.devicePixelRatio` capped at 2 so 3× screens upload at most a 4× pixel canvas rather than 9×. One-line change: `Math.min(window.devicePixelRatio || 1, 2)`.

### Remove `shadowBlur` from shockwave ring (`src/render/effects.js`)
Replaced `shadowBlur 18` on the shockwave stroke with a wide low-opacity outer stroke (lineWidth 14, alpha 0.25) to simulate the halo.

### Particle emission throttle (`src/phaser/scenes/GameScene.js`, `src/render/effects.js`)
Walking dust and shockwave sparks are skipped when `state.particles.length >= 350`. Prevents unbounded particle growth during multi-shockwave + lightning moments.

---

## Remaining — ordered by estimated impact

### 1. Migrate rendering off the Canvas 2D → CanvasTexture bridge
**Root cause of all CPU overhead.** The entire game is drawn to a `CanvasTexture` via Canvas 2D, then uploaded to the GPU as a texture every frame via `_canvasTex.refresh()`. On a Retina display (DPR 2×) that is a 4× pixel count upload per frame (~2600 × 1400 = 3.6 M pixels). Canvas 2D itself has no GPU acceleration.

Fix: migrate entities, particles, and effects to native Phaser WebGL objects (sprites, graphics, particle emitters). The static background cache already moves most background cost off the hot path; the remaining GPU upload cost is proportional to how much content remains in Canvas 2D.

Files: `src/phaser/scenes/GameScene.js`, all `src/render/*.js`, entity `draw()` methods.

### 2. Particle object pooling
Every particle is pushed as a fresh object literal onto `state.particles` and removed with `Array.filter` (which allocates a new array) every frame. At peak (lightning + shockwave) this creates several hundred allocations per second and puts sustained pressure on the GC.

Fix: fixed-size typed pool. Pre-allocate N particle slots; reuse dead slots instead of push/filter.

Files: `src/systems/` (new pool module), `src/phaser/scenes/GameScene.js` (_updateWorld loop).

### 3. Per-frame `createRadialGradient` for embers and grass bloom
`drawBackground()` still calls `ctx.createRadialGradient()` per ember and per grass tuft every frame during the additive bloom pass. These can be replaced with a small pre-rendered sprite (a white circle with `filter: blur` applied once offline, or drawn to an offscreen canvas at startup) and drawn with `ctx.globalAlpha` + `ctx.drawImage`.

Files: `src/render/background.js`.

### 4. `createRadialGradient` for additive particles (`drawParticles`)
Same pattern as embers: one gradient object created per additive particle per frame. Replace with a pre-rendered radial sprite drawn via `ctx.drawImage`.

Files: `src/render/effects.js`, `drawParticles()`.

### 5. DPR cap
`window.devicePixelRatio` is used directly, meaning 3× screens upload a 9× pixel canvas each frame. Capping at 2× halves the upload cost for high-DPR devices with negligible visual difference at game scale.

Files: `src/phaser/scenes/GameScene.js` (`this._dpr = Math.min(window.devicePixelRatio || 1, 2)`).

### 6. Particle emission throttle under load
When many enemies die simultaneously (boss fight), particle emission stacks across shockwave, explosions, and unit deaths. Add a soft cap: if `state.particles.length` exceeds a threshold (e.g. 400), skip low-priority emitters (walking dust, shockwave sparks).

Files: `src/phaser/scenes/GameScene.js` (_updateWorld walking dust block), `src/render/effects.js` (drawShockwaves sparks).

### 7. `shadowBlur` in remaining draw calls
Still present in:
- `drawShockwaves` — `shadowBlur 18` on shockwave ring stroke (fires per active shockwave per frame)
- `_drawWaveAnnouncements` — `shadowBlur 12` on boss wave text (brief, low priority)
- `_drawHelicopter` — `shadowBlur 6` on board prompt text (brief, low priority)
- `_drawExtractionBanner` — `shadowBlur 8` on extraction text (brief, low priority)

The shockwave one is the only hot-path item worth fixing now; the others are shown for seconds total across a full run.
