# Weapon Rework 6 — Animation & Behaviour Fixes (Status: Completed)

This plan has been fully implemented. All animation and behavior fixes for the six weapons are complete.

Screenshot of current broken state: `docs/Screenshot 2026-06-20 213227.png`
(big translucent rings + falling circles + left/right rectangles).

---

## Architecture recap (where things live)

| Concern | Location |
|---|---|
| Weapon stats/config | `src/config/weapons.js` (`WEAPON_DEFS`, `resolveWeaponStats`) |
| Behaviour dispatch | `Unit.attack()` — `src/entities/Unit.js:948` |
| Per-frame behaviours (aura, orbit, beam) | `Unit.update()` — `src/entities/Unit.js:576`-`650`, auto-attack loop `736`-`769` |
| Attack implementations | `Unit._attack*` / `_spawnOrbiters` — `Unit.js:1062`-`1330` |
| Overlay visuals (slashes/beams/explosions) | `src/render/effects.js` |
| Held-weapon sprite + swing | `Unit._drawWeapon()` — `Unit.js:2195`; `Unit.draw()` — `Unit.js:1651` |
| Weapon pixel sprites | `src/render/weaponSprites.js` |
| Slow-mo tuning | `src/config/combatTuning.js` (`ATTACK_ANIM_SCALE`, `ANIM_DURATION_MULT = 10`) |
| Particle update (gravity!) | `src/phaser/scenes/GameScene.js:302`-`306` |
| World draw order | `GameScene.js:815`-`821` (`drawBolts → drawBeams → drawSlashes → drawExplosions → drawShockwaves → drawParticles`) |

### Cross-cutting root cause: gravity on overlay particles

Every particle gets `p.vy += 220 * d` each frame (`GameScene.js:304`). The whip
and multiSlash code push **giant "overlay" particles** whose `size` is the full
effect radius (e.g. `size: radius` = 100). These render as big soft circles via
the particle line-renderer and then **fall down the screen** for their whole
(×10-stretched) lifetime. This is the "strange blue circle that falls down" the
player sees, and the general visual clutter in the screenshot.

> The correct overlays already exist in `state.slashes` (drawn by `drawSlashes`,
> which is positioned correctly and does **not** fall). The duplicate
> `state.particles.push({... size: <radius> ...})` calls in `_attackWhip` and
> `_attackMultiSlash` are pure clutter and must be **removed**.

---

## Weapon 1 — Megaphone (`richards_megaphone`) → Garlic

**Behaviour:** `aura`. Damage tick logic works (`Unit.js:598`-`617`): every
`aura.tickInterval` it damages all enemies within `auraRadius`.

**Problem:** No code anywhere draws the aura — it is completely invisible.

**Fix — add a persistent aura visual:**
1. In `Unit.draw()`, near the top (after `ctx.save()/translate`, before the body
   so it renders *under* the hero), iterate `this.weaponSlots`; for any slot whose
   resolved `behavior === 'aura'`, draw a damaging-zone disc centred on the hero:
   - Filled translucent disc at `resolveWeaponStats(slot).auraRadius ?? 100`
     (soft radial gradient, low alpha), plus a brighter rim ring.
   - A slow pulse driven by `state.time` (scale/alpha oscillation) so it reads as
     "active".
   - A **sonic ripple**: expanding concentric ring synced to the tick — drive it
     from `slot.auraT / aura.tickInterval` (0→1) so a ring expands out to the edge
     and resets on each damage tick. This sells the Garlic-style pulse.
2. Palette: Richard's megaphone is yellow (`8`); use a warm yellow→cyan sonic
   tint, additive rim, distinct from the green acid/zone visuals.
3. Optional polish: emit a few faint outward particles on each tick inside the
   existing tick block (`Unit.js:601`).

**Files:** `Unit.js` (`draw()` add aura pass). Optionally factor a
`drawAura(ctx, x, y, radius, phase)` helper into `effects.js`.

---

## Weapon 2 — Extension Cord (`extension_cord`) → Whip

**Behaviour:** `whip`, `whip: { shape:'arc', radius:100, arcDeg:270 }`.

**Problem:** Renders a 270° ring around the hero (the big arc in the screenshot)
— not a whip. Also pushes a `size: radius` overlay particle (`Unit.js:1192`) that
falls/lingers (the falling blue circle).

**Fix — convert to a directional lash (see shared "whip lash" work below):**
1. Config (`weapons.js:155`): replace `whip` with the new lash shape, e.g.
   `whip: { shape:'lash', length:130, halfHeight:18, sides:1 }`. Keep it long &
   thin (Common, single forward lash toward the target).
2. Use the shared forward-rectangle hit test and `'whip'` slash render type
   (below). Delete the `arc` branch's overlay particle.

---

## Weapon 3 — Shower Hose (`shower_hose`) → Whip (with crack SFX)

**Behaviour:** `whip`, `whip: { shape:'box', length:120, halfHeight:20, sides:2 }`.

**Problem:** Renders two static rectangles left & right (`drawSlashes` `box` type,
`effects.js:315`) + two falling `size: halfHeight` overlay particles
(`Unit.js:1160`). Looks like rectangles, not a whip. No whip sound.

