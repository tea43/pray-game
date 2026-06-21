# Weapon Rework 8 — Whip Patterns (Extension Cord & Shower Hose)

**Status:** Executed
**Follows:** `docs/executed/weapon_rework_7.md` (commits `8de3ea9`…`ef9d276`, "weapon rework 1.1")
**Goal:** Make the two whip weapons read as actual whips with distinctive, recognisable
crack patterns that match the reference art, and fix the two behaviours that make the
current lash look wrong.

Reference art (expected silhouette of the lash):
- `docs/Extension_Cord_pattern.png` — a sharp **zigzag / lightning-bolt** line (electrical cord).
- `docs/Shower_Hose_pattern.png` — a smooth **S-curve / serpentine coil** (flexible hose).

Current broken state:
- `docs/Recording 2026-06-21 121628.mp4` — the lash appears as a short, near-straight blip
  that often points away from enemies and (for Shower Hose) fires both forward and backward.

---

## What the current code does

| Concern | Location |
|---|---|
| Whip config | `src/config/weapons.js` — `extension_cord` (line ~144), `shower_hose` (line ~94) |
| Whip attack + hit + slash spawn | `Unit._attackWhip()` — `src/entities/Unit.js:1203` |
| Whip overlay render | `drawSlashes()` `type === 'whip'` branch — `src/render/effects.js:365` |
| Targetless gate (no aim) | auto-attack loop — `src/entities/Unit.js:805` |
| Facing source for whips | movement dir — `src/entities/Unit.js:746` |

Both weapons share one code path: `behavior: 'whip'` → `_attackWhip()` (shape `lash`) →
`state.slashes.push({ type:'whip', ... })` → the `type === 'whip'` render branch. One set of
changes covers both; the per-weapon *shape* comes from new config fields.

### Three root causes of the "strange whip pattern"

1. **No distinctive shape.** The render branch draws a quadratic Bézier with a tiny
   `bowDist = 8 * sin(progress·π)` perpendicular bow (`effects.js:380`). That is an almost
   straight line — neither a zigzag nor an S-curve. Nothing in config or render encodes the
   reference silhouettes.

2. **The lash is not aimed at enemies.** Whips are targetless (`isTargetless` includes
   `'whip'`, `Unit.js:805`), so the loop calls `this.attack(null, stats)` (`Unit.js:831`).
   In `attack()` the facing update is gated on a non-null enemy (`Unit.js:1015`), so it is
   skipped. `this.facing` therefore holds the **last movement direction** (`Unit.js:746`) — the
   whip cracks wherever the hero last walked, not toward the enemies it is supposed to hit.

3. **Shower Hose double-lashes front + back.** `whip.sides: 2` (`weapons.js:105`) makes
   `_attackWhip` emit a lash at `facing` *and* `facing + π` (`Unit.js:1222`). The reference shows
   a single curl; the mirrored back-lash is part of what looks wrong.

---

## Fix overview

1. **Aim the lash at the nearest enemy** before lashing (whip is targetless).
2. **Add configurable pattern fields** to the `whip` config (`pattern`, `amplitude`, `waves`,
   optional `color`) and carry them onto the slash record.
3. **Rewrite the `type === 'whip'` render** to draw a patterned, animated crack: a triangle-wave
   zigzag for the Extension Cord, a sine S-curve for the Shower Hose, both unfurling from hand to
   tip over the lash's short life.
4. **Set Shower Hose to a single forward lash** to match the reference (decision point below).

The hit-box in `_attackWhip` (`localX`/`localY` box test, `Unit.js:1233`) is unchanged — only
aim and visuals change. `halfHeight` stays the collision half-height; the visual amplitude is a
separate field, so the cord can swing wider than the hit-box without inflating it.

---

## Step 1 — Aim the lash at the nearest enemy

`src/entities/Unit.js`, top of `_attackWhip()` (after `const dmg = …`, before the `if (p.shape ===
'lash')` block, ~line 1207). The targetless gate already guarantees an enemy is nearby; reuse the
same nearest-enemy scan the acid gun / flamethrower use (`Unit.js:552`, `711`):

