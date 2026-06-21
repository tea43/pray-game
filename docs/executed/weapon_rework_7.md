# Weapon Rework 7 — Dev Plan

**Status:** Executed
**Follows:** `docs/executed/weapon_rework_6.md` (commit `40ae671` "weapon rework 1.1")
**Goal:** Fix the five visual / balance regressions introduced or left over after commit `40ae671`.

Reference screenshots:
- `docs/Screenshot 2026-06-21 085805.png` — Extension Cord whip blob covering the hero.
- `docs/Screenshot 2026-06-20 221337.png` — Catapult projectiles drawn as catapult sprites.

---

## Issue 1 + 2 — Whips are huge and linger (Extension Cord & Shower Hose)

Both weapons use `behavior: 'whip'` → `_attackWhip()` (shape `lash`) and render via the
`type === 'whip'` branch in `drawSlashes()`. They share the same code path, so one fix covers both.

### Root cause
1. **Lifetime far too long.** In `src/entities/Unit.js:1207`:
   ```js
   const lashLife = 0.18 * ANIM_DURATION_MULT;   // 0.18 * 10 = 1.8 seconds
   ```
   `ANIM_DURATION_MULT` is `10` (`src/config/combatTuning.js:15`). A whip "crack" persists ~1.8 s,
   and at `atkRate ≈ 1/s` two or three lashes overlap and stack into a solid blob.
2. **Rendered thick, not as a cord.** In `src/render/effects.js` (`type === 'whip'` branch):
   - Line width is `s.halfHeight * 2 * (...)` → up to **36 px** (Extension Cord `halfHeight 18`) /
     **44 px** (Shower Hose `halfHeight 22`), with `lineCap = 'round'`.
   - A Bézier bow of `bowDist = 25 * sin(...)` fattens the middle.
   - A `lighter` (additive) radial end-flash of radius **12 px** adds bloom.
   The visual width is tied to `halfHeight`, which is *also* the hit-box half-height in `_attackWhip`.

### Fix
Make the lash a **thin, fast cord crack**, and decouple visual thickness from the hit-box.

1. **Shorten lifetime** — `src/entities/Unit.js:1207`. Keep it the shortest overlay but still scaled
   by `ANIM_DURATION_MULT`, so it stays consistent with the slow-mo presentation:
   ```js
   const lashLife = 0.06 * ANIM_DURATION_MULT;   // = 0.6s — fast crack, ~3x shorter than the old blob
   ```
   > **Correction (post-implementation fix):** the first pass set a bare `const lashLife = 0.12;`
   > (un-multiplied). Slash overlays decay in `realDt` (GameScene `s.life -= realDt`) while every other
   > weapon overlay is stretched by `ANIM_DURATION_MULT` (beams/multi-slash ~2.5s, explosions ~3s). A
   > 0.12s lash blinked ~20x faster than everything else and looked like the Extension Cord / Shower
   > Hose had stopped working. Scaling by `ANIM_DURATION_MULT` (×10) restores visibility; the blob the
   > original 1.8s lifetime caused is already prevented by the thin tapering cord render below.

2. **Render a thin tapering cord** — `src/render/effects.js`, `type === 'whip'` branch. Stop deriving
   width from `halfHeight`; use a small constant that tapers along the lash:
   - Outer stroke (cord body): `lineWidth = 4 * (1 - t * 0.7)` → 4 px at the hand to ~1.2 px at the tip.
   - Inner highlight stroke: `lineWidth = 1.5 * (1 - t * 0.8)`.
   - Reduce the Bézier bow: `bowDist = 8 * Math.sin(progress * Math.PI)` (was 25).
   - Shrink the end-flash radial gradient from radius `12` to `4` (or remove it entirely). Keep `lighter`
     only on that tiny tip flash so the cord itself stays subtle.
   - Keep `lineCap = 'round'` for a soft tip; that's fine at 4 px.

3. **Decouple hit-box from visuals** — the visual is now independent of `halfHeight`, so `halfHeight`
   in the weapon defs keeps acting purely as the collision half-height in `_attackWhip`
   (`src/entities/Unit.js`, `if (localX >= 0 && localX <= length + e.r && Math.abs(localY) <= halfHeight + e.r)`).
   Leave the hit-box generous so the weapons still feel good; only the drawing changes.

   Optionally trim the cord *length* a touch in `src/config/weapons.js` if it still reads too long:
   - `extension_cord.whip.length` 130 → 110
   - `shower_hose.whip.length` 120 → 100
   (Length is the reach; lower only if the thin cord still feels oversized. `sides: 2` on Shower Hose
   means two opposing lashes — expected, leave as-is.)

