# Large Map Plan

> **Phase 1 status: COMPLETE.** World dims, camera tracking, group cohesion leash, hero spawn at world centre, world-space input, and background viewport culling are all live.
>
> **Runtime context:** The game runs on **Phaser 3** via a Canvas 2D bridge. All rendering writes to `G.ctx` (a Phaser `CanvasTexture`); Phaser's built-in camera system does not apply to this canvas. `G.camera` is the authoritative camera — do not replace it with `this.cameras.main`. Do not edit or recreate `src/main.js` — it is deleted.

---

## Architecture Notes (read before touching camera or rendering code)

| Layer | What it is | File |
|---|---|---|
| Phaser scene | Game loop, resize events, input wiring | `src/phaser/scenes/GameScene.js` |
| Canvas texture bridge | `G.ctx` → `CanvasTexture` → single Phaser `Image` | `GameScene.create()` |
| World camera | Manual `G.camera = {x, y}` — **not** `this.cameras.main` | `GameScene._updateCamera()` |
| Rendering | Canvas 2D draws into `G.ctx`; world block wrapped in `ctx.translate(-G.camera.x, -G.camera.y)` | `GameScene._draw()`, `src/render/*.js` |
| Screen-space UI | Drawn **after** `ctx.restore()` — never affected by camera | HUD, ability panel, overlays |

Screen → World: `wx = screenX + G.camera.x`, `wy = screenY + G.camera.y`
World → Screen: `sx = wx - G.camera.x`, `sy = wy - G.camera.y`

---

## Invariants (do not break)

- `G.W / G.H / G.PLAY_BOTTOM` = screen (CSS) dimensions. Never use these for world-space spawning or world-size checks.
- `G.WORLD_W = G.W * 3`, `G.WORLD_H = G.PLAY_BOTTOM * 3` — world dimensions.
- All entity `x, y` are world-space floats.
- `state.mouse.x/y` stays screen-space; convert to world at point-of-use with `+ G.camera.x/y`.
- Move markers, particles, floatingTexts, loot, projectiles are all stored in world space.
- The HUD / ability panel / overlays are screen-space — drawn outside the world transform block.

---

## Completed Phases (Phase 1)

### Phase A — Globals & world size ✅
`src/globals.js` — `camera: {x,y}`, `WORLD_W`, `WORLD_H`, `TILE`, `COLS`, `ROWS` added.
`GameScene._syncG()` — sets all world dims each resize.

### Phase B — Hero spawn in world centre ✅
`GameScene._startNewGame()` — heroes spawn at `(WORLD_W/2, WORLD_H/2)`; camera snapped immediately.

### Phase C — Camera update (per frame) ✅
`GameScene._updateCamera(realDt)` — lerp toward hero centroid (fast when moving, slow when idle), clamped to world bounds. Called each frame.

Fast/slow lerp:
```js
const anyMoving = living.some(u => u.moving);
const lerp = Math.min(1, realDt * (anyMoving ? 18 : 6));
```

### Phase D — World-space draw transform ✅
`GameScene._draw()` — world draws wrapped in `ctx.save() / ctx.translate(-G.camera.x, -G.camera.y) / ctx.restore()`. Screen-space draws (HUD, overlays) outside.

### Phase E — Background generation for world size ✅
`src/state.js generateTerrain()` — uses `WORLD_W/WORLD_H`. `src/render/background.js` — draws directly with viewport culling (no offscreen cache; GPU canvas size limit).

### Phase F — Input: screen → world coords ✅
`src/phaser/systems/InputSystem.js` — all pointer events convert to world coords via `+ G.camera.x/y`. `_clampToLeash()` uses hero destinations (`tx/ty`) to prevent heroes from being commanded more than one viewport apart. `GameScene._enforceGroupCohesion()` runs each frame to pull destinations back toward group centroid.

---

## Known Pending Bugs (not yet fixed — low priority until Phase G lands)

These three places use `G.W/G.PLAY_BOTTOM` where they should use world-space coords. They are inside the world-transform draw block so they render at the wrong position on large maps.

| Location | Current (wrong) | Should be |
|---|---|---|
| `GameScene._startNewGame()` line ~402 — helicopter spawn | `x: G.W/2` | `x: G.WORLD_W/2` |
| `GameScene._startNewGame()` line ~403 — helicopter target | `targetX: G.W/2, targetY: G.PLAY_BOTTOM*0.38` | `targetX: G.WORLD_W/2, targetY: G.WORLD_H*0.38` |
| `GameScene._checkEndConditions()` line ~407 — extraction move marker | `x: G.W/2, y: G.PLAY_BOTTOM/2` | `x: G.WORLD_W/2, y: G.WORLD_H/2` |
| `GameScene.advanceWave()` line ~437 — wave move marker | `x: G.W/2, y: G.PLAY_BOTTOM/2` | `x: G.WORLD_W/2, y: G.WORLD_H/2` |
| `GameScene._startNewGame()` line ~144 — dev spawn fallback | `rand(80, G.W-80)` | `rand(80, G.WORLD_W-80)` |

