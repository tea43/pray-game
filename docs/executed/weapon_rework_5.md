# Weapon Rework — Phase 5: Projectile & Animation Visibility (Slow‑Motion Pass)

Status: **COMPLETED** · Targets the weapon set introduced in commit `9d629db` ("weapon rework 1.0").

---

## 1. Problem (observed while testing `9d629db`)

- Projectiles travel so fast they are effectively invisible — they spawn and reach the
  target within a couple of frames.
- Attack animations (melee swing arcs, whip boxes/arcs, slash overlays, beams) flash by
  too quickly to read; for most weapons you can't tell what the weapon is doing.

Desired outcome: **projectiles and attack animations should play at ~10% of their current
speed** so each weapon's behaviour is clearly visible, with a single knob to re‑tune later.

---

## 2. Root cause

There is no central speed/time control for combat visuals. Each weapon hard‑codes high
travel speeds, and every attack animation uses a very short fixed lifetime. At the default
`state.timeSpeed = 1` (and `gameDt ≈ realDt` while heroes move), these values run at "full"
speed.

### 2.1 Projectile travel speeds (`projectileSpeed`, px/s) — [src/config/weapons.js](src/config/weapons.js)

| Weapon | behavior | speed | Entity spawned |
|---|---|---|---|
| frozen_cutlet | bounce | 450 | `BouncingProjectile` |
| pickle_jar | groundZone | 400 | `Projectile` |
| bottle_cap_shuriken | boomerang | 600 | `Projectile` (returns) |
| bed_spring_arbalest | bolt | 750 | `ShotgunBullet` |
| bike_spoke_slingshot | bolt | 600 | `ShotgunBullet` |
| courtyard_railgun | chargeBeam | 1200 | beam only (no travel) |
| contraceptive_catapult | lobExplode | 500 | `Projectile` (explodes) |
| fence_wire_bow | directional | 580 | `ShotgunBullet` |
| toilet_lid | bounce (melee) | 400 (default) | `BouncingProjectile` |
| bus_stop_pole | arcDown (melee) | upSpeed 400 / drift 100 | `BouncingProjectile` |