### Files
- `src/entities/Unit.js` — `_attackWhip` lifetime (line ~1207).
- `src/render/effects.js` — `drawSlashes()` `type === 'whip'` branch.
- `src/config/weapons.js` — optional `length` trim only.

---

## Issue 3 — Catapult projectile uses the catapult sprite

### Root cause
`src/entities/Projectile.js:308`:
```js
} else if (this.key && WEAPON_SPRITES[this.key]) {
  ...
  drawWeaponSprite(ctx, this.key, 0, 0, scale, Math.PI / 4);
}
```
The in-flight projectile draws the launcher's own sprite (`contraceptive_catapult`), so each lobbed
shot looks like a tiny catapult.

### Fix
Give projectile weapons an optional dedicated projectile sprite, defaulting to the weapon sprite for
everything else (no behaviour change for existing weapons).

1. **New sprite** in `src/render/weaponSprites.js` — add a `catapult_pouch` entry (a small filled
   latex water-pouch; thematically the "contraceptive" payload). Drop-in 24×24 grid:
   ```js
   catapult_pouch: [
     "                        ",
     "                        ",
     "                        ",
     "                        ",
     "                        ",
     "                        ",
     "                        ",
     "           11           ",
     "          1441          ",
     "         144441         ",
     "        14999941        ",
     "        49999994        ",
     "       1499999941       ",
     "       1499999941       ",
     "        49999994        ",
     "        14999941        ",
     "         144441         ",
     "          1441          ",
     "           11           ",
     "                        ",
     "                        ",
     "                        ",
     "                        ",
     "                        "
   ],
   ```
   Add a matching `WEAPON_RENDER` entry: `catapult_pouch: { scale: 1.0 },`.
   (Palette: `1`=black outline, `4`=#cfd6dc light, `9`=white highlight. Re-tint toward orange/yellow
   if it should foreshadow the fire explosion — the explosion already renders `isFire`.)

2. **New weapon stat** in `src/config/weapons.js` on `contraceptive_catapult`:
   ```js
   projectileSprite: 'catapult_pouch',
   ```

3. **Use it** in `src/entities/Projectile.js:308`. Resolve a sprite key once and use it for both the
   `WEAPON_SPRITES` lookup and the draw:
   ```js
   const spriteKey = this.wDef?.projectileSprite || this.key;
   ...
   } else if (spriteKey && WEAPON_SPRITES[spriteKey]) {
     const renderConfig = getWeaponRender(spriteKey);
     const scale = renderConfig.scale * WEAPON_RENDER_SCALE;
     drawWeaponSprite(ctx, spriteKey, 0, 0, scale, Math.PI / 4);
   }
   ```

### Files
- `src/render/weaponSprites.js` — new `catapult_pouch` sprite + `WEAPON_RENDER` entry.
- `src/config/weapons.js` — `projectileSprite` on `contraceptive_catapult`.
- `src/entities/Projectile.js` — sprite-key resolution in `draw()`.

---

## Issue 4 — Unlimited projectiles on screen

### Root cause
The auto-attack loop (`src/entities/Unit.js:795–826`) fires every time the cooldown elapses with no
cap on how many of a weapon's projectiles can be alive at once. Combined with
`PROJECTILE_TIME_SCALE = 0.1` (projectiles live ~10× longer), fast weapons
(`bottle_cap_shuriken atkRate 0.35`, `frozen_cutlet 0.8`, ranged weapons) flood the screen.

### Fix
Add a `maxProjectiles` weapon stat that grows with weapon level, and gate firing on the live count of
that weapon's projectiles owned by the unit.

1. **New stat + per-level ramp** in `src/config/weapons.js` for every weapon that spawns a persistent
   projectile (`thrown` and `ranged`, excluding the `chargeBeam` railgun which spawns no projectile).
   Add a base `maxProjectiles` and a `maxProjectiles` field in each `levels[]` entry. Suggested ramp
   (1 → 5), tune per weapon:

   | Weapon | base | L1 → L5 |
   |---|---|---|
   | `frozen_cutlet` | 4 | 4, 5, 6, 7, 8 |
   | `pickle_jar` | 2 | 2, 2, 3, 3, 4 |
   | `bottle_cap_shuriken` | 3 | 3, 4, 5, 6, 7 |
   | `bed_spring_arbalest` | 4 | 4, 5, 6, 7, 8 |
   | `bike_spoke_slingshot` | 5 | 5, 6, 7, 8, 9 |
   | `contraceptive_catapult` | 3 | 3, 4, 5, 6, 7 |
   | `fence_wire_bow` | 4 | 4, 5, 6, 7, 8 |

   `resolveWeaponStats()` already merges `levels[slot.level-1]` over the base, so `stats.maxProjectiles`
   resolves correctly with no extra plumbing.

