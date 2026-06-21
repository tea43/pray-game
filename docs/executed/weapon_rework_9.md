# Weapon Rework 9 — Unique Ranged Projectiles & Distinct Whip Colors

**Status:** Implemented
**Follows:** `docs/executed/weapon_rework_8.md` (whip pattern rework)
**Goal:**
1. Give every ranged weapon its **own** projectile sprite — the Bed-Spring Arbalest in
   particular must fire an **arrow-like** bolt.
2. Make the two whips visually distinct: **Extension Cord = yellow**, **Shower Hose = white**
   (currently both render near-identical light blue).

---

## Part A — Unique ranged projectile sprites

### Root cause

All three "shoot a bullet" ranged weapons route through `_attackRanged` → `ShotgunBullet`
(`src/entities/Unit.js` `attack()` `type === 'ranged'` branch). `ShotgunBullet.draw()`
(`src/entities/ShotgunBullet.js:64`) draws a **generic orange tracer + glow + white dot** with
no per-weapon art, so they are indistinguishable:

| Weapon | type / behavior | Projectile path | Current projectile look |
|---|---|---|---|
| `bed_spring_arbalest` | ranged / `bolt` | `ShotgunBullet` | generic orange tracer |
| `bike_spoke_slingshot` | ranged / `bolt` | `ShotgunBullet` | generic orange tracer |
| `fence_wire_bow` | ranged / `directional` | `ShotgunBullet` | generic orange tracer |
| `contraceptive_catapult` | ranged / `lobExplode` | `Projectile` | ✅ `catapult_pouch` (unique) |
| `courtyard_railgun` | ranged / `chargeBeam` | beam (no projectile) | — |

> By contrast, the **thrown** weapons (`frozen_cutlet`, `pickle_jar`, `bottle_cap_shuriken`) use
> `Projectile`, whose `draw()` already resolves `this.wDef?.projectileSprite || this.key` and draws
> the weapon's own sprite (`src/entities/Projectile.js:309`). They are already unique — no change.

So the work is: (1) author three distinct projectile sprites, (2) wire them onto the three
weapons via the existing `projectileSprite` field, and (3) teach `ShotgunBullet` to draw a sprite
the way `Projectile` does (travel-aligned), falling back to the current tracer when none is set.

### A1. New sprites — `src/render/weaponSprites.js`

Add three 24×24 grids (all point **+x / right**, so they can be rotated to the travel angle).
Palette already defines everything used: `1`=#0a0a0a outline, `3`=#9a6530 wood, `4`=#cfd6dc
light steel, `5`=#8a95a5 steel, `6`=#8a1a1a red, `9`=#ffffff white.

```js
  // Bed-Spring Arbalest — wooden bolt: red fletching, wood shaft, steel head (arrow-like)
  spring_bolt: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "   6           14       ",
    "   66          1444     ",
    "   666333333333149444   ",
    "   666333333333149444   ",
    "   66          1444     ",
    "   6           14       ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  // Bike-Spoke Slingshot — steel ball bearing (round, white highlight)
  spoke_ball: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "         115511         ",
    "        15555551        ",
    "        15955551        ",
    "        55555555        ",
    "        55555555        ",
    "        15555551        ",
    "        15555551        ",
    "         115511         ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
  // Fence-Wire Bow — skeletal grey ">" wire arrow with rust specks
  wire_arrow: [
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "             55         ",
    "               55       ",
    "                 55     ",
    "    555655555555   54   ",
    "    555555655555   54   ",
    "                 55     ",
    "               55       ",
    "             55         ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
    "                        ",
  ],
```

Add matching `WEAPON_RENDER` entries (start at 1.0; drop to ~0.8 if they read too large at
speed):

```js
  spring_bolt: { scale: 1.0 },
  spoke_ball:  { scale: 0.9 },
  wire_arrow:  { scale: 1.0 },
```

### A2. Wire sprites to weapons — `src/config/weapons.js`

Add `projectileSprite` to each of the three (mirrors how `contraceptive_catapult` already does it):

```js
bed_spring_arbalest:  projectileSprite: 'spring_bolt',
bike_spoke_slingshot: projectileSprite: 'spoke_ball',
fence_wire_bow:       projectileSprite: 'wire_arrow',
```

### A3. Draw the sprite in `ShotgunBullet` — `src/entities/ShotgunBullet.js`

