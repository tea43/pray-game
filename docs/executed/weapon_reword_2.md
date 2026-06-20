# Weapon Sprite Visibility Rework (Rework 2)

**Status:** Planned
**Author:** Claude (review of `src/render/weaponSprites.js`)
**Goal:** Make held/thrown weapon sprites large and legible. Right now they render as tiny smudges next to the heroes and are hard to identify.

---

## 1. Problem Statement

Weapons are drawn from `WEAPON_SPRITES` (16 entries) as 16×16 pixel-art grids via `fillRect` in
[weaponSprites.js](../src/render/weaponSprites.js). In game they are drawn at small scales (`1.4` default), held at `reach = this.r * 0.7 ≈ 9px` from a hero whose body radius is only `this.r = 13`. The net effect: the weapon reads as a ~10px blob roughly **a third the size of the hero**, and the silhouette is unreadable.

### Measured evidence — "dead padding" inside each 16×16 grid

The actual drawn weapon ("ink") occupies only a fraction of its 16×16 grid. Measured ink bounding boxes:

| Weapon | Type | Ink bbox | Grid fill | On-screen @ scale 1.4 |
|---|---|---|---|---|
| bottle_cap_shuriken | thrown | 7×7 | 19% | ~10×10 px |
| contraceptive_catapult | ranged | 8×8 | 25% | ~11×11 px |
| radiator_rib | melee | 6×13 | 30% | ~8×18 px |
| pickle_jar | thrown | 8×11 | 34% | ~11×15 px |
| courtyard_railgun | ranged | 13×7 | 36% | ~18×10 px |
| bus_stop_pole | melee | 6×16 | 38% | ~8×22 px |
| plastic_chair | melee | 8×13 | 41% | ~11×18 px |
| shower_hose | melee | 7×15 | 41% | ~10×21 px |
| frozen_cutlet | thrown | 14×9 | 49% | ~20×13 px |
| chain_with_padlock | melee | 10×13 | 51% | ~14×18 px |
| bike_spoke_slingshot | ranged | 12×11 | 52% | ~17×15 px |
| extension_cord | melee | 11×13 | 56% | ~15×18 px |
| bed_spring_arbalest | ranged | 14×11 | 60% | ~20×15 px |
| toilet_lid | melee | 14×12 | 66% | ~20×17 px |
| fence_wire_bow | ranged | 12×15 | 70% | ~17×21 px |
| car_antenna | melee | 15×15 | 88% | ~21×21 px |

Reference: a hero body is ~26px tall (`2 × r`), ~30px including head. **Half the weapons render their ink at under 45% of the grid**, so a "16×16" sprite shows only ~7–11px of actual weapon.

---

## 2. Root Cause Analysis

Three independent factors stack up:

1. **Dead padding (biggest factor).** Sprites are authored loosely inside the 16×16 grid. Because the renderer scales the *whole grid* (`ctx.translate(-8,-8); ctx.scale(scale,scale)` in [weaponSprites.js:355-357](../src/render/weaponSprites.js#L355-L357)), the empty border directly shrinks the visible weapon. Tightening the art alone roughly doubles apparent size for the worst offenders.
2. **Low render scale.** Base `scale = 1.4` ([Unit.js:1767](../src/entities/Unit.js#L1767)) is small. Even a fully-inked 16px sprite is only ~22px.
3. **Low resolution.** 16×16 limits the silhouette; 1px features (slingshot forks, chain links, antenna tip) vanish at small render sizes, so even correctly-sized sprites read as noise.

Secondary contributor: **placement.** `reach = this.r * 0.7 ≈ 9px` ([Unit.js:1768](../src/entities/Unit.js#L1768)) keeps the weapon overlapping the body, hiding it further.

### Incidental findings (clean up while here)
- The real-image path (`WEAPON_IMAGE_DEFS`, `preloadWeaponImages`, `_weaponImages`) is **dormant** — `WEAPON_IMAGE_DEFS = {}`, so the pixel-art branch always runs. Keep it or delete it; it currently adds noise.
- `Unit._drawWeapon` and `_drawFlyingBoomerang` special-case keys **that no longer exist** in `WEAPON_DEFS`: `samurai_sword`, `throwing_stone`, `shotgun`, `bow`, `crossbow`, `boomerang` ([Unit.js:1804-1813](../src/entities/Unit.js#L1804-L1813), [Unit.js:1861](../src/entities/Unit.js#L1861)). The live weapon set is exactly the 16 `WEAPON_SPRITES` keys. These branches are dead code and should be removed or remapped.

---

## 3. Goals & Non-Goals

**Goals**
- Every weapon clearly readable while held, thrown, and in the HUD.
- Target on-screen weapon size ≈ hero body height (~26–30px) for melee/held weapons.
- Keep the cheap `fillRect` pixel-art pipeline (no asset loading, no perf regression).
- Centralize the scattered magic-number scales into one config.

**Non-Goals**
- No switch to imported PNG art (the dormant image pipeline stays dormant for now).
- No change to weapon *stats/balance* (`WEAPON_DEFS`), only visuals.
- No animation/spritesheet system for weapons.

---

## 4. Recommended Approach

Do this in order; each phase is independently shippable and testable with `npm run build`.

**The core fix is Phases 1–3 (renderer + redraw + recalibrate).** Phase 4 (character size) is optional and only if the scene still reads small after 1–3.

### Phase 1 — Make the renderer grid-size-agnostic + centralize scale config
*Files: [weaponSprites.js](../src/render/weaponSprites.js)*

Today `16` and `8` are hardcoded in three places (`drawWeaponSprite` loops + `translate(-8,-8)`, and `generateWeaponTextures` canvas size + loops). This blocks any resolution change.

1. Derive dimensions from the sprite itself:
   ```js
   const rows = sprite.length;            // height
   const cols = sprite[0].length;         // width
   // center pivot:
   ctx.translate(-cols / 2, -rows / 2);
   // loops: for (let r=0;r<rows;r++) for (let c=0;c<cols;c++)
   ```
2. In `generateWeaponTextures`, size the canvas to `cols × rows` instead of `16 × 16` (the HUD-fit math already adapts via `aspect`).
3. Add a per-weapon render config and a single global multiplier, replacing the magic numbers in `Unit.js`/`Projectile.js`/`hud.js`:
   ```js
   export const WEAPON_RENDER_SCALE = 1.0; // global tuning knob
   export const WEAPON_RENDER = {
     // scale = on-hero multiplier; held = reach multiplier on this.r; pivot = optional handle anchor
     car_antenna:           { scale: 1.0 },
     // ... per-weapon overrides; default {scale:1.0}
   };
   ```
   Expose a helper `getWeaponRender(key)` returning merged defaults so callers stop hardcoding `1.4`, `1.8`, `0.9`, etc.

**Acceptance:** game looks identical (sprites still 16×16); `npm run build` passes. This phase is a pure refactor enabling Phases 2–3.

### Phase 2 — Redraw all 16 sprites at higher resolution, tightly framed
*Files: [weaponSprites.js](../src/render/weaponSprites.js) (`WEAPON_SPRITES`, `PALETTE`)*

- **New grid: 24×24** (2.25× the pixels; still hand-editable ASCII, still cheap). Renderer from Phase 1 handles any size, so 24×24 "just works."
- **Fill rule:** each weapon's ink fills **≥ 85%** of the grid and is **centered** in it (so rotation pivots cleanly on the weapon's middle).
- **Detail:** use 2–3 shading tones per material for a readable silhouette + a 1px dark outline (`'1'`). Add highlight/shadow palette entries as needed, e.g.:
  ```js
  '9': '#ffffff', // hot highlight
  'a': '#3a2410', // wood shadow
  'b': '#6b7585', // metal shadow
  ```
- Redraw all 16, grouped by type so silhouettes are distinct at a glance:
  - **Melee (8):** car_antenna, toilet_lid, bus_stop_pole, radiator_rib, plastic_chair, shower_hose, chain_with_padlock, extension_cord — give each a clear "business end" + handle so the swing reads.
  - **Thrown (3):** frozen_cutlet, pickle_jar, bottle_cap_shuriken — compact, chunky, readable while spinning.
  - **Ranged (5):** bed_spring_arbalest, bike_spoke_slingshot, courtyard_railgun, contraceptive_catapult, fence_wire_bow — clear muzzle/launch direction (these are drawn aligned to `facing`).
- Keep the same 16 keys so nothing downstream breaks.

**Acceptance:** in-game weapons are visibly larger and identifiable; HUD strip icons ([hud.js:344](../src/render/hud.js#L344)) and the level-up cards ([WeaponLevelUpScene.js:241](../src/phaser/scenes/WeaponLevelUpScene.js#L241)) still render (they regenerate textures from the new grids automatically). `npm run build` passes.

### Phase 3 — Recalibrate in-game scale & placement
*Files: [Unit.js](../src/entities/Unit.js), [Projectile.js](../src/entities/Projectile.js), [hud.js](../src/render/hud.js)*

With tight 24×24 art, recalibrate so a held weapon is ≈ hero body height:
- Held weapon base scale: target **drawn height ≈ 26–30px**. On a 24-grid that is roughly `scale ≈ 1.2–1.3` (ink ~22px × 1.3 ≈ 28px). Replace the hardcoded `1.4` at [Unit.js:1767](../src/entities/Unit.js#L1767) with `getWeaponRender(key).scale * WEAPON_RENDER_SCALE`.
- Nudge `reach` out so the weapon clears the body: e.g. `this.r * 0.85` to `this.r * 1.0` for held melee; keep ranged/thrown launch offset as-is but re-test.
- Projectile in flight ([Projectile.js:185](../src/entities/Projectile.js#L185)) and HUD icon ([hud.js:344](../src/render/hud.js#L344)) read from the same config instead of `1.4` / `0.9`.
- **Remove dead branches** in `_drawWeapon`/`_drawFlyingBoomerang` for `samurai_sword`, `throwing_stone`, `shotgun`, `bow`, `crossbow`, `boomerang` (not in current `WEAPON_DEFS`). If a future boomerang/bow returns, re-add via config.

**Acceptance:** all 3 heroes' starting + pool weapons are clearly visible held and thrown; thrown/ranged projectiles are visible mid-flight; HUD icons legible. `npm run build` passes; manual smoke per `docs/current/smoke_checklist.md`.

### Phase 4 — (Optional) Increase character size
*Only if the scene still reads small after Phases 1–3.* The user explicitly invited this.

Heroes use `this.r = 13` ([Unit.js:22](../src/entities/Unit.js#L22)) as **both** the visual radius **and** the collision/gameplay radius (collisions, pickup offsets, several ability ranges reference `this.r`). Two options:

- **4a — Bump `this.r` (simplest).** `13 → 15` (≈ +15%). All `this.r`-relative draw code scales automatically. **Caveat:** hitboxes grow → minor balance/feel change; flag for playtest. Verify collision-heavy abilities still feel right.
- **4b — Decouple visual from collision (cleaner, more work).** Keep `this.r = 13` for physics; add `this.drawR` (e.g. `r * 1.25`) and swap the body-draw routines (`_drawEliott/_drawDick/_drawHabib` and HP-bar/aura offsets) to use `drawR`. No gameplay change, but touches more draw code.

**Recommendation:** ship 1–3 first, evaluate, then choose 4a (quick) or 4b (clean) only if needed. If weapons are now legible, skip Phase 4 entirely.

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Bigger weapons overlap/clutter the hero | Phase 3 `reach` tuning; keep base ≈ hero height, not larger |
| Texture regen cost for HUD/cards | One-time at scene create; 24×24 is trivial — no runtime change |
| Phase 4a changes hitboxes/balance | Treat as a deliberate balance change; playtest; or use 4b to avoid |
| Rotation pivots look off | Phase 2 centers ink in the grid → clean center pivot; optional handle-anchor via `pivot` in `WEAPON_RENDER` |
| Removing legacy branches breaks something | Confirmed dead: live keys == the 16 `WEAPON_SPRITES` keys (verified against `WEAPON_DEFS`) |

---

## 6. Acceptance Criteria

- [ ] All 16 weapons render at ≈ hero body size and are individually identifiable held, thrown, and in HUD.
- [ ] Renderer is grid-size-agnostic (no hardcoded `16`/`8`).
- [ ] Scale magic numbers are centralized in `WEAPON_RENDER` + `WEAPON_RENDER_SCALE`.
- [ ] Dead weapon branches removed from `Unit.js`.
- [ ] `npm run build` passes.
- [ ] Manual smoke pass (`docs/current/smoke_checklist.md`): start each hero, level up to swap weapons, confirm held + projectile visibility.

---

## 7. Docs to Update on Completion
- `docs/current/current_game_state.md` → "Hero weapon visuals" (update 16×16 → 24×24, note central scale config).
- `docs/current/implementation_notes.md` → weapon render path, if it documents `weaponSprites.js`.
- `docs/index.md` → already lists this file under planning; move to `executed/` when done.