Fix all five in the same commit as Phase G.

---

## Phase G — Helicopter: arrives near heroes + off-screen arrow

**Goal:** Helicopter flies to a point near the hero centroid at extraction time, not a fixed world-centre. While the helicopter is off-screen, a directional arrow on the screen edge shows the player where to go.

### Helicopter spawn & landing target

Fix the pending world-coord bugs above, then:

```js
// In _checkEndConditions() when allWavesCleared:
const cx = living.reduce((s,u) => s + u.x, 0) / living.length;
const cy = living.reduce((s,u) => s + u.y, 0) / living.length;
state.helicopter = {
  x:       cx,          y: -80,          // spawns above current hero position
  targetX: cx,          targetY: cy - 80, // lands ~80px north of group
  flightState: 'flying', boarded: new Set(), radius: 68,
};
```

The landing point should be clamped to world bounds:
```js
targetX: clamp(cx, 80, G.WORLD_W - 80),
targetY: clamp(cy - 80, 80, G.WORLD_H - 80),
```

### Off-screen directional arrow

Drawn in **screen space** (after `ctx.restore()`), only when helicopter is not visible in the viewport.

**Algorithm:**
1. Convert helicopter world pos to screen: `sx = heli.x - G.camera.x`, `sy = heli.y - G.camera.y`.
2. If `sx` is in `[0, G.W]` and `sy` is in `[0, G.PLAY_BOTTOM]`, skip (visible).
3. Otherwise, find where the ray from screen centre to `(sx, sy)` intersects the screen edge rectangle.
4. Draw a chevron/arrow at the intersection point, rotated to point toward `(sx, sy)`.
5. Optionally: show distance in metres alongside the arrow.

**File:** Draw in `GameScene._draw()` in the screen-space block, or in a new `drawHeliArrow(ctx, heli)` helper in `src/render/effects.js`.

**State check:** `state.helicopter && state.helicopter.flightState !== 'gone'`.

---

## Phase H — Obstacles: tile grid, rendering, movement blocking

**Goal:** Add impassable terrain tiles (buildings, water, mountain) that block hero and enemy movement.

### Tile data (already designed)

`state.terrain` is a `Uint8Array(COLS * ROWS)`:
- `0` = ground (walkable)
- `1` = water (impassable)
- `2` = building/mountain (impassable)

Helpers in `src/utils/terrain.js` (new file):
```js
export function terrainAt(wx, wy) {
  const col = Math.floor(wx / G.TILE);
  const row = Math.floor(wy / G.TILE);
  if (col < 0 || col >= G.COLS || row < 0 || row >= G.ROWS) return 2;
  return state.terrain[row * G.COLS + col];
}
export function isWalkable(wx, wy) { return terrainAt(wx, wy) === 0; }

export function nearestWalkable(wx, wy) {
  // BFS outward from tile containing (wx,wy)
  // Returns world-space centre of nearest walkable tile
}
```

### Map generation

**Chosen approach: Procedural noise (Approach 1).**

Algorithm in `src/state.js → generateTerrain()`:
1. Seeded integer-hash noise sampled at each tile centre (two octaves).
2. Threshold: `> 0.62` → building/mountain, `< 0.22` → water, else ground.
3. 3×3 majority-filter pass (cellular automata) to smooth single-tile pockets.
4. Clear 5-tile radius around world-centre spawn point.
5. Flood-fill from spawn — carve corridors to any unreachable ground tile.

**Phase 2 option (later):** If `public/assets/maps/map_{difficulty}.png` exists, read pixel colours instead of generating. Procedural remains fallback.

### Hero movement blocking

In `Unit.moveTo(tx, ty)`: clamp destination to nearest walkable tile using `nearestWalkable`.
Per-frame in `Unit.update()`: if the hero's current path step enters an impassable tile, stop and call `nearestWalkable` on their position.

Blink interaction:
- Teleport arc passes through obstacles freely.
- Landing position: if non-walkable, `nearestWalkable(landX, landY)`.

### Enemy navigation — chosen approach: **flow field**

**Decision:** Enemies use a per-frame flow field, not per-enemy A*.

**Why not A* per enemy:** At 40+ enemies, even a 48×27 grid A* per enemy per frame is too expensive. Flow field amortises cost across all enemies.

**Why not steering-only (ignore obstacles):** Enemies get permanently wedged in concave obstacles. Flow field solves this cleanly.

