# Weapon Rework — Fix Plan 1 (post-implementation review)

**Status:** Implemented (Review fixes complete)
**Branch:** `weapons_updates`
**Reviews commit:** `d2d0319` ("weapon rework phase 5") — the implementation of [`docs/executed/weapor_rework_4.md`](executed/weapor_rework_4.md).
**Build:** `npm run build` — ✅ green at `d2d0319`.

---

## 1. Verdict

The commit is **correct and complete for the P0/P1 items** in the rework-4 plan. The two reported symptoms — *projectiles disappear immediately* and *missing weapon visuals* — are resolved at the root. A latent crash was also fixed (see §2). A handful of **minor / polish** issues remain; the most substantive is the gravity-bounce "ground" line (§3.1). None block play.

### 2. Verified correct

| Plan item | Implementation | Status |
|---|---|---|
| §1.1 ShotgunBullet bounds → world | `G.WORLD_W/H ± 40` ([`ShotgunBullet.js:27`](../src/entities/ShotgunBullet.js#L27)) | ✅ |
| §1.1 BouncingProjectile bounds → world | reflect/floor against `G.WORLD_W/H` ([`BouncingProjectile.js:52-68`](../src/entities/BouncingProjectile.js#L52-L68)) | ✅ |
| §1.2 Explosion `life === maxLife` | `life: 0.3` in both push sites ([`Projectile.js:136`](../src/entities/Projectile.js#L136), [`Projectile.js:187`](../src/entities/Projectile.js#L187)) | ✅ |
| §1.3 Whip / multi-slash visuals | `state.slashes` (box/arc/diagonal) + `drawSlashes` ([`effects.js:309`](../src/render/effects.js#L309)) | ✅ |
| §1.4 Ground zone on impact | zone spawned in the enemy-hit path, not only on `explode()` ([`Projectile.js:81-98`](../src/entities/Projectile.js#L81-L98)) | ✅ |
| §1.4 Beam aims at enemies | nearest living enemy, falls back to `this.facing`; now uses `state.beams` (straight beam) not `state.bolts` (lightning) ([`Unit.js:1251-1272`](../src/entities/Unit.js#L1251-L1272)) | ✅ |
| §1.4 Random vs nearest targeting | `_acquireTarget(stats)` wired into the auto-attack loop ([`Unit.js:1314`](../src/entities/Unit.js#L1314), [`Unit.js:747-755`](../src/entities/Unit.js#L747-L755)) | ✅ |
| §1.4 Directional targetless | `whip`/`orbit`/`directional` fire with no target; `facing` preserved for directional ([`Unit.js:747-752`](../src/entities/Unit.js#L747-L752), [`Unit.js:938-940`](../src/entities/Unit.js#L938-L940)) | ✅ |
| §1.6 Projectile shadows | `isProjectile` flag on all three projectile classes, read by `_drawShadows` ([`GameScene.js:894`](../src/phaser/scenes/GameScene.js#L894)) | ✅ |
| State wiring | `slashes`/`zones`/`beams` reset on new game, decayed, and drawn inside the camera block | ✅ |

**Bonus fix (not in the plan):** the charge-beam loop previously called `this._fireWeapon(stats, null)` — a method that **does not exist** — which would throw the moment a Railgun finished charging. It now calls `this._attackBeam(stats)` ([`Unit.js:591`](../src/entities/Unit.js#L591)). Confirmed no `_fireWeapon` references remain anywhere in `src/`.

---

## 3. Remaining issues & fixes

### 3.1 ⚠️ Medium — gravity-bounce projectiles bounce off the world edge, not near the hero

`toilet_lid` (Bone) and `bus_stop_pole` (Axe `arcDown`) use the `BouncingProjectile` gravity integrator, which now bounces/stops at `G.WORLD_H` — the **far bottom edge of the 3-screen world** ([`BouncingProjectile.js:62-68`](../src/entities/BouncingProjectile.js#L62-L68)). Because the hero sits near the world centre, the projectile sails ~1600px south (well off-screen) before its first "ground" bounce. The intended VS feel — *Bone bounces along the ground near the hero* — is lost; the bounces happen off-screen.

This is a **coordinate-model** issue: gravity acts on world-`y` (a horizontal map axis in this top-down game) and treats the map's south edge as "the floor." The rework-4 plan flagged exactly this and offered "a per-shot ground line" as the alternative — the implementation took the simpler `G.WORLD_H` option.

**Fix (recommended, small):** give `BouncingProjectile` a per-shot ground line captured at spawn, e.g. `this.groundY = spawnY + bParams.bounceHeight` (default ~60–120px), and bounce against `this.groundY` instead of `G.WORLD_H` when `gravity > 0`. Keep `offBounds` projectiles (Runetracer/`frozen_cutlet`) on the world bounds — those are correct.

**Fix (proper, larger):** model the lob as a fake-Z arc — integrate gravity on `this.z` with a ground at `z = 0` (the engine already renders entities at `y - z`), so Bone/Axe arc visibly *over* the hero and land near the throw point. Defer unless the small fix reads poorly.

Scope: `toilet_lid` and `bus_stop_pole` (both in Dick's pool). `pickle_jar`/`contraceptive_catapult` use the `Projectile` lob path and are unaffected.

### 3.2 Low — targetless weapons fire (and play SFX) every cooldown with no enemies present

`whip` / `orbit` / `directional` are now correctly targetless, but they fire **unconditionally** every cooldown even when no enemy is anywhere near — each call hits `playSfx(...)` ([`Unit.js:1126`](../src/entities/Unit.js#L1126), [`Unit.js:1173`](../src/entities/Unit.js#L1173), `_attackRanged`). `playSfx` only de-spams when the manifest entry defines a `cooldown` ([`audio.js:255-265`](../src/systems/audio.js#L255-L265)), which `weapon.throw.default`/`shoot` may not. Result: repetitive attack SFX in an empty field, plus Fence Bow spraying bullets into the void.

**Fix:** in the targetless branch of the auto-attack loop ([`Unit.js:747-752`](../src/entities/Unit.js#L747-L752)), skip firing when no enemy is alive within a generous radius (e.g. `1.5 × atkRange`), **or** pass `{ cooldown: 0.25 }` to the weapon-swing `playSfx` calls. Gating the fire is preferable (also saves the wasted projectiles). The visual swing staying continuous is fine and VS-faithful; the goal is to silence idle spam.

### 3.3 Low — `state.beams` not declared in `state.js`

`slashes` and `zones` were added to the `state` object ([`state.js:10-11`](../src/state.js#L10-L11)) but `beams` was not. The decay loop `for (const b of state.beams) ...` is **unguarded** ([`GameScene.js:291`](../src/phaser/scenes/GameScene.js#L291)) and only works because `create()` sets `beams: []` before the first `update()`. It works today but is fragile and inconsistent with `slashes` (which got both a declaration and an `if (state.slashes)` guard).

**Fix:** add `beams: [],` to the `state` object in [`state.js`](../src/state.js).

### 3.4 Low — Railgun beam has no range cap

`_attackBeam` selects the nearest living enemy across the **entire map** with no `atkRange` check ([`Unit.js:1254-1263`](../src/entities/Unit.js#L1254-L1263)), so the Railgun (`atkRange: 500`, beam `length: 600`) can aim at an enemy 3000px away and fire a 600px beam into empty space toward it.

**Fix:** restrict the nearest-enemy search to `stats.atkRange` (fall back to `this.facing` when none in range), mirroring the other behaviours.

### 3.5 Low (cosmetic) — multi-slash glyphs share one fixed angle

Every `diagonal` slash is drawn top-left→bottom-right ([`effects.js:333-345`](../src/render/effects.js#L333-L345)), so a Car Antenna burst looks like parallel strokes rather than varied slashes.

**Fix:** store a random `angle` per slash in `_attackMultiSlash` and rotate the glyph in `drawSlashes`.

### 3.6 Deferred (not a bug) — speed/feel tuning

Rework-4 Phase 4 (per-weapon `projectileSpeed`/`atkRange`/tracer tuning) is a playtest pass, not a defect. Revisit after §3.1–§3.2 land, once projectiles are reliably on-screen.

---

## 4. Suggested phasing

- **Fix A (visual correctness):** §3.1 gravity ground line. One commit, manual check that toilet lid / bus pole bounce on-screen near the hero.
- **Fix B (polish bundle):** §3.2 idle-fire gating, §3.3 `state.beams` declaration, §3.4 beam range cap, §3.5 slash angle. One commit.
- Each ends with `npm run build` green and a doc trace; user validates gameplay manually (do not auto-launch).

## 5. Validation

- Build green after each fix.
- Manual smoke: toilet lid & bus pole arc/bounce **on-screen** near the hero; whips/chain/fence bow go quiet when no enemies are nearby; Railgun beams a target within range; Car Antenna slashes fan out at varied angles.
- Re-run the per-behaviour checks in [`docs/current/smoke_checklist.md`](current/smoke_checklist.md).