**Fix:**
1. Config (`weapons.js:105`): `whip: { shape:'lash', length:120, halfHeight:22, sides:2 }`
   — two lashes (forward + behind, VS-style alternating), wider than the cord.
2. Use shared lash hit + render (below).
3. **Whip SFX:** play a crack on fire. Add a new key `weapon.whip.crack` with a
   `fallback: 'weapon.attack.default'` so it works before the asset exists, then
   add the audio file per `docs/current/adding_assets.md`. Replace the generic
   `playSfx('weapon.throw.default')` in `_attackWhip` (`Unit.js:1138`).

---

### Shared work for Weapons 2 & 3 — the "whip lash" system

`_attackWhip` (`Unit.js:1136`) currently branches on `shape: 'box' | 'arc'`.
Replace both with a single `shape: 'lash'` path:

**Hit detection** (oriented forward box along `this.facing`, repeated for each
side `k` in `[0 .. sides-1]` at angle `this.facing + k * π`):
- For each enemy, transform its position into the lash's local frame
  (rotate by `-ang`); hit if `0 ≤ localX ≤ length + r` and `|localY| ≤ halfHeight + r`.
- Apply damage, `_gainWeaponXp`, `_applyWeaponEffect`, knockback along `ang`,
  `pushDamageNumber`. (Keep existing damage math.)

**Render** — add a new `type: 'whip'` to `state.slashes` and a branch in
`drawSlashes` (`effects.js:309`):
- A tapered, slightly curved lash: a quadratic curve from the hero outward along
  `ang`, thick (`halfHeight*2`) at the base tapering to a point at the tip.
- Animate the sweep over its short life: bow the control point up→down (use
  `s.life/s.maxLife`) so it cracks like a real whip.
- Bright tip flash (small additive circle) at the end point.
- Lifetime stays `0.15-0.2 * ANIM_DURATION_MULT` (already stretched by slow-mo).

**Remove** the `state.particles.push({... size: ... })` overlay particles in both
old branches (they are the falling circles).

> Keep the `box`/`arc` branches only if another weapon still uses them — grep
> confirms only `extension_cord` (arc) and `shower_hose` (box) do, so both can be
> deleted once migrated.

---

## Weapon 4 — Car Antenna (`car_antenna`) → range too short

**Behaviour:** `multiSlash`. `_attackMultiSlash` (`Unit.js:1237`) uses
`_findNearestN(stats.atkRange, count)`.

**Problem:** `atkRange: 55` (`weapons.js:25`) — barely reaches past the hero.

**Fix:**
1. Bump base `atkRange` to ~`150` (tune 140-180). `levels[]` don't override
   `atkRange`, so the base bump applies at all levels.
2. While here, remove the duplicate falling overlay particle in `_attackMultiSlash`
   (`Unit.js:1250`, `size: 20`) — the `diagonal` slash overlay already renders the
   hit; the particle just falls and clutters.
3. Sanity-check the held-weapon reach visual still looks right with the longer
   range (the slashes spawn on the enemies, so no change needed there).

---

## Weapon 5 — Doggo Chain (`chain_with_padlock`) → King Bible

**Behaviour:** `orbit`. `_spawnOrbiters` (`Unit.js:1206`) builds `this.orbiters`;
`update()` moves them and applies contact damage with per-enemy cooldown
(`Unit.js:621`-`650`).

**Problems:**
- **Orbiters are never drawn** — no render code reads `this.orbiters`. Zero
  visible animation.
- It's spawned per-attack (`atkRate 1.6s`) and **replaces** the array each time
  (`this.orbiters = []`), so the orbit resets/stutters.
- Effective angular speed = `2.6 * ATTACK_ANIM_SCALE(0.1)` ≈ 0.26 rad/s — far too
  slow for a King-Bible orbit.

**Fix — make it a persistent, visible orbit:**
1. **Make it always-on (like aura/beam):**
   - In the auto-attack loop skip list (`Unit.js:743`) add `'orbit'` so it isn't
     fired as a discrete attack, and remove `'orbit'` from the `isTargetless`
     list (`Unit.js:748`).
   - In `Unit.update()` per-slot loop (alongside `aura`/`chargeBeam`,
     `Unit.js:577`-`618`), ensure orbiters exist while the slot is equipped:
     lazily spawn `orbit.count` orbiters once, keep them alive (drop the
     `life`/expiry decay, or refresh it each frame), and rotate continuously.
   - Drive damage from the existing orbiter update block (keep per-enemy
     `hitCooldowns`).
2. **Angular speed:** target ~`2.0-3.0 rad/s` effective. Either stop multiplying
   orbit angular speed by `ATTACK_ANIM_SCALE`, or raise the base accordingly.
   Radius ~`64` is fine; consider `count: 2`.