`ShotgunBullet` only stores `this.key` today. Store the chosen sprite key in the constructor and
draw it travel-aligned, keeping the additive tracer behind it for the "fast shot" read. Fall back
to the existing generic bullet when a weapon has no `projectileSprite` (no behaviour change for
anything that doesn't opt in).

1. **Imports** (top of file) — same set `Projectile` uses:
   ```js
   import { drawWeaponSprite, WEAPON_SPRITES, WEAPON_RENDER_SCALE, getWeaponRender } from '../render/weaponSprites.js';
   ```
2. **Constructor** — after `this.key = wDef.key;`:
   ```js
   this.projectileSprite = wDef.projectileSprite || null;
   ```
3. **`draw(ctx)`** — keep the additive tracer streak (lines 67-78), then branch:
   ```js
   const spriteKey = this.projectileSprite;
   if (spriteKey && WEAPON_SPRITES[spriteKey]) {
     const scale = getWeaponRender(spriteKey).scale * WEAPON_RENDER_SCALE;
     const ang = Math.atan2(this.vy, this.vx);     // sprites point +x → align to travel
     drawWeaponSprite(ctx, spriteKey, this.x, this.y, scale, ang);
   } else {
     // ...existing radial-gradient glow + white core dot (current lines 79-90)...
   }
   ```
   Leave the muzzle pop, impact particles, and damage logic untouched.

### A4. Result

Five visually distinct ranged projectiles: **arrow** (Arbalest), **steel ball** (Slingshot),
**wire arrow** (Fence Bow), **latex pouch** (Catapult, unchanged), **beam** (Railgun, unchanged).

---

## Part B — Distinct whip colors

### Root cause

The whip render reads `s.color` for the cord body (`src/render/effects.js:374,396`), but both
whips are configured almost the same light blue (`src/config/weapons.js`):
`extension_cord.whip.color = '#bfe0ff'`, `shower_hose.whip.color = '#cfeaff'`. They look identical
in play. Additionally, the tip flash is **hardcoded blue** (`rgba(190,224,255,…)`,
`effects.js:419-420`), so even after recoloring the body, a yellow Extension Cord would still
flash blue at the tip.

### B1. Config — `src/config/weapons.js`

```js
extension_cord.whip.color: '#ffe04a'   // yellow (was '#bfe0ff')
shower_hose.whip.color:    '#ffffff'   // white  (was '#cfeaff')
```

### B2. Harmonize the tip flash with the cord color — `src/render/effects.js`

In the `type === 'whip'` branch, derive the additive tip-flash gradient from `s.color` instead of
the hardcoded blue, so the glow matches the cord. The inner highlight stays white (a bright core
reads well on both yellow and white).

1. Add a small helper near the top of the file (module scope):
   ```js
   function hexToRgb(hex) {
     const h = hex.replace('#', '');
     const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
     return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
   }
   ```
2. Replace the tip-flash gradient stops (`effects.js:417-420`):
   ```js
   const [fr, fg, fb] = hexToRgb(cord);
   const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 5);
   g.addColorStop(0,   `rgba(255,255,255,${alpha})`);
   g.addColorStop(0.4, `rgba(${fr},${fg},${fb},${alpha * 0.8})`);
   g.addColorStop(1,   `rgba(${fr},${fg},${fb},0)`);
   ```

Now the Extension Cord cracks yellow (white core, yellow tip glow) and the Shower Hose cracks
clean white.

---

## Files touched

- `src/render/weaponSprites.js` — 3 new sprite grids + 3 `WEAPON_RENDER` entries.
- `src/config/weapons.js` — `projectileSprite` on the 3 ranged weapons; whip `color` on both whips.
- `src/entities/ShotgunBullet.js` — store `projectileSprite`; sprite-based `draw()` with tracer fallback.
- `src/render/effects.js` — `hexToRgb` helper + color-matched whip tip flash.

No change to damage, hit detection, projectile cap, SFX, or any weapon's stats.

---

## Verification

Build-only per project convention (author playtests):

```
npm run build
```

Then the author confirms in-game:
1. Bed-Spring Arbalest fires a visible **arrow/bolt** (fletching + steel head), aligned to flight.
2. Bike-Spoke Slingshot fires a **round steel ball**; Fence Bow fires a thin **wire arrow** —
   all three clearly different from each other and from the Catapult pouch.
3. Extension Cord cracks **yellow**, Shower Hose cracks **white**.
4. No regression on thrown weapons, catapult, or railgun beam.

---

## Documentation trace (do on the implementing commit)

- Update `docs/current/current_game_state.md` — note per-weapon ranged projectile sprites and the
  yellow/white whip colors.
- Update `docs/current/implementation_notes.md` if it documents `ShotgunBullet` rendering or the
  `projectileSprite` resolution (now used by `ShotgunBullet` too, not just `Projectile`).
- Update `docs/current/sprites.md` if it lists weapon/projectile sprites (add `spring_bolt`,
  `spoke_ball`, `wire_arrow`).
- On completion, move this file to `docs/executed/` and tick the checklist, per CLAUDE.md.

## Task checklist

- [x] `spring_bolt`, `spoke_ball`, `wire_arrow` sprites + `WEAPON_RENDER` entries added.
- [x] `projectileSprite` set on Arbalest, Slingshot, Fence Bow.
- [x] `ShotgunBullet` stores `projectileSprite` and draws it travel-aligned (tracer fallback kept).
- [x] Whip `color` set to yellow / white; tip flash derives from `s.color`.
- [x] `npm run build` clean; docs updated.