2. **Tag bullets with their weapon key.** `ShotgunBullet` (ranged) does not store the weapon key —
   add it so the cap can count ranged shots. `src/entities/ShotgunBullet.js` constructor:
   ```js
   this.key = wDef.key;
   ```
   `Projectile` already sets `this.key = wDef.key`.

3. **Gate firing on the live count.** In the auto-attack loop `src/entities/Unit.js` (just before
   `this.attack(target, stats)` at line ~823), for weapons that spawn pooled projectiles:
   ```js
   if (stats.maxProjectiles) {
     let alive = 0;
     for (const p of state.projectiles) {
       if (!p.dead && p.owner === this && p.key === stats.key) alive++;
     }
     if (alive >= stats.maxProjectiles) continue;   // at cap: skip this fire, retry next frame
   }
   ```
   Using `continue` without resetting `slot.atkCd` lets the weapon fire again the instant a slot frees
   (cheap: the count loop is small and only runs when the cooldown has elapsed).

> Note: this counts per **unit + weapon key**, so each hero has its own budget and two heroes with the
> same weapon don't share a cap. Returning weapons (`bottle_cap_shuriken`) also benefit because the cap
> counts the in-flight + returning projectiles.

### Files
- `src/config/weapons.js` — `maxProjectiles` base + per-level for the 7 projectile weapons.
- `src/entities/ShotgunBullet.js` — store `this.key`.
- `src/entities/Unit.js` — cap check in the auto-attack loop.

---

## Issue 5 — Doggo Chain (Chain with Padlock) sprite should read as a padlock

### Root cause
`src/render/weaponSprites.js:171` `chain_with_padlock` is a diagonal chain with a tiny lock at the
bottom — unrecognizable as a padlock at game scale (and it's also what the orbiters draw via
`drawWeaponSprite(ctx, o.key, ...)` in `Unit.js`).

### Fix
Replace the `chain_with_padlock` sprite with a clear brass padlock (steel shackle + brass body +
keyhole). Drop-in 24×24 grid:
```js
chain_with_padlock: [
  "                        ",
  "                        ",
  "                        ",
  "         111111         ",
  "        15555551        ",
  "        155  551        ",
  "        155  551        ",
  "        155  551        ",
  "     11111111111111     ",
  "     18888888888881     ",
  "     18899888888881     ",
  "     18888888888881     ",
  "     18888811888881     ",
  "     18888811888881     ",
  "     18888811888881     ",
  "     18888888888881     ",
  "     18888888888881     ",
  "     18888888888881     ",
  "     11111111111111     ",
  "                        ",
  "                        ",
  "                        ",
  "                        ",
  "                        "
],
```
Palette used: `1`=black outline, `5`=#8a95a5 steel (shackle), `8`=#e8e060 brass (body), `9`=white
highlight, with the keyhole punched out of the body centre. No code change needed — the orbiter
renderer and weapon-card UI already pull from `WEAPON_SPRITES['chain_with_padlock']`.

### Files
- `src/render/weaponSprites.js` — replace the `chain_with_padlock` grid.

---

## Verification

Per project convention the author tests the game manually; agent verification is build-only:

```
npm run build
```
Confirm no errors, then the author checks in-game:
1. Extension Cord / Shower Hose render as thin cords that vanish fast; hero, enemies, and other
   effects are visible behind them.
2. Catapult shots in flight show the pouch sprite, not a catapult.
3. Projectile counts stay bounded; raising a weapon's level visibly raises its max on-screen count.
4. Doggo Chain orbiters and its level-up card read as a padlock.

---

## Documentation trace (do on the implementing commit)

- Update `docs/current/current_game_state.md` — note the new `maxProjectiles` weapon stat and the
  whip/catapult/padlock visual changes.
- Update `docs/current/implementation_notes.md` if it documents the whip render or projectile pooling.
- On completion, move this file to `docs/executed/` and tick the items, per CLAUDE.md phase rules.

## Task checklist

- [x] Whip lifetime shortened (un-multiplied) in `_attackWhip`.
- [x] Whip renderer redrawn as a thin tapering cord; bow + end-flash reduced.
- [x] (Optional) whip `length` trimmed in weapon defs.
- [x] `catapult_pouch` sprite + `WEAPON_RENDER` entry added.
- [x] `projectileSprite` on `contraceptive_catapult`; `Projectile.draw` uses it.
- [x] `maxProjectiles` base + per-level added to the 7 projectile weapons.
- [x] `ShotgunBullet` stores `this.key`.
- [x] Projectile-cap gate added to the auto-attack loop.
- [x] `chain_with_padlock` sprite replaced with the padlock grid.
- [x] `npm run build` clean; docs updated.