All travelling projectiles are advanced in **one place**:
[GameScene.js:346](src/phaser/scenes/GameScene.js#L346) — `for (const pr of state.projectiles) pr.update(gameDt);`
(covers `Projectile`, `ShotgunBullet`, and `BouncingProjectile`, since all three are pushed
into `state.projectiles`).

Speed is read at construction:
- [Projectile.js:18-19](src/entities/Projectile.js#L18-L19) (`speed`, `returnSpeed`)
- [ShotgunBullet.js:11-13](src/entities/ShotgunBullet.js#L11-L13)
- [Unit.js `_attackBounce`:1099-1109](src/entities/Unit.js#L1099-L1109) and
  [`_attackArcDown`:1112-1133](src/entities/Unit.js#L1112-L1133)

Visual rotation: `Projectile.spin = 18` ([Projectile.js:30](src/entities/Projectile.js#L30)),
`BouncingProjectile.spin = 15` ([BouncingProjectile.js:29](src/entities/BouncingProjectile.js#L29)).

### 2.2 Attack animation durations (seconds — too short)

| Animation | Lifetime | Location |
|---|---|---|
| Melee swing arc + trail | `swing` decays `dt*6` → ~0.17s | [Unit.js:723](src/entities/Unit.js#L723), drawn [Unit.js:2200-2238](src/entities/Unit.js#L2200-L2238) |
| Throw/fire arm | `throwArm` decays `dt*4` → ~0.25s | [Unit.js:725](src/entities/Unit.js#L725) |
| Whip box slash | 0.15s | [Unit.js:1160-1169](src/entities/Unit.js#L1160-L1169) |
| Whip arc slash | 0.2s | [Unit.js:1190-1199](src/entities/Unit.js#L1190-L1199) |
| Multi‑slash diagonal | 0.25s | [Unit.js:1247-1256](src/entities/Unit.js#L1247-L1256) |
| Beam (railgun) | 0.25s | [Unit.js:1283-1284](src/entities/Unit.js#L1283-L1284) |
| Explosion ring | 0.3s | [Projectile.js:136](src/entities/Projectile.js#L136), [:187](src/entities/Projectile.js#L187) |
| Orbiters (chain) | `angularSpeed 2.6`, `duration 2.0` | [Unit.js `_spawnOrbiters`:1203-1219](src/entities/Unit.js#L1203-L1219) |

`state.slashes / beams / bolts` decay by `realDt` in
[GameScene.js:288-297](src/phaser/scenes/GameScene.js#L288-L297); `explosions` decay by
`gameDt` at [GameScene.js:481-485](src/phaser/scenes/GameScene.js#L481-L485). `swing` /
`throwArm` decay inside `Unit.update(gameDt)`.

---

## 3. Goal

1. Slow projectile travel (and spin) to ~10% so they are clearly trackable.
2. Slow attack animations (swing, throw, whip/slash/beam overlays, orbit) to ~10% so they
   are clearly readable.
3. Do it through **one tuning module** so the factor can be dialled (or reset to 1.0) later
   without touching gameplay code again.
4. Preserve trajectories, ranges, hit detection, and DPS pipeline as much as possible — this
   is a *presentation* change, not a balance rework.

Out of scope: fire cadence (`atkRate`) — see §7. Ability‑driven motion (Dick boomerang,
mill/vortex/dance, acid shots, group abilities) — see §8.

---

## 4. Design — single source of truth

The cleanest way to get true slow‑motion for projectiles is **to scale the `dt` they are
simulated with**, not to edit every speed/gravity constant. Scaling `dt` automatically and
correctly slows travel, spin, gravity arcs, bounces, and lifetime accumulation while keeping
all trajectories, ranges, and stored velocities (and therefore motion‑blur trails) intact.

Animations that are not simulated per‑frame from a velocity (swing decay, slash/beam
lifetimes) are slowed by **stretching their duration** (multiply lifetime by `1/scale`).

Create **`src/config/combatTuning.js`**:

```js
// Slow-motion factors for weapon presentation. Set both to 1.0 to restore the
// original full-speed behaviour. 0.1 = play at 10% speed.
//
// PROJECTILE_TIME_SCALE  multiplies the dt that travelling projectiles
//   (Projectile, ShotgunBullet, BouncingProjectile) are simulated with.
//   Slows travel + spin + gravity arcs + bounce timing uniformly; ranges and
//   trajectories are unchanged (they're distance-based), projectiles simply
//   take 1/scale longer to cover the same path and live 1/scale longer.
export const PROJECTILE_TIME_SCALE = 0.1;

// ATTACK_ANIM_SCALE  playback speed of attack animations (swing/throw decay,
//   orbit angular speed). ANIM_DURATION_MULT stretches fixed-lifetime visual
//   overlays (slashes, beams, explosions) so they last 1/scale longer.
export const ATTACK_ANIM_SCALE  = 0.1;
export const ANIM_DURATION_MULT = 1 / ATTACK_ANIM_SCALE; // = 10
```

---

## 5. Implementation steps

### Step 1 — Slow travelling projectiles (one line)

[GameScene.js:346](src/phaser/scenes/GameScene.js#L346)

```js
import { PROJECTILE_TIME_SCALE } from '../../config/combatTuning.js';
// ...
for (const pr of state.projectiles) pr.update(gameDt * PROJECTILE_TIME_SCALE);
```

This covers **every** travelling weapon projectile (bolts, thrown, boomerang, bounce,
arcDown, catapult). Because `life += dt` is also scaled, the existing `maxLife` (2.5s in
`Projectile`) and bounce `lifetime` caps now correspond to ~10× real seconds — long enough to
reach max range — so **no lifetime constants need editing**.

> Note: keep the projectile `draw()` trail code as‑is. It derives trail length from the
> stored `speed`/`vx` (unchanged by dt‑scaling), so trails stay full‑length and readable.

### Step 2 — Slow melee swing & throw animations

[Unit.js:723-725](src/entities/Unit.js#L723-L725)

```js
import { ATTACK_ANIM_SCALE } from '../config/combatTuning.js';
// ...
this.swing    = Math.max(0, this.swing    - dt * 6 * ATTACK_ANIM_SCALE);
this.throwArm = Math.max(0, this.throwArm - dt * 4 * ATTACK_ANIM_SCALE);
```

Slowing `swing` automatically slows the swing arc and the crescent trail in `_drawWeapon`
([Unit.js:2200-2238](src/entities/Unit.js#L2200-L2238)) and the secondary club trail
([Unit.js:1879-1882](src/entities/Unit.js#L1879-L1882)) since both are driven by `this.swing`.

### Step 3 — Stretch fixed‑lifetime overlay visuals

Multiply the spawned `life`/`maxLife` by `ANIM_DURATION_MULT` (import it in `Unit.js` and
`Projectile.js`). The `alpha = life / maxLife` fade mapping stays correct; the overlay just
persists longer.

- Whip box slash — [Unit.js:1160-1169](src/entities/Unit.js#L1160-L1169) (`0.15`)
- Whip arc slash — [Unit.js:1190-1199](src/entities/Unit.js#L1190-L1199) (`0.2`)
- Multi‑slash diagonal — [Unit.js:1247-1256](src/entities/Unit.js#L1247-L1256) (`0.25`)
- Beam — [Unit.js:1283-1284](src/entities/Unit.js#L1283-L1284) (`0.25`)
- Explosion rings — [Projectile.js:136](src/entities/Projectile.js#L136) & [:187](src/entities/Projectile.js#L187) (`0.3`)
- The white "puff" particles spawned alongside whips/slashes (e.g. [Unit.js:1158-1159](src/entities/Unit.js#L1158-1159)) — bump their `life`/`maxLife` the same way so the flash matches the longer slash.

> Implementation tip: factor a tiny helper, e.g. `const SLASH_LIFE = 0.15 * ANIM_DURATION_MULT;`
> at the top of each method, rather than sprinkling the multiply inline, to keep diffs readable.

### Step 4 — Slow orbiters (chain_with_padlock)

[Unit.js `_spawnOrbiters`:1203-1219](src/entities/Unit.js#L1203-L1219) — orbiters are advanced
in `Unit.update(gameDt)`, not via `state.projectiles`, so apply the scale at spawn:

```js
angularSpeed: p.angularSpeed * ATTACK_ANIM_SCALE,
// ...
life: p.duration * ANIM_DURATION_MULT,   // keep total revolutions the same
```

(Their per‑enemy `hitCooldowns` of 0.5s tick on `gameDt` and can stay; optionally stretch for
consistency.)

### Step 5 — (Optional) slow explosion expansion

Explosion radius grows via `ex.r += (ex.maxR - ex.r) * Math.min(1, gameDt * 8)`
([GameScene.js:483](src/phaser/scenes/GameScene.js#L483)). With a longer life the ring lingers
but still snaps to full radius quickly. If the expansion itself should be slow‑mo, change the
`8` to `8 * ATTACK_ANIM_SCALE`. Low priority / cosmetic.

---

## 6. Per‑weapon coverage matrix

| Weapon | behavior | Slowed by |
|---|---|---|
| car_antenna | multiSlash | swing (Step 2) + diagonal slash life (Step 3) |
| toilet_lid | bounce (melee) | projectile dt (Step 1) + swing (Step 2) |
| bus_stop_pole | arcDown | projectile dt (Step 1) + swing (Step 2) |
| shower_hose | whip (box) | box slash life (Step 3) + throwArm (Step 2) |
| chain_with_padlock | orbit | orbiter angularSpeed/duration (Step 4) |
| extension_cord | whip (arc) | arc slash life (Step 3) + throwArm (Step 2) |
| richards_megaphone | aura | static ring; tick 0.5s — no travel (see §7) |
| frozen_cutlet | bounce (thrown) | projectile dt (Step 1) |
| pickle_jar | groundZone | projectile dt (Step 1); zone is static |
| bottle_cap_shuriken | boomerang | projectile dt (Step 1) |
| bed_spring_arbalest | bolt | projectile dt (Step 1) |
| bike_spoke_slingshot | bolt | projectile dt (Step 1) |
| courtyard_railgun | chargeBeam | beam life (Step 3); charge time unchanged |
| contraceptive_catapult | lobExplode | projectile dt (Step 1) + explosion life (Step 3) |
| fence_wire_bow | directional | projectile dt (Step 1) |

Every weapon is covered by Steps 1–4.

---

## 7. Decisions & risks

- **Fire cadence (`atkRate`) is intentionally NOT changed.** "Visibility" is about travel and
  animation playback, not how often a weapon fires. Slowing cadence 10× would gut DPS and make
  the game feel sluggish. If, after testing, slower firing is also wanted, add an
  `ATTACK_RATE_MULT` and apply it in [`_slotAtkRate`:1355-1361](src/entities/Unit.js#L1355-L1361)
  and the `atkRate` getter — but recommend leaving cadence at 1.0.
  - Side effect to watch: with fast cadence + 10× swing duration, a melee weapon may re‑trigger
    `swing = 1` before the previous swing finishes, so the arc holds near its peak (continuous
    swinging). This reads fine but is worth eyeballing per weapon.
- **Slow projectiles vs. moving enemies.** A 10%‑speed projectile takes ~10× longer to reach
  its target, so fast/erratic enemies dodge more and effective ranged DPS drops even though
  cadence is unchanged. Acceptable for a visibility/testing pass; revert `PROJECTILE_TIME_SCALE`
  toward 1.0 if balance matters. This is exactly why it's a single tunable constant.
- **10% may be extreme for the slowest projectiles** (e.g. catapult lob). Treat 0.1 as the
  starting value and tune `PROJECTILE_TIME_SCALE` in the 0.1–0.25 range while testing.
- **Megaphone aura** has no travel and only a 0.5s damage tick; nothing to slow visually. Leave
  unless its pulse ring should breathe slower (cosmetic).
- **Time‑flow interaction.** Combat only advances while heroes move or an ability is active
  (`gameDt = realDt * timeFlow`, [GameScene.js:236-241](src/phaser/scenes/GameScene.js#L236-L241)).
  The slow‑mo scales stack on top of that, which is fine — when standing still everything is
  already frozen.

---

## 8. Out of scope (do not touch in this pass)

Ability motion is separate from weapons: Dick boomerang ([Unit.js `_updateBoomerang`](src/entities/Unit.js#L773)),
mill/vortex/dance‑of‑death orbits, `acidShots` ([GameScene.js:351-356](src/phaser/scenes/GameScene.js#L351-L356)),
and group abilities. If the user later wants those slowed too, they get their own scale knobs.

---

## 9. Validation

1. `npm run build` must pass (no runtime app launch — manual play‑testing is the author's).
2. Manual smoke (author): equip and watch each of the 15 weapons; confirm:
   - projectiles are individually trackable across the gap to the enemy;
   - melee swing arcs, whip boxes/arcs, multi‑slashes, and the railgun beam are each clearly
     visible;
   - orbiters circle slowly and last the same number of revolutions;
   - projectiles still reach and damage stationary enemies (no premature culling).
3. Set both scales back to `1.0` and confirm behaviour matches pre‑change (regression guard).

---

## 10. Rollback / tuning

All behaviour lives in two constants in `src/config/combatTuning.js`. `1.0 / 1.0` = original
game. `0.1 / 0.1` = the 10% target. No other file needs editing to re‑tune.

---

## 11. Documentation updates on completion

- Update [docs/current/current_game_state.md](docs/current/current_game_state.md) to note the
  combat‑speed tuning knobs and their default.
- Add `combatTuning.js` to [docs/current/implementation_notes.md](docs/current/implementation_notes.md).
- Move this file to `docs/executed/` (or mark items done) once shipped, and update
  [docs/index.md](docs/index.md).
