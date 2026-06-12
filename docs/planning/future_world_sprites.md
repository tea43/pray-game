# World Sprites & Environment Objects

Planned feature: replace the procedural Canvas 2D terrain with authored sprite-based world objects — buildings, walls, barricades, cover objects — with occlusion transparency and collision surfaces.

> **Status update (2026-06):** An interim **procedural** version of goals 2–3 now ships inside the Canvas 2D bridge: `src/render/buildings.js` renders post-soviet buildings (panelka/brick/industrial) on rectangular impassable footprints, with painter-sort occlusion and hero-triggered alpha fade — no WebGL migration required. The occlusion-fade pseudocode below is implemented nearly verbatim (`updateBuildingOcclusion`). This doc remains the plan for the eventual *authored-sprite* version (goals 1 and 4: PNG assets and cover mechanics).

---

## Goals

1. **Custom art** — buildings and large props use authored PNG/sprite-sheet assets rather than procedural drawing.
2. **Hero occlusion** — when a unit walks behind a building, the building fades to ~40% alpha so the unit remains visible.
3. **Impenetrable surfaces** — certain objects block enemy and unit movement (walls, collapsed structures).
4. **Cover** — units behind low walls get a defence modifier; bullets/projectiles are blocked.

---

## Architecture

### Why this must wait for the Canvas 2D → WebGL migration

The current renderer draws everything — units, enemies, effects — to a single `CanvasTexture` via a 2D context. There is no concept of Z-ordered independent objects; everything is depth-sorted manually by Y and painted in one pass.

To do per-object alpha fade on occlusion, a building must be an independent Phaser `Image` or `Sprite` object sitting in the Phaser scene graph above the unit layer. That requires:

- Units rendered as Phaser `Sprite` objects (or at minimum drawn via a layer system that supports Z-ordering against world objects).
- World objects as `Phaser.GameObjects.Image` in a dedicated `worldObjects` layer.

Until the Canvas 2D bridge is replaced, buildings would have to be rendered inside the same 2D pass, making occlusion detection and alpha control per-building impossible without significant bookkeeping.

**Prerequisite: complete item #1 in `docs/bugs/performance_improvements.md`** (migrate rendering to native Phaser WebGL).

---

## Planned layer order (bottom → top)

| Layer | Contents |
|-------|----------|
| `bgLayer` | Static terrain sprite (baked from `background.js` output) |
| `stainLayer` | Blood stains (rendered to a RenderTexture, stamped on death) |
| `groundDecalLayer` | Debris, cracks (baked at game start) |
| `worldObjects` | Buildings, walls — Z-sorted by Y of their base edge |
| `shadowLayer` | Soft drop-shadows under units and world objects |
| `unitLayer` | Units, enemies — Phaser Sprites, depth-sorted by Y |
| `projectileLayer` | Bullets, bolts |
| `fxLayer` | Particles, shockwaves, explosions |
| `hudLayer` | HUD, ability panel |

World objects sit between ground and units. At render time, any unit whose Y > building.baseY and whose X overlaps the building footprint triggers alpha fade on that building.

---

## Occlusion fade

```
// pseudocode — runs in update, not draw
for (const obj of worldObjects) {
  const occluded = units.some(u =>
    !u.dead && u.y > obj.baseY &&
    Math.abs(u.x - obj.x) < obj.occlusionWidth / 2
  );
  const target = occluded ? 0.38 : 1.0;
  obj.alpha += (target - obj.alpha) * Math.min(1, dt * 8); // smooth fade
}
```

No per-pixel depth test is needed — a simple bounding-box Y-threshold is sufficient at this game's scale.

---

## Collision surfaces

Two types:

- **Hard block** (`solid: true`) — enemies and units cannot enter. Stored as axis-aligned rectangles in `state.solidRects`. Movement system checks against these before applying position update (already partially structured via `state.cracks` / terrain generation).
- **Low cover** (`cover: true`) — units can stand behind it, enemies cannot pass. Bullets and bolts are blocked. Units behind cover gain `+coverBonus` to defence (config value, e.g. `0.3`).

Both types are authored per-asset in a `worldObjects.json` config alongside sprite dimensions and anchor points.

---

## Asset format

```json
{
  "id": "ruined_wall_a",
  "sprite": "/assets/sprites/world/ruined_wall_a.png",
  "anchor": [0.5, 1.0],
  "baseYOffset": 0,
  "occlusionWidth": 80,
  "solid": true,
  "cover": false,
  "collisionRects": [{ "x": -38, "y": -22, "w": 76, "h": 22 }]
}
```

---

## Relationship to performance work

The layer migration (performance item #1) and world sprites are the same architectural change — switching from a monolithic Canvas 2D draw pass to a Phaser scene graph with discrete layers. They should be planned and implemented together, not sequentially.

Suggested approach: implement the layer system first with the existing procedural background, then start placing world-object sprites into the new `worldObjects` layer before replacing the Canvas 2D unit rendering.