**Flow field algorithm:**
1. Once per frame (or when heroes move more than 1 tile), run a BFS/Dijkstra from the **hero centroid tile** outward across all walkable tiles.
2. Each tile stores a direction vector pointing toward the shortest walkable path to the centroid.
3. Each enemy reads the vector for their current tile each frame and steers toward it.
4. Cost: O(COLS × ROWS) BFS ≈ O(1296 tiles at 3× 1080p) — trivially fast.

**Implementation:**
```js
// state.flowField = new Float32Array(COLS * ROWS * 2)  // [dx, dy] per tile
// Rebuilt in GameScene._updateFlowField() called from _updateWorld()
// Enemy reads: const idx = (row * COLS + col) * 2; vx = flowField[idx], vy = flowField[idx+1]
```

**Files:**
- `src/utils/terrain.js` — `buildFlowField(targetWx, targetWy)` returns `Float32Array`.
- `GameScene._updateWorld()` — calls `buildFlowField` when needed; stores in `state.flowField`.
- `src/entities/Enemy.js` — movement reads from `state.flowField` instead of direct `targetX - x`.

**Spawn validation:** When spawning an enemy, pick a tile on the world edge that is walkable (`terrainAt` check). If not walkable, try adjacent edge tiles.

---

## Phase I — Visual terrain rendering

**Goal:** Make obstacles visually distinct. All terrain rendering is in Canvas 2D (no WebGL shaders yet — see Phase J).

### Ground
Unchanged from current sandy/brown style. Decorative debris and cracks already fill the world.

### Water tiles
Cannot be pre-baked (animated). Drawn each frame inside the world transform, before entities:
```js
// In drawBackground() or a new drawWaterTiles() called from GameScene._draw()
for each water tile in viewport:
  const t = state.time;
  const shimmer = 0.65 + 0.15 * Math.sin(t * 2.1 + col * 0.8 + row * 1.3);
  ctx.fillStyle = `rgba(40, 80, 140, ${shimmer})`;
  ctx.fillRect(wx, wy, TILE, TILE);
```

Viewport culling: only iterate tiles visible in `[G.camera.x, G.camera.x + G.W]` × `[G.camera.y, G.camera.y + G.PLAY_BOTTOM]`.

### Building/mountain tiles
Pre-baked into the static background cache. Draw as:
- Dark base fill (`#2a2a2a`).
- Top-edge highlight (2px lighter strip) for a fake raised look.
- Optional: cast shadow offset (4px down-right at `rgba(0,0,0,0.4)`).

Tile edges: hard edges for first pass. Later a 2-bit neighbour mask can blend borders.

---

## Phase J — Custom visual effects via Canvas 2D and Phaser pipelines

**Goal:** Richer visual treatments for ground, buildings, water without a full WebGL rewrite.

### Why not standard GLSL shaders directly

The game renders through a `CanvasTexture` bridge. The CanvasTexture is a single Phaser `Image` GameObject. Per-terrain-type WebGL shaders would require either:
- Moving terrain rendering out of `G.ctx` and into Phaser GameObjects (large refactor), **or**
- Applying a post-FX pipeline to the whole image (affects everything, not per-tile).

### Practical approach (three layers)

**Layer 1 — Canvas 2D animated effects (per tile, in world transform block)**
- Water: sin-wave shimmer (Phase I above).
- Ground cracks: animated dust particles already exist.
- Building windows: pulsing glow rects drawn over building tiles (fake "lights on" effect).

**Layer 2 — Phaser post-FX pipeline (full-screen, screen space)**
Phaser 3.60+ supports custom GLSL post-processing on any `GameObject` via `setPostPipeline`. Apply to the `_renderImg` (the CanvasTexture image):
```js
// In GameScene.create():
this._renderImg.setPostPipeline(CRTPipeline);  // already done
this._renderImg.setPostPipeline(VignetteDistortPipeline);  // new
```
This is appropriate for global effects: scanlines (already exists), colour grading, screen-edge vignette distortion, heat shimmer.

**Layer 3 — Separate Phaser WebGL GameObjects for specific terrain (optional, later)**
Add a Phaser `RenderTexture` or `TileSprite` behind `_renderImg` for pure-WebGL water animation. Scroll it by reading `G.camera.x/y` each frame to match the world transform. The CanvasTexture's G.ctx would leave those tile areas transparent.
This is a significant architectural step — defer until Phase J is validated.

**Files:**
- `src/phaser/pipelines/` (new folder) — GLSL pipeline classes.
- `GameScene.create()` — register pipelines with `this.renderer.pipelines.addPostPipeline(...)`.
- `src/render/background.js` — animated tile effects (Layers 1).

---

## Out of Scope (current phases)

- Mini-map.
- Chunked terrain streaming.
- Per-enemy A* pathfinding.
- Line-of-sight / fog of war.
- Hero pathfinding (heroes currently click-to-move directly; obstacles clamp destination).
- Full WebGL per-tile shader layer (Layer 3 above).