```js
// Whip is targetless (Unit.js:805) so this.facing is the hero's last movement
// direction. Re-aim at the nearest living enemy so the crack points at what it hits.
let _nearest = null, _nd = Infinity;
for (const e of state.enemies) {
  if (e.dead) continue;
  const d = dist2(this.x, this.y, e.x, e.y);
  if (d < _nd) { _nd = d; _nearest = e; }
}
if (_nearest) this.facing = Math.atan2(_nearest.y - this.y, _nearest.x - this.x);
```

`ang = this.facing + k * Math.PI` (`Unit.js:1223`) then points the lash (and, for `sides > 1`,
the opposing lash) correctly. No other call sites depend on `_attackWhip` leaving facing alone.

---

## Step 2 — Pattern config + slash record

### 2a. `src/config/weapons.js`

Add `pattern`, `amplitude`, `waves`, and an optional `color` to each `whip` object. Keep
`length` / `halfHeight` (reach + hit-box). Amplitude is the sideways swing of the *visual* in px.

```js
// extension_cord (line ~155) — electric zigzag, single forward lash
whip: { shape:'lash', length:110, halfHeight:18, sides:1,
        pattern:'zigzag', amplitude:22, waves:3, color:'#bfe0ff' },

// shower_hose (line ~105) — smooth S-curve hose. sides:1 to match the reference
// (see Decision below); raise amplitude since it's the wider, rarer whip.
whip: { shape:'lash', length:100, halfHeight:22, sides:1,
        pattern:'wave', amplitude:28, waves:1, color:'#cfeaff' },
```

> `resolveWeaponStats()` shallow-merges `levels[slot.level-1]` over the base; the `levels[]`
> entries only set `atkDmg`/`atkRate`, so the `whip` object resolves from the base unchanged.

### 2b. `src/entities/Unit.js` — carry the fields onto the slash

In `_attackWhip`, extend the `state.slashes.push({ type:'whip', … })` (`Unit.js:1254`) so the
renderer has everything it needs (back-compatible defaults keep old behaviour if a field is
absent):

```js
state.slashes.push({
  type: 'whip',
  x: this.x, y: this.y,
  ang,
  length,
  halfHeight,
  pattern:   p.pattern   || 'wave',
  amplitude: p.amplitude ?? 0,     // 0 → straight cord (legacy look)
  waves:     p.waves     ?? 1,
  color:     p.color     || '#b4dcff',
  life: lashLife, maxLife: lashLife,
});
```

Leave `lashLife = 0.06 * ANIM_DURATION_MULT` (= 0.6 s) as-is — that lifetime reads well; only
the shape inside it changes. (Slash overlays decay in `realDt` in `GameScene`, per rework 7.)

---

## Step 3 — Rewrite the `type === 'whip'` render

`src/render/effects.js`, replace the body of the `else if (s.type === 'whip')` branch
(`effects.js:365-424`). Draw the cord in the lash's **local frame** (`translate` to the hero,
`rotate` by `s.ang`): x runs along the lash, y is the perpendicular offset given by the pattern.

Key ideas:
- **Pattern offset** `off(t)`: a triangle wave for `'zigzag'`, a sine for `'wave'`, scaled by
  `amplitude` and an **envelope** that is 0 at the hand (so the cord leaves the hand straight,
  matching the short tails in both reference images) and tapers slightly at the tip.
- **Crack animation**: the cord *unfurls* — `reach` grows from ~0 to full over the first half of
  the life, and the pattern's phase travels outward (`t·waves − progress`) so the wave runs down
  the cord like a real whip snap.
- **Taper + highlight**: per-segment `lineWidth` from ~4 px at the hand to ~1.2 px at the tip,
  with a thin white inner highlight, then an additive tip flash.

