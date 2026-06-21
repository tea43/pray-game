# Weapon Rework 4 — Visual & Projectile Fixes

**Status:** Implemented (Visuals and bounds logic complete)
**Branch:** `weapons_updates`
**Predecessor:** [`docs/executed/weapor_rework_3.md`](executed/weapor_rework_3.md) — implemented the behaviour registry (bounce, orbit, ground zone, aura, charge-beam, whip, multi-slash, arc-down, etc.). This plan fixes the **visual/feel regressions** that shipped with it.
**Reference:** https://vampire.survivors.wiki/w/Weapons

---

## 0. Symptom report (from playtest)

1. **Projectiles are too fast and disappear immediately after spawning** — bolts, the frozen cutlet, etc. blink out the instant they leave the hero.
2. **Several weapon visuals are missing / not readable** — whips and multi-slash show essentially nothing; the catapult explosion never appears.

Both symptoms have concrete, identified root causes below. The dominant one is a **coordinate-space bug**: the world is 3× the screen, entities live in world coordinates, but two projectile classes test their death/bounce conditions against **screen** bounds.

---

## 1. Root-cause analysis

### 1.1 ⛔ CRITICAL — projectiles die at screen bounds, not world bounds

The world is three screens wide/tall and entities are stored in **world** coordinates; the camera translation is applied only at render time ([`GameScene.js:80-81`](../src/phaser/scenes/GameScene.js#L80-L81), [`GameScene.js:732`](../src/phaser/scenes/GameScene.js#L732)):

```js
G.WORLD_W = G.W * 3;
G.WORLD_H = G.PLAY_BOTTOM * 3;
```

The hero is camera-locked near the **world centre** (≈ `1.5 × G.W`), so any projectile is *born* with `x ≈ 1.5·G.W`, already past `G.W`.

- **`ShotgunBullet`** kills itself the moment it leaves the screen rectangle ([`ShotgunBullet.js:26`](../src/entities/ShotgunBullet.js#L26)):
  ```js
  if (this.x < -10 || this.x > G.W + 10 || this.y < -10 || this.y > G.PLAY_BOTTOM + 10) { this.dead = true; return; }
  ```
  Because `x` is already `> G.W` at spawn, the bullet dies on its **first update**. → **This is the "disappears immediately" bug** for every bolt/directional weapon: `bed_spring_arbalest`, `bike_spoke_slingshot`, `fence_wire_bow`.

- **`BouncingProjectile`** reflects / floors against the same screen bounds ([`BouncingProjectile.js:51-68`](../src/entities/BouncingProjectile.js#L51-L68)):
  ```js
  if (this.x < 0 || this.x > G.W) { ... this.doBounce(); }
  if (this.y < 0 || this.y > G.PLAY_BOTTOM) { ... this.doBounce(); }
  ...
  } else if (this.gravity > 0) {
    if (this.y > G.PLAY_BOTTOM) { ... }
  }
  ```
  `frozen_cutlet` (offBounds, `maxBounces:4`) ricochets off an **invisible wall one-third of the way across the map** and burns all 4 bounces almost instantly, then dies. `toilet_lid` and `bus_stop_pole` (gravity / arcDown) slam into an invisible floor at one-third map height. → **"too fast / vanishes" + phantom bounces.**

**Fix:** test against `G.WORLD_W` / `G.WORLD_H` (with a small margin), and rely on the intended lifetime / `maxRange` limit as the primary kill switch rather than the viewport rectangle.

### 1.2 ⛔ Catapult explosion never renders (off-by-one on `life`)

Explosions are pushed with `life: 0` ([`Projectile.js:118`](../src/entities/Projectile.js#L118), [`Projectile.js:169`](../src/entities/Projectile.js#L169)):

```js
state.explosions.push({ x, y, r: 0, maxR: this.aoeRadius, life: 0, maxLife: 0.3 });
```

But the decay loop **subtracts** from `life` ([`GameScene.js:474-478`](../src/phaser/scenes/GameScene.js#L474-L478)) and the renderer computes opacity as `alpha = ex.life / ex.maxLife` ([`effects.js:97`](../src/render/effects.js#L97)). Starting at `life:0` → `alpha:0` on frame 1, then negative → filtered out on frame 2. The explosion is **never visible**. → Catapult (`contraceptive_catapult`) and any AoE impact render no blast.

**Fix:** push explosions with `life: 0.3` (i.e. `life === maxLife`) so they fade from full to zero, matching the `life -= dt` decay and the `life/maxLife` alpha.

### 1.3 Whip & multi-slash have no readable visual

`_attackWhip` and `_attackMultiSlash` only emit a single **zero-velocity** particle as their "effect":

- Whip box: two particles `size: p.halfHeight` (20), `life: 0.15` ([`Unit.js:1141-1142`](../src/entities/Unit.js#L1141-L1142)).
- Whip arc: one particle `size: radius` (100), `life: 0.2` ([`Unit.js:1162`](../src/entities/Unit.js#L1162)).
- Multi-slash: one particle `size: 20` at each enemy ([`Unit.js:1209`](../src/entities/Unit.js#L1209)).

`drawParticles` renders a zero-velocity particle as a **tiny round-cap dot** (velocity-stretch < 1.5 → `lineTo(p.x - 0.1, p.y)`, [`effects.js:179-183`](../src/render/effects.js#L179-L183)). So:

- Shower Hose / Extension Cord show a faint blob for ~0.15s — no horizontal lash, no arc crescent.
- Car Antenna shows faint blue dots, not slashes.

→ These read as **"missing animations."** VS Whip flashes a clear horizontal rectangle that passes through enemies; King Bible/Santa Water/Garlic are large and linger; Victory Sword spawns visible blue slash glyphs.

**Fix:** give each its own short-lived shaped effect (rectangle/streak for the whip box, crescent for the arc sweep, diagonal slash quad per target for multi-slash). Draw them in the world-space block.

### 1.4 Behavioural gaps that read as "wrong / missing"

| Behaviour | Issue | Location |
|---|---|---|
| `groundZone` (pickle_jar) | The puddle is only spawned in `explode()`, which only runs when the jar reaches max range. If it **hits an enemy first**, it does AoE + `cleanup()` with **no zone** → the signature puddle usually never appears. | [`Projectile.js:79-83`](../src/entities/Projectile.js#L79-L83) vs [`Projectile.js:183-195`](../src/entities/Projectile.js#L183-L195) |
| `chargeBeam` (railgun) | Fires in a **fully random** direction (`ang = Math.random()*2π`), so the beam usually points away from all enemies — looks like random flailing. VS C·U·Laser fires toward enemies. | [`Unit.js:1217`](../src/entities/Unit.js#L1217) |
| `bolt` targeting | The auto-attack loop always uses `_findTarget` (nearest); `_acquireTarget` / `_findRandomTarget` were never wired, so `bed_spring_arbalest` (`targeting:'random'`) silently behaves as nearest. Functional, off-spec. | [`Unit.js:747`](../src/entities/Unit.js#L747) |
| `directional` (fence_wire_bow) | Routed through `_attackRanged` (aims **at** the target) and still gated on `_findTarget`, so it never fires when no enemy is near — contrary to the Knife "fire in facing direction" concept. | [`Unit.js:937-938`](../src/entities/Unit.js#L937-L938), [`Unit.js:747-748`](../src/entities/Unit.js#L747-L748) |

### 1.5 Speed / feel (secondary — only matters once 1.1 is fixed)

After the bounds fix, projectiles will actually fly. Some will still feel fast/short to read and need tuning:

- `ShotgunBullet` tracer length is `vx * 0.024` ([`ShotgunBullet.js:67`](../src/entities/ShotgunBullet.js#L67)); at speed 750 that's ~18px — readable but brief.
- Bolt speeds 600–750 cross their `atkRange` (350–420) in ~0.5s. Likely fine; validate and tune per weapon.
- `bottle_cap_shuriken` `atkRate:0.35` fires very frequently — fine once visible.

### 1.6 Minor render polish

- `_drawShadows` only recognises a projectile via `speed !== undefined && maxRange !== undefined` ([`GameScene.js:886`](../src/phaser/scenes/GameScene.js#L886)). `BouncingProjectile` has neither, so it gets an oversized **unit-style** ground shadow. Cosmetic.

---

## 2. Fix plan (phased)

Each phase ends with `npm run build` green and a doc trace (per [`CLAUDE.md`](../CLAUDE.md)). The user validates gameplay manually — **do not auto-launch the app.** Commit after each phase.

### Phase 1 — Make projectiles visible again (CRITICAL, do first)

Goal: bolts and bouncing projectiles fly and persist; the catapult explodes visibly.

1. **`ShotgunBullet` bounds → world** ([`ShotgunBullet.js:26`](../src/entities/ShotgunBullet.js#L26)):
   replace `G.W` / `G.PLAY_BOTTOM` with `G.WORLD_W` / `G.WORLD_H` and a larger margin (e.g. `-40 … G.WORLD_W + 40`). The `maxRange` check at [`:25`](../src/entities/ShotgunBullet.js#L25) is the real lifetime gate and already correct.
2. **`BouncingProjectile` bounds → world** ([`BouncingProjectile.js:51-68`](../src/entities/BouncingProjectile.js#L51-L68)): reflect against `0…G.WORLD_W` and `0…G.WORLD_H`; the gravity "floor" should use `G.WORLD_H` (or a per-shot ground line), not `G.PLAY_BOTTOM`.
3. **Explosion `life` fix** ([`Projectile.js:118`](../src/entities/Projectile.js#L118), [`Projectile.js:169`](../src/entities/Projectile.js#L169)): push with `life: 0.3` (== `maxLife`). Audit any other `state.explosions.push` for the same pattern.
4. Build green. Manual check: arbalest/slingshot/fence bolts visibly travel; frozen cutlet ricochets off the **map** edges; catapult shows a blast ring.

### Phase 2 — Restore whip & slash visuals

Goal: every "melee" behaviour has a readable, VS-style flash.

1. **Whip box (Shower Hose)** — draw two short-lived **rectangles** left & right of the hero (the actual hitbox from [`Unit.js:1124-1142`](../src/entities/Unit.js#L1124-L1142)), white→transparent over ~0.15s. Add a small dedicated list (e.g. `state.slashes` / `state.whips`) drawn in the world-space block, or extend the particle system with a `shape:'rect'` variant.
2. **Whip arc (Extension Cord)** — draw a **270° crescent** sweep at `radius` matching [`Unit.js:1143-1163`](../src/entities/Unit.js#L1143-L1163), fading over ~0.2s.
3. **Multi-slash (Car Antenna)** — draw a **diagonal blue slash glyph** at each struck enemy ([`Unit.js:1204-1210`](../src/entities/Unit.js#L1204-L1210)) over ~0.25s, optionally staggered by `slash.stagger` for a cascade.
4. Register any new `state.*` array in [`state.js`](../src/state.js) + the new-game reset ([`GameScene.js:104-105`](../src/phaser/scenes/GameScene.js#L104-L105)) + an update/decay pass + a draw call inside the camera block.
5. Build green. Manual check: whips lash sideways/arc and pass through; antenna shows blue slashes.

### Phase 3 — Behaviour correctness

1. **Ground zone on any impact (Pickle Jar)** — when `wDef.zone` is set, spawn the persistent zone in `hitEnemy` as well as in `explode()`, so a jar that hits an enemy still leaves a puddle ([`Projectile.js:79-83`](../src/entities/Projectile.js#L79-L83), [`Projectile.js:183-195`](../src/entities/Projectile.js#L183-L195)). Make the puddle linger long enough to read (`zone.duration` 3s is fine; verify alpha/size in [`GameScene.js:795-805`](../src/phaser/scenes/GameScene.js#L795-L805)).
2. **Beam aims at enemies (Railgun)** — replace the random angle ([`Unit.js:1217`](../src/entities/Unit.js#L1217)) with the direction to a random (or nearest) living enemy; fall back to `this.facing` when none. Keep the charge telegraph.
3. **Wire targeting (Arbalest random vs Slingshot nearest)** — use `_acquireTarget(stats)` in the auto-attack loop ([`Unit.js:747`](../src/entities/Unit.js#L747)) so `targeting:'random'` is honoured. (`_findRandomTarget` per [`weapor_rework_3.md` §4.3](executed/weapor_rework_3.md).)
4. **Directional fires targetless (Fence Bow)** — let `directional` fire along `this.facing` even with no target (move it out of the `_findTarget`-gated path, or add it to a TARGETLESS set), and spawn the bullet along facing rather than re-aiming at an enemy.
5. Build green.

### Phase 4 — Speed/feel tuning & polish

1. Playtest-tune per-weapon `projectileSpeed` / `atkRange` / tracer length so each projectile is readable (target: a bolt is on-screen ≥ ~0.4s; lobs/arcs visibly arc). Adjust [`weapons.js`](../src/config/weapons.js) values and the `ShotgunBullet` tracer scale if needed.
2. Treat bounce/arc projectiles as projectiles in `_drawShadows` (add an `isProjectile` flag or check `vx !== undefined`, [`GameScene.js:886`](../src/phaser/scenes/GameScene.js#L886)).
3. Optional: distinct trail tints per behaviour (cutlet = frosty blue, bus pole = heavy grey) for readability.

### Phase 5 — Docs pass (phase-complete ritual)

- Update [`docs/current/current_game_state.md`](current/current_game_state.md) (weapon visuals now correct).
- Update [`docs/current/implementation_notes.md`](current/implementation_notes.md) — note the **world-space vs screen-space bounds rule** for all entities (the trap that caused 1.1), the explosion `life === maxLife` convention, and any new `state.*` visual arrays.
- Add a per-behaviour visual line to [`docs/current/smoke_checklist.md`](current/smoke_checklist.md).
- This file stays at `docs/weapor_rework_4.md` during dev; move to `docs/executed/` and re-index in [`docs/index.md`](index.md) on completion.

---

## 3. Validation

- **Build gate:** `npm run build` green after every phase.
- **Per-behaviour manual smoke (for the user):**
  - bolts (arbalest/slingshot) and fence bow visibly travel across the map and don't blink out at spawn;
  - frozen cutlet ricochets off the **map** edges (not mid-screen) and persists for its lifetime;
  - toilet lid / bus pole arc and bounce against the **world** floor;
  - catapult shows an explosion ring; pickle jar leaves a lingering puddle whether it hits an enemy or lands;
  - shower hose lashes two horizontal boxes, extension cord sweeps a wide arc, both pass through enemies;
  - car antenna shows blue slashes at the nearest enemies;
  - railgun charges then beams **toward enemies**; megaphone aura pulses; chain orbits.

---

## 4. Priority summary

| Priority | Fix | Cause |
|---|---|---|
| **P0** | World-space bounds for `ShotgunBullet` + `BouncingProjectile` | §1.1 — "disappears immediately" |
| **P0** | Explosion `life === maxLife` | §1.2 — invisible blast |
| **P1** | Whip / multi-slash shaped visuals | §1.3 — "missing animations" |
| **P1** | Ground zone on impact; beam aims at enemies | §1.4 — signature effect missing |
| **P2** | Random vs nearest targeting; directional targetless | §1.4 — off-spec |
| **P2** | Speed/feel tuning; projectile shadows | §1.5 / §1.6 — polish |