3. **Render (the missing piece)** — in `Unit.draw()` add an orbiter pass:
   - For each orbiter compute `ox/oy = this.{x,y} + cos/sin(angle) * radius`.
   - Draw the **chain**: a line of small grey links (palette `5`/`b`) from the
     hero to `(ox, oy)`, e.g. 4-6 short segments / dashed metallic stroke.
   - Draw the **padlock**: `drawWeaponSprite(ctx, 'chain_with_padlock', ox, oy,
     scale, angle + π/2)` so the lock faces outward.
   - Optional: faint motion trail behind each padlock.
4. Keep `cleave`/knockback feel; verify damage cadence reads well with the
   `0.5 * ANIM_DURATION_MULT` hit cooldown (`Unit.js:646`).

**Files:** `Unit.js` (update + draw), no new render module required.

---

## Weapon 6 — Catapult (`contraceptive_catapult`) → Fire Wand (explode on impact)

**Behaviour declared:** `type:'ranged'`, `behavior:'lobExplode'`.

**Problems:**
1. **Dispatch short-circuit:** `attack()` checks `type === 'ranged'` *first*
   (`Unit.js:955`) and routes to `_attackRanged` → a straight `ShotgunBullet`.
   The `lobExplode` branch is **never reached**.
2. **No `aoeRadius`** in the config — even via `Projectile` there'd be no
   explosion (`Projectile.explode()` is gated on `aoeRadius > 0`,
   `Projectile.js:186`).
3. `Projectile` defaults `returns = wDef.returns !== false` → **true**, so without
   `returns:false` it would boomerang instead of exploding.

   > The straight orange `ShotgunBullet` it currently fires is what the player is
   > seeing; the "blue circle that falls" is the unrelated whip-arc overlay
   > particle (Weapon 2). Both go away with these fixes.

**Fix:**
1. **Dispatch:** make `lobExplode` win over `type:'ranged'`. In `attack()`
   (`Unit.js:955`) add, *before* the `type === 'ranged'` branch:
   `if (stats.behavior === 'lobExplode') { this._attackLob(stats, enemy); return; }`
   (or fold into `_attackThrown`). Leave `bolt`/`directional` on `_attackRanged`.
2. **Config (`weapons.js:355`):** add `returns: false`, `piercing: false`,
   `aoeRadius: 70` (tune 60-90), and `projectileMaxRange: 400`. Optionally add an
   `aoeRadius` bump in late `levels[]`.
3. **Implementation:** route through a `Projectile` (`_attackThrown` already does
   `new Projectile(sx, sy, enemy, dmg, facing, this, stats)`). `Projectile`
   already supports the desired flow:
   - flies toward the target's position at fire time,
   - on enemy contact **or** reaching target/maxRange with `aoeRadius>0 && !returns`
     → `explode()` (`Projectile.js:69`, `135`, `186`): pushes `state.explosions`
     and deals `dmg * 0.6` AoE in `aoeRadius`.
4. **Explosion visual polish:** `drawExplosions` (`effects.js:91`) currently draws
   only a brown smoke ring. For a Fire-Wand feel, on `explode()` also emit a burst
   of fire particles (orange/yellow, `realtime`) and a brief additive flash, and/or
   add a fiery gradient ring in `drawExplosions`. Add a small `state.shake` bump.
5. **Lob arc (optional, nice-to-have):** for a true lobbed look, give the
   projectile a rising/falling `z` arc (Projectile already has `this.z`), or fire
   it via a gravity `BouncingProjectile` (cf. `_attackArcDown`, `Unit.js:1113`)
   that explodes when it lands. Keep straight-flight as the baseline if arc proves
   fiddly.

---

## Implementation order (suggested commits)

1. **Quick wins (config-only):** Car Antenna range (#4); Catapult dispatch +
   config + explosion (#6). Verify build.
2. **Whip lash system (#2 + #3):** new `'lash'` shape in `_attackWhip`, `'whip'`
   render in `drawSlashes`, remove falling overlay particles, whip SFX. Migrate
   both weapons.
3. **Orbit visibility + persistence (#5):** loop changes, render padlock+chain.
4. **Megaphone aura visual (#1).**
5. **Cleanup pass:** remove now-dead `box`/`arc` whip branches & their overlay
   particles; remove the multiSlash overlay particle.

Each step is independent enough to build & playtest on its own.

---

## Testing & validation

- The user playtests manually. **Do not launch/drive the game.** Validate each
  step with `npm run build` only (must compile clean).
- Manual smoke (user): each weapon shows a clear, correct animation —
  Megaphone pulsing aura ring; Extension Cord / Shower Hose forward lash crack
  (Shower Hose audible); Car Antenna reaches enemies at distance; Doggo Chain
  padlocks orbiting on chains; Catapult lobs and explodes in a radius.
- Confirm no big translucent circles fall down the screen anymore.

## Docs to update on completion (per `CLAUDE.md`)

- `docs/current/current_game_state.md` — weapon behaviour notes (whip = lash,
  orbit persistent, catapult = lob+explode).
- `docs/current/implementation_notes.md` — new `'lash'`/`'whip'` slash type,
  aura/orbit render passes, `lobExplode` dispatch.
- Move this file to `docs/executed/` and mark items complete; add the whip SFX to
  `docs/current/adding_assets.md` audio section if a new asset is introduced.