```js
} else if (s.type === 'whip') {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.ang);

  const progress  = 1 - alpha;                 // 0 → 1 over the lash's life
  const amp       = s.amplitude ?? 0;
  const waves     = s.waves ?? 1;
  const pattern   = s.pattern || 'wave';
  const cord      = s.color || '#b4dcff';
  const reach     = s.length * (0.35 + 0.65 * Math.min(1, progress / 0.5)); // unfurl
  const steps     = 18;

  // triangle wave in [-1,1] for the electric zigzag
  const tri = (p) => 2 * Math.abs(2 * (p - Math.floor(p + 0.5))) - 1;

  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t   = i / steps;
    const env = Math.min(1, t / 0.18) * (1 - 0.25 * t);   // 0 at hand, taper at tip
    const ph  = t * waves - progress;                     // phase travels outward
    const off = amp * env * (pattern === 'zigzag'
                  ? tri(ph)
                  : Math.sin(ph * Math.PI * 2));
    pts.push({ x: t * reach, y: off });
  }

  // cord body (tapered) + inner highlight, segment by segment
  ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    const t = i / steps;
    ctx.strokeStyle = cord;
    ctx.globalAlpha = alpha * 0.85;
    ctx.lineWidth   = 4 * (1 - t * 0.7);
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x,     pts[i].y);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = alpha;
    ctx.lineWidth   = 1.5 * (1 - t * 0.8);
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x,     pts[i].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // additive tip flash at the snapping end
  const tip = pts[pts.length - 1];
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 5);
  g.addColorStop(0,   `rgba(255,255,255,${alpha})`);
  g.addColorStop(0.4, `rgba(190,224,255,${alpha * 0.8})`);
  g.addColorStop(1,   'rgba(190,224,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
```

Notes:
- Working in the rotated local frame removes the per-point `cos/sin` of the old code and makes
  the math match the reference (offset purely perpendicular).
- `amp === 0` falls back to a straight tapered cord, so any future whip without pattern fields
  still renders sanely.
- Tune `waves` to taste: zigzag reads well at `3`; the hose S reads at `1` (one full sine =
  one S). Bump `amplitude` for a wider swing without touching the hit-box.

---

## Step 4 — Decision: Shower Hose `sides`

The reference shows **one** curl, but the current `sides: 2` gives Shower Hose a front + back
double-hit that distinguishes it from the Common Extension Cord.

- **Recommended (matches art):** set `shower_hose.whip.sides: 1`. Compensate for the lost
  second hit, if desired, via its existing higher `atkDmg`/wider `halfHeight`.
- **Alternative (keep dual hit):** leave `sides: 2`; the back-lash will mirror the front curl.
  With Step 1's aim fix it at least cracks toward and directly away from the nearest enemy
  instead of along the walk direction, which already looks far less random.

Default this plan to `sides: 1` for visual fidelity; flip back to `2` only if playtesting wants
the extra hit.

---

## Files touched

- `src/config/weapons.js` — `whip` pattern fields on `extension_cord` & `shower_hose`; Shower
  Hose `sides`.
- `src/entities/Unit.js` — nearest-enemy aim in `_attackWhip`; extra fields on the slash push.
- `src/render/effects.js` — rewritten `type === 'whip'` branch.

No changes to the hit-box test, projectile cap, SFX, or any other weapon.

---

## Verification

Per project convention the author playtests; agent verification is build-only:

```
npm run build
```

Must compile clean. Then the author confirms in-game:
1. Extension Cord cracks as a sharp electric **zigzag** pointing at the nearest enemy.
2. Shower Hose cracks as a smooth **S-curve** pointing at the nearest enemy (single lash).
3. Both unfurl hand→tip and fade fast; no straight blip, no walk-direction misfire, no
   stray back-lash (unless `sides:2` is intentionally kept).
4. Hit feel unchanged (same reach/damage; only aim + visuals changed).

---

## Documentation trace (do on the implementing commit)

- Update `docs/current/current_game_state.md` — note the whip pattern fields and aim-at-nearest
  behaviour for Extension Cord / Shower Hose.
- Update `docs/current/implementation_notes.md` if it documents the `whip` slash render — the
  branch now reads `pattern`/`amplitude`/`waves`/`color` and draws in the lash's local frame.
- On completion, move this file to `docs/executed/` and tick the checklist, per CLAUDE.md phase
  rules; add the index entry there.

## Task checklist

- [x] `_attackWhip` re-aims at nearest enemy.
- [x] `whip` pattern fields added to both weapon defs; Shower Hose `sides` decided.
- [x] Slash push carries `pattern`/`amplitude`/`waves`/`color`.
- [x] `type === 'whip'` render rewritten (local-frame patterned crack + tip flash).
- [x] `npm run build` clean; docs updated.
