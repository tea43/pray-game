# Weapon Rework 3 — Unique Vampire-Survivors-Style Behaviours

**Status:** Plan (not yet executed)
**Branch:** `weapons_updates`
**Goal:** Give every weapon a distinct attack behaviour modelled on a specific Vampire Survivors weapon, replacing the current 4-way (`melee` / `cleave` / `thrown` / `ranged`) behaviour set with a richer, data-driven behaviour registry. Deprecate two weapons, add one new weapon (Richard's Megaphone).

Reference: https://vampire.survivors.wiki/w/Weapons

---

## 1. Why this is a real architectural change, not a stat pass

Today a weapon's behaviour is fully described by `type` (+ the `cleave` flag) and dispatched by a 4-branch switch in `Unit.attack()`:

- `src/entities/Unit.js:852` `attack(enemy, stats)` → `_attackRanged` / `_attackThrown` / `_attackCleave` / `_attackMelee`.
- The auto-attack driver at `src/entities/Unit.js:658-673` **requires a target**: it calls `_findTarget(stats.atkRange)` (nearest living enemy, `Unit.js:1011`) and `continue`s if none is found. So every weapon currently aims at the **nearest** enemy and does nothing when none is in range.
- Projectiles come in two flavours only:
  - `Projectile` (`src/entities/Projectile.js`) — homes toward the target's captured position, optional `returns` / `piercing` / `aoeRadius`.
  - `ShotgunBullet` (`src/entities/ShotgunBullet.js`) — straight line along `this.facing`, single hit, dies on first contact or `maxRange`.

The VS behaviours we want need mechanics the engine does not have:

| Needed mechanic | Exists today? |
|---|---|
| Fire at a **random** enemy | ❌ (only nearest) |
| Fire in **facing / movement direction** ignoring targets | ❌ (loop skips when no target) |
| **Bounce / ricochet** off screen bounds & enemies | ❌ |
| **Orbiting** weapon around the hero | ❌ (only ability-driven mill/vortex) |
| Persistent **ground damage zones** | ❌ (shockwaves are one-shot expanding rings) |
| Continuous **aura** around the hero | ❌ |
| **Charge-up** then piercing **beam** | ❌ |
| Horizontal **whip box** (no projectile, pass-through) | ❌ |
| **Multi-slash** at several nearest enemies | ❌ |
| **Arc-down** lobbed area projectile | partial (`Projectile` + `aoeRadius`, but no arc/lob and impact is on first enemy, not ground point) |

So the core of this rework is: **(a)** introduce a `behavior` field + behaviour registry, **(b)** make the auto-attack loop behaviour-aware (target-required vs. self-driven), and **(c)** add the few new entity/system primitives the behaviours share.

---

## 2. Target weapon roster

15 active weapons after the rework, plus 2 deprecated. New key in **bold**.

| # | Weapon (key) | VS analog | `behavior` | Core mechanic |
|---|---|---|---|---|
| 1 | `frozen_cutlet` | Runetracer | `bounce` | Fast projectile, **pierces** enemies, **ricochets** off play-area bounds, limited bounce count / lifetime. |
| 2 | `bed_spring_arbalest` | Fire Wand | `randomBolt` | Targets a **random** enemy in range, single heavy-damage straight bullet. |
| 3 | `bike_spoke_slingshot` | Magic Wand | `nearestBolt` | Targets **nearest** enemy, straight bullet (today's default ranged — keep, formalise). |
| 4 | `courtyard_railgun` | C·U·Laser | `chargeBeam` | **Charges** for N seconds, then fires a **piercing beam** at a random enemy direction. |
| 5 | `contraceptive_catapult` | (bespoke) | `lobExplode` | Slow **lobbed** projectile that **explodes** on impact, AoE damage in a radius. |
| 6 | `fence_wire_bow` | Knife | `directional` | Fires quickly in the hero's **facing/movement** direction, no target lock, piercing-lite. |
| 7 | `shower_hose` | Whip | `whip` | **Horizontal** rectangular hitboxes left & right of hero, **pass-through**, no projectile. |
| 8 | `chain_with_padlock` | King Bible | `orbit` | One or more chains **orbit** the hero, damaging on contact. |
| 9 | `pickle_jar` | Santa Water | `groundZone` | Lobs jars that create **persistent damaging ground zones**. |
| 10 | `extension_cord` | Whip (long) | `whip` | Longer-range whip with a **270° sweep** arc around the hero (distinct from Shower Hose's horizontal lash). |
| 11 | `bottle_cap_shuriken` | Cross | `boomerang` | Aims at **nearest**, flies out and **returns** (boomerang), piercing on the way. |
| 12 | **`richards_megaphone`** | Garlic | `aura` | Continuous **damaging aura** ring around the hero; ticks on enemies inside. |
| 13 | `car_antenna` | Victory Sword | `multiSlash` | Spawns a burst of **blue slashes** at the N nearest enemies. |
| 14 | `toilet_lid` | Bone | `bounce` | Lobbed projectile that **bounces** along the ground a few times. |
| 15 | `bus_stop_pole` | Axe | `arcDown` | High-damage projectile thrown **upward**, **arcs down** through enemies; high Area scaling. |
| 16 | `radiator_rib` | — | **deprecated** | Remove from defs, pools, render maps. |
| 17 | `plastic_chair` | — | **deprecated** | Remove from defs, pools, render maps. **Currently Dick's starting weapon** — must reassign. |

Notes:
- `frozen_cutlet` (Runetracer) and `toilet_lid` (Bone) share a `bounce` behaviour but with different params (ricochet off bounds vs. bounce along ground, bounce counts, gravity).
- `shower_hose` and `extension_cord` share `whip` with different range/pattern params.
- `bike_spoke_slingshot`/`bed_spring_arbalest` differ only in **targeting** (`nearest` vs `random`) — both straight bullets. We can express targeting as a param of one `bolt` behaviour instead of two behaviours (see §4).

---

## 3. Data model changes — `src/config/weapons.js`

Add a `behavior` string to every weapon and a behaviour-specific params block. Keep `type` for now only where rendering/HUD reads it, or migrate those reads to `behavior` (see §8). Keep the existing `levels[]` mechanism (`resolveWeaponStats` at `weapons.js:403` already merges per-level overrides — behaviour params can be levelled too).

Proposed shape (example entries):

```js
frozen_cutlet: {
  displayName: 'Frozen Cutlet',
  behavior: 'bounce',
  rarity: 'Common',
  atkDmg: 40, atkRate: 0.8, atkRange: 300,
  projectileSpeed: 460,
  bounce: { maxBounces: 4, pierce: true, lifetime: 3.0, offBounds: true },
  sprite: 'frozen_cutlet',
  levels: [ /* per-level atkDmg/atkRate (+ optional bounce.maxBounces bumps) */ ],
},

chain_with_padlock: {
  displayName: 'Doggo Chain',
  behavior: 'orbit',
  rarity: 'Epic',
  atkDmg: 30, atkRate: 2.2, // atkRate = re-summon / pulse period
  orbit: { count: 2, radius: 64, angularSpeed: 2.6, duration: 2.0, tickInterval: 0.25 },
  sprite: 'chain_with_padlock',
  levels: [ /* bump count/duration/atkDmg */ ],
},

pickle_jar: {
  displayName: 'Pickle Jar',
  behavior: 'groundZone',
  rarity: 'Epic',
  atkDmg: 24, atkRate: 1.6, atkRange: 220,
  projectileSpeed: 380,
  zone: { radius: 48, duration: 3.0, tickInterval: 0.4 },
  sprite: 'pickle_jar',
  levels: [ /* bump zone.radius/duration/atkDmg */ ],
},
```

Targeting param (folds Fire Wand vs Magic Wand into one path):

```js
bed_spring_arbalest: { behavior: 'bolt', targeting: 'random', /* heavy dmg, slow rate */ },
bike_spoke_slingshot:{ behavior: 'bolt', targeting: 'nearest', /* light dmg, fast rate */ },
```

`resolveWeaponStats` needs no signature change — nested objects (`bounce`, `orbit`, `zone`) flow through `{ ...def, ...lvl }` fine, but **per-level overrides of nested objects replace, not merge**. If we want to level a single nested field, either (a) put levelled scalars at the top level (`zoneRadius`, `orbitCount`) and read those, or (b) extend `resolveWeaponStats` to deep-merge known nested keys. **Recommendation:** keep levelled values as flat top-level scalars (simplest, matches current `aoeRadius` precedent at `weapons.js:253`).

---

## 4. Behaviour registry + auto-attack loop

### 4.1 Behaviour-aware auto-attack driver

Replace the target-gated loop at `Unit.js:658-673` with a behaviour dispatch. Each behaviour declares whether it needs a target:

```js
// pseudo-structure
const TARGETLESS = new Set(['whip', 'orbit', 'aura', 'directional']);

for (const slot of this.weaponSlots) {
  if (!slot) continue;
  slot.atkCd -= dt;
  if (slot.atkCd > 0) continue;
  const stats = resolveWeaponStats(slot);

  if (TARGETLESS.has(stats.behavior)) {
    this._fireWeapon(stats, null);              // whip/orbit/aura/directional fire regardless
    slot.atkCd = this._slotAtkRate(stats);
  } else {
    const target = this._acquireTarget(stats);  // nearest OR random per stats.targeting
    if (!target) continue;
    this._fireWeapon(stats, target);
    slot.atkCd = this._slotAtkRate(stats);
  }
}
```

`aura` is a special case — it is "always on" rather than "fires on cooldown". Implement it as a persistent per-unit field refreshed each tick (see §5.5) and skip it in this loop, OR let the loop re-assert the aura's tick state on `atkRate` cadence. **Recommendation:** treat `aura` as a continuous effect updated in `Unit.update()` like the existing flamethrower/garlic-style timers (`Unit.js:547-597`), keyed off the equipped slot, not the cooldown loop.

### 4.2 `_fireWeapon(stats, target)` dispatcher

A thin switch (or a map of handler fns) replacing `attack()` (`Unit.js:852`). Keep the old private attack methods where they still apply and add new ones:

| `behavior` | Handler | Reuses / new |
|---|---|---|
| `bolt` (nearest/random) | `_attackRanged` | reuse `ShotgunBullet` (`Unit.js:994`) |
| `boomerang` | `_attackThrown` | reuse `Projectile` w/ `returns:true` (`Unit.js:985`) |
| `lobExplode` | `_attackLob` | new: `Projectile` variant + explosion (§5.1) |
| `bounce` | `_attackBounce` | new `BouncingProjectile` (§5.2) |
| `whip` | `_attackWhip` | new box hitbox (§5.3) |
| `orbit` | `_spawnOrbiters` | new orbiter system (§5.4) |
| `aura` | continuous in `update()` | new (§5.5) |
| `chargeBeam` | `_attackBeam` (deferred fire) | new charge + beam (§5.6) |
| `directional` | `_attackDirectional` | new straight bullet along facing (§5.7) |
| `multiSlash` | `_attackMultiSlash` | new slash burst (§5.8) |
| `arcDown` | `_attackArcDown` | new lobbed arc projectile (§5.9) |

### 4.3 Targeting helpers

`_findTarget(range)` (nearest) already exists at `Unit.js:1011`. Add:

```js
_findRandomTarget(range) {
  const in_range = state.enemies.filter(e => !e.dead && dist2(this.x,this.y,e.x,e.y) < range);
  return in_range.length ? in_range[(Math.random()*in_range.length)|0] : null;
}
_findNearestN(range, n) { /* sorted by dist, first n */ }
_acquireTarget(stats) {
  return stats.targeting === 'random' ? this._findRandomTarget(stats.atkRange)
                                       : this._findTarget(stats.atkRange);
}
```

---

## 5. New entities & shared systems

The codebase already has the lifecycle hooks we need. New per-frame entities go into a `state.*` array, get `update(dt)`/decay in `GameScene.update()` (alongside `state.projectiles` at `GameScene.js:336`, `state.acidShots` at `:340`, `state.shockwaves` at `:451`), and draw in `GameScene.render()` (`:745` projectiles, `:749` acid shots). Damage application matches the existing pattern: `e.hp -= dmg; e.hurtFlash = 1; pushDamageNumber(...)`, blood/particle spray, optional `state.shake`.

### 5.1 Lobbed explosion (`lobExplode` — Catapult)
- Reuse `Projectile` with `returns:false`, slow `projectileSpeed`, and a non-zero `aoeRadius`. `Projectile.hitEnemy` already does radial AoE at `Projectile.js:111-120`.
- Add an explosion **visual** on detonation: `state.explosions.push({ x, y, r, maxR, life, maxLife })` (decayed at `GameScene.js:445`; drawn by `drawExplosions`). Optionally a `state.shockwaves` ring for the shock.
- Detonate on first enemy contact **or** at `projectileMaxRange` (ground impact) — extend `Projectile.updateOutbound` (`Projectile.js:64-67`) to call an `explode()` instead of plain `cleanup()` when `aoeRadius>0`.

### 5.2 Bouncing projectile (`bounce` — Runetracer, Bone) — **new `BouncingProjectile.js`**
- Owns `vx,vy`, `bouncesLeft`, `lifetime`, `pierce`.
- Runetracer mode (`offBounds:true`): reflect `vx`/`vy` when crossing play-area bounds (`0..G.W`, `0..G.PLAY_BOTTOM`); pierces enemies (damages each once via a hit-set like `Projectile._hitSet` at `Projectile.js:101-104`); dies on `bouncesLeft===0` or `lifetime` expiry.
- Bone mode: add downward "gravity" to `vy` and bounce off the ground line, decrementing `bouncesLeft` each ground contact; damages enemies on contact.
- Push to `state.projectiles` (it already accepts any object with `update`/`draw`/`dead` — see filter at `GameScene.js:337`). Give it `r`, `speed`, `maxRange` so the shadow pass (`GameScene.js:839-844`) treats it as a projectile.

### 5.3 Whip box (`whip` — Shower Hose, Extension Cord)
- No projectile. On fire: build the hitbox, test all enemies for overlap, apply damage + light knockback, pass through (hit every enemy in the box).
- **Shower Hose — horizontal:** two **rectangular** hitboxes extending left & right of the hero (VS-faithful Whip). Params: `whip: { shape: 'box', length, halfHeight, sides: 2 }`.
- **Extension Cord — 270° sweep:** a wide arc hitbox covering 270° around the hero (everything except a 90° wedge), longer `length`. Implement as a radius + arc test (reuse the cone-test math from `_attackCleave` at `Unit.js:958-963`, but with a 270° half-arc and longer range). Params: `whip: { shape: 'arc', radius, arcDeg: 270 }`.
  - Note: "270°" is read as **arc coverage** (a near-surround sweep). If the intent was a fixed upward orientation instead, flip `shape:'box'` and orient at −90°.
- Visual: a short-lived slash streak in `state.particles` or a dedicated quick-fading effect (reuse the cleave streak style at `Unit.js:1782-1799`); the arc variant draws a 270° crescent.

### 5.4 Orbiters (`orbit` — Chain with Padlock) — **new `state.orbiters` or per-unit `this.orbiters`**
- On fire (every `atkRate` while equipped, VS King Bible re-summons in waves): spawn `count` orbiter nodes that rotate around the hero at `radius`, `angularSpeed`, for `duration`.
- Each orbiter checks enemy overlap every `tickInterval` with a per-enemy cooldown (so a lingering enemy is hit periodically, not every frame).
- Update in `Unit.update()` (position follows the **live** hero, like mill/vortex at `Unit.js:317-376`) or in a global `state.orbiters` list keyed to owner. **Recommendation:** per-unit `this.orbiters = []` updated inside `Unit.update()` so they track the moving hero and are cleaned up on death.
- Draw the chain/padlock sprite at each node (reuse `drawWeaponSprite`).

### 5.5 Hero aura (`aura` — Richard's Megaphone) — continuous
- Pattern: copy the flamethrower-cone loop (`Unit.js:547-572`) but as a full-circle radius check, active whenever the slot is equipped. Tick damage `atkDmg * dt / tickInterval` to every enemy within `auraRadius`; small knockback outward (VS Garlic also reduces enemy "pushback" resistance — out of scope, just damage + slow optional).
- Param: `aura: { radius, tickInterval, knockback }`, levelled via flat `auraRadius`/`auraDmg`.
- Visual: pulsing translucent ring (reuse the blockade/alchemy ring draw idiom at `Unit.js:1236-1264`); optional sound "megaphone" hum on a long cooldown to avoid spam.

### 5.6 Charge beam (`chargeBeam` — Courtyard Railgun)
- State on the slot or unit: `chargeT`. While `chargeT < chargeTime`, accumulate; show a charging telegraph (growing glow at the muzzle). On full charge, pick a **random** target direction, fire an instant **piercing beam**: a line segment from hero outward `beamLength`; damage every enemy whose centre is within `beamHalfWidth` of the segment; heavy knockback along the beam.
- Visual: a bright line that fades over ~0.2s (reuse `state.bolts` which already render as line segments — `drawBolts` at `effects.js:5`, decayed at `GameScene.js:287`). Add a thick white core + coloured glow.
- Param: `beam: { chargeTime, length, halfWidth }`.

### 5.7 Directional fire (`directional` — Fence Wire Bow / Knife)
- Fire `count` straight bullets along the hero's current facing (`this.facing`, which tracks movement/last-aim). VS Knife fires in the direction the character is moving/last moved.
- Reuse `ShotgunBullet` but **do not** require/aim at a target; spawn along `this.facing` with small spread. Fast `atkRate`, low per-hit damage, can pierce 1.
- This is a `TARGETLESS` behaviour (fires even with no enemy in range).

### 5.8 Multi-slash (`multiSlash` — Car Antenna / Victory Sword)
- On fire: pick the `n` nearest enemies (`_findNearestN`), spawn a short-lived **blue slash** effect at each and apply damage immediately (or stagger by ~0.06s for a cascade feel).
- Visual: blue diagonal slash sprite/quad fading over ~0.25s. Add to `state.particles` (with `additive`) or a small dedicated `state.slashes` list. Reuse the cleave spark idiom (`Unit.js:972-975`).
- Param: `slash: { count, stagger }`, scales with Area (slash size) at higher levels.

### 5.9 Arc-down projectile (`arcDown` — Bus Stop Pole / Axe)
- Throw upward: projectile spawns with upward initial `vy` and horizontal drift, gravity pulls it down so it **arcs**; damages every enemy it passes through (piercing) — high damage, high "Area" scaling (size grows with level).
- Reuse the `BouncingProjectile` integrator (gravity) without the bounce, or a dedicated small class. Push to `state.projectiles`.
- Param: `arc: { upSpeed, drift, gravity, pierce: true }`.

---

## 6. Hero loadouts & pools — `src/config/heroes.js`

Current (`heroes.js:13`, `:33`, `:51`) reference the **deprecated** `plastic_chair` (Dick's starting weapon + in Eliott's & Dick's pools) and `radiator_rib` (Dick's pool). These must change.

Final reassignment (decided — see §14). `richards_megaphone` belongs **only to Dick** ("Richard"; lore: `docs/lore/PRAY_the game.md:18`,`:178`). Eliott's 6th slot, which the original proposal gave to the megaphone, is replaced by `bike_spoke_slingshot` to honour the Richard-only constraint while keeping him a 6-weapon, projectile-leaning hero.

```js
eliott: {
  startingWeapon: 'frozen_cutlet',   // Runetracer — unchanged
  weaponPool: ['frozen_cutlet','pickle_jar','bottle_cap_shuriken','fence_wire_bow','bike_spoke_slingshot','car_antenna'],
},                                    // ↑ bike_spoke_slingshot replaces richards_megaphone (Richard-only, decision #2)
dick: {
  startingWeapon: 'car_antenna',     // was plastic_chair (deprecated) → Victory Sword
  weaponPool: ['car_antenna','bus_stop_pole','toilet_lid','chain_with_padlock','contraceptive_catapult','richards_megaphone'],
},
habib: {
  startingWeapon: 'extension_cord',  // long whip — unchanged
  weaponPool: ['extension_cord','shower_hose','bike_spoke_slingshot','bed_spring_arbalest','courtyard_railgun','chain_with_padlock'],
},
```

Hard constraints: **no pool or `startingWeapon` may reference `plastic_chair` or `radiator_rib`**, and **`richards_megaphone` appears in Dick's pool only**. (Pool overlap between heroes is allowed — e.g. `bike_spoke_slingshot` and `chain_with_padlock` are shared.)

---

## 7. Rendering & sprites — `src/render/weaponSprites.js`

- Add a sprite + `WEAPON_RENDER` entry for the new key **`richards_megaphone`** (`WEAPON_RENDER` map at `weaponSprites.js:19`, `WEAPON_SPRITES` at `:41`). A simple placeholder block is acceptable initially (see precedent in `docs/executed/weapons-rework.md` §3).
- Remove `radiator_rib` and `plastic_chair` from `WEAPON_RENDER` (`:23`, `:24`) and `WEAPON_SPRITES`.
- New visual effects to add (all Canvas 2D into `G.ctx`): bounce trail, orbit chain nodes, ground-zone puddle, aura ring, charge glow + beam line, blue slash quad, arc-projectile shadow. Prefer reusing existing idioms (`state.explosions`, `state.shockwaves`, `state.bolts`, `state.particles`) over new draw code where possible.
- `WeaponLevelUpScene` builds card icons from `weapon_<key>` textures (`WeaponLevelUpScene.js:241`) generated by `generateWeaponTextures` (`weaponSprites.js:531`) — adding the megaphone sprite and removing the two deprecated keys keeps the picker working with **no scene code change** (it reads `displayName`/`rarity` from `WEAPON_DEFS` and pools from `HERO_DEFS`).

---

## 8. HUD & UI

- HUD weapon strip tints cells by **type** (melee=amber, ranged=blue) per `current_game_state.md:90` and `render/hud.js`. With `behavior` replacing `type`, update the tint lookup to map behaviours → colours (e.g. melee-ish `whip/orbit/aura/multiSlash` = amber; projectile `bolt/bounce/boomerang/lobExplode/arcDown/directional/chargeBeam/groundZone` = blue), and the abbreviation source. Grep `render/hud.js` for `type` / `melee` / `ranged` and `weaponSlots` to find the cells.
- `Unit.draw` reads `this._displayWDef.type` for the swing arc / weapon-buff ring (`Unit.js:1441`, `:1464`). **Decided (§14 #3):** retain a vestigial coarse `type` (`'melee'|'ranged'`) on each def for render/HUD only, and drive **all behaviour** off `behavior`. HUD/draw reads keep using `type`; nothing reads `type` for combat logic after Phase 0.

---

## 9. Balance & levelling

- Keep the 5-entry `levels[]` per weapon (`WeaponLevelUpScene` reads `slot.level`, max 5 — `Unit.upgradeWeapon` at `Unit.js:1041`). Each behaviour levels its signature stat in addition to `atkDmg`/`atkRate`:
  - bounce → `maxBounces`; orbit → `count`/`duration`; zone → `radius`/`duration`; aura → `auraRadius`; beam → `halfWidth`/dmg; arcDown → projectile size (Area); multiSlash → `count`; whip → `length`.
- `_buildStatDelta` (`WeaponLevelUpScene.js:385`) currently surfaces `atkDmg`/`atkRate`/`knockback`/`bulletCount`/`piercing`. Extend it to print the signature stat deltas so upgrade cards read meaningfully (optional but recommended).
- `upgradeDmgMult` / `upgradeRateMult` / rage multipliers already wrap damage and rate in the existing attack methods (`Unit.js:929`, `_slotAtkRate` at `:1026`); new handlers must apply the same multipliers for consistency with abilities/upgrades.

---

## 10. Deprecation handling (`radiator_rib`, `plastic_chair`)

1. Remove their entries from `WEAPON_DEFS` (`weapons.js:87`, `:110`).
2. Remove from all `HERO_DEFS` pools + Dick's `startingWeapon` (`heroes.js`).
3. Remove from `WEAPON_RENDER` + `WEAPON_SPRITES` (`weaponSprites.js`).
4. Grep the whole tree for both keys to catch any other reference (sprites, docs, tests). Current code references (besides defs) are only `heroes.js` and `weaponSprites.js`.
5. Safety: `Unit` constructor falls back to `'hockey_club'` if `startingWeapon` is missing (`Unit.js:160`) and `resolveWeaponStats` returns `{}` for unknown keys (`weapons.js:404`) — so a stale reference degrades rather than crashes, but should still be removed.

---

## 11. Phased implementation plan

Each phase ends with `npm run build` green and a doc trace (per `CLAUDE.md`). Commit after each phase.

**Phase 0 — Scaffolding & data model**
- Add `behavior` (+ nested param blocks) to every weapon in `WEAPON_DEFS`; keep vestigial `type` for visuals.
- Add `_acquireTarget` / `_findRandomTarget` / `_findNearestN` and the behaviour-aware auto-attack loop + `_fireWeapon` dispatcher. Route existing behaviours (`bolt`, `boomerang`) through it with **no behaviour change** (regression-safe baseline).
- Build green; game plays identically.

**Phase 1 — Projectile behaviours (reuse-heavy)**
- `bolt` targeting split (nearest/random) → Arbalest vs Slingshot.
- `boomerang` → Bottle Cap Shuriken (Projectile `returns:true`, nearest).
- `lobExplode` → Catapult (Projectile + explosion visual).
- `directional` → Fence Wire Bow (targetless straight fire).

**Phase 2 — New projectile primitives**
- `BouncingProjectile` → Frozen Cutlet (ricochet) + Toilet Lid (ground bounce).
- `arcDown` → Bus Stop Pole.
- `chargeBeam` → Courtyard Railgun (charge state + beam render via `state.bolts`).

**Phase 3 — Melee/zone/persistent behaviours**
- `whip` → Shower Hose + Extension Cord (box hitboxes).
- `orbit` → Chain with Padlock (per-unit orbiters).
- `groundZone` → Pickle Jar (persistent `state.zones`).
- `aura` → **new** Richard's Megaphone (continuous ring) + new sprite.
- `multiSlash` → Car Antenna (blue slash burst).

**Phase 4 — Loadouts, deprecation, UI, polish**
- Reassign `startingWeapon`/`weaponPool`; remove `plastic_chair` + `radiator_rib` everywhere.
- HUD/Unit visual reads migrated to behaviour; `_buildStatDelta` extended.
- Sprite/effect polish pass.

**Phase 5 — Docs pass (phase-complete ritual)**
- Update `docs/current/current_game_state.md` (Weapon Slots, Base Weapons, pools), `docs/current/implementation_notes.md` (new entities/behaviour registry), `docs/index.md` (move this doc to `executed/` and add a one-liner), `docs/current/smoke_checklist.md` (per-behaviour visual checks).

---

## 12. New `state.*` arrays to register

Add to `state` (`src/state.js:4`) and wire update+draw+new-game reset (the new-game init lists arrays at `GameScene.js:104`):

- `state.zones` — persistent ground damage zones (`groundZone`).
- `state.slashes` — short-lived blue slashes (`multiSlash`) — or fold into `state.particles`.
- Orbiters live on `this.orbiters` per unit (no global array).
- Reuse existing `state.projectiles` (bounce/arc/lob), `state.explosions`, `state.shockwaves`, `state.bolts` (beam), `state.particles`.

---

## 13. Validation

- **Build gate:** `npm run build` must stay green after every phase (user validates gameplay manually — do not auto-launch the app).
- **Per-behaviour manual smoke (for the user):** each weapon visibly does its VS thing — cutlet ricochets, arbalest hits random targets, railgun charges then beams, pickle jar leaves puddles, chain orbits, megaphone pulses an aura, car antenna multi-slashes, bus pole arcs down, whips lash sideways and pass through, knife sprays forward, catapult explodes, shuriken returns, bone bounces.
- Confirm the level-up picker still offers/upgrades all 15 weapons and never offers the 2 deprecated keys; confirm Dick spawns with his new starting weapon.

---

## 14. Resolved decisions

1. **Pool composition** — use the §6 reassignment as the final loadout (with the megaphone adjustment from #2).
2. **Richard's Megaphone owner** — **Dick only** (Dick = Richard per lore). Removed from Eliott's proposed pool; Eliott's freed slot → `bike_spoke_slingshot`. Not in Habib's pool.
3. **Keep vestigial `type`** — yes. Retain `type` for render/HUD only; behaviour logic reads `behavior` exclusively (§8).
4. **Whip orientation** — Shower Hose = **horizontal** twin boxes (VS-faithful); Extension Cord = **270° sweep** arc, longer range (§5.3). "270°" interpreted as arc coverage; flag noted in §5.3 if a fixed orientation was meant instead.
5. **Doc location** — keep this file at `docs/weapor_rework_3.md` during development; **move to `docs/executed/` and re-index** on completion (Phase 5).

### Still bolt-consolidation note (no decision needed)
Fire Wand / Magic Wand are implemented as one `bolt` behaviour split by a `targeting: 'random' | 'nearest'` param (§3, §4.3) — folded in, not a separate behaviour.
```
