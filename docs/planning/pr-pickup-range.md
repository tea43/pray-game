# PR: Hero Essence Pickup Range

Give each survivor a circular **pickup range** around them. Once an essence orb enters that circle it locks onto the hero, **flies toward them** (Vampire-Survivors-style magnet), and pops on body contact — the hero never needs to step onto it. The current "hero body must touch the loot" rule still applies to medkits, stimpacks, bombs, and weapon drops; only essence uses the new range + magnet pickup.

The feature is intentionally small: per-hero radius field, magnet-homing block in the existing loot loop, optional ground-ring visual.

> **Amendment (post-implementation):** the original plan shipped without magnetism — essence vanished the instant it crossed the pickup ring. Playtest feedback was that the "instant gulp" felt unsatisfying compared with Vampire Survivors. This doc has been updated to describe the magnet-pickup behaviour that now ships; the §2 non-goal has moved to §5 as a behaviour spec.

---

## 1. Goals (what "done" looks like)

- Each living hero has a pickup radius `pickupR` (default `60 px`) read from `HERO_DEFS`.
- The instant any non-picked essence enters a living hero's `pickupR`, the orb **locks onto that hero** and flies toward them, accelerating each frame.
- The orb continues homing even if the hero walks out of the original radius — the radius is a *capture trigger*, not a leash. The orb is consumed on body contact (`u.r + l.r + 2`), pops a small green particle burst, and grants XP through the existing `applyLoot` path.
- If the locked hero dies mid-flight, the orb re-acquires the nearest living hero (no radius gate) and continues. If all heroes are dead, the orb stops and waits.
- Non-essence loot pickup is unchanged — medkits/weapons/bombs still require body contact (`u.r + l.r + 2`).
- A very subtle ground ring is drawn under each hero so the radius is legible. Off by default in `state.settings` (`showPickupRing: false`); a single toggle adds it back. Heroes ringed only while alive.
- Ring rendering uses the existing Canvas 2D bridge (`G.ctx`) — no new Phaser GameObjects. (Phaser 3 hosts the scene; the bridge is the established draw path per `docs/index.md`.)
- New-game reset and hero death/respawn semantics: `pickupR` is hero-intrinsic, not stateful, so nothing to reset. `homingTarget` lives on the orb instance and dies with it; new orbs always start un-captured.

---

## 2. Non-goals (explicitly excluded)

- **No pickup-range upgrade in the slot machine.** Plan stays single-PR scope. Hooking it into `eliott_upgrades.json` etc. is a follow-up after this lands.
- **No per-loot-type configurability.** Medkits/weapons/bombs intentionally still need body contact (gives heat-of-the-moment positioning meaning).
- **No magnet pickup for non-essence loot.** Medkits/weapons/bombs are positional plays — you must step on them.
- **No re-targeting once captured (while target is alive).** The orb locks its homing target on the frame it crosses any hero's pickup ring; switching targets only happens when the locked hero dies. Live re-targeting added churn for no obvious gameplay win.
- **No camera-screen-edge auto-collect or off-screen pickup.** Range is finite and small.
- **No balance changes** to essence drop counts, XP value, or `xpToNext`.

---

## 3. Files touched

| File | Change |
|---|---|
| `src/config/heroes.js` | Add `pickupR: 60` to each hero def (or a shared `DEFAULT_PICKUP_R` constant if all three share the value — see §4). |
| `src/entities/Unit.js` | In the constructor, read `def.pickupR ?? DEFAULT_PICKUP_R` and store on the unit. |
| `src/entities/Loot.js` | Add `this.homingTarget = null` and `this.homingSpeed = 0` to the constructor so the magnet bookkeeping is discoverable on the entity. (Essence-only in practice; harmless on other loot.) |
| `src/phaser/scenes/GameScene.js` | Replace the existing single-line pickup distance check with a two-branch block: essence does target-acquisition + accelerated homing + arrival pop; everything else keeps `u.r + l.r + 2`. Also call `drawPickupRings()` from the per-frame render pass when the toggle is on. |
| `src/render/effects.js` | New `drawPickupRings(ctx)` helper that draws a faint ring at each living hero's `(x, y, pickupR)`. Uses the existing world-camera transform. |
| `src/state.js` | Add `settings.showPickupRing: false`. |
| `src/phaser/scenes/PauseScene.js` *(or wherever settings toggles live)* | Add a "Pickup ring" toggle next to the existing `noShake` / camera options. (If no UI lives there yet, just expose the setting via dev console — call it out as deferred UI in §10.) |
| `docs/current/current_game_state.md` | Add a short note under the Loot / Essence section describing the 60 px capture radius and magnet pickup. |
| `docs/index.md` | Add this file under `planning/`; move to `executed/` on phase completion. |

---

## 4. Data shapes

### `HERO_DEFS` additions (`src/config/heroes.js`)

```js
const DEFAULT_PICKUP_R = 60;

export const HERO_DEFS = {
  eliott: { /* …, */ pickupR: DEFAULT_PICKUP_R },
  dick:   { /* …, */ pickupR: DEFAULT_PICKUP_R },
  habib:  { /* …, */ pickupR: DEFAULT_PICKUP_R },
};
```

All three start at the same value. Per-hero tuning is trivial once the field exists — open question §10 covers it. Export `DEFAULT_PICKUP_R` so `Unit.js` can use it as a fallback when a future hero def is missing the field.

### `Unit` field

```js
this.pickupR = def.pickupR ?? DEFAULT_PICKUP_R;
```

Already-known unit fields like `r` and `speed` are populated the same way in the constructor — fits the established pattern.

### `Loot` instance fields (essence in practice)

```js
this.homingTarget = null;   // Unit reference once the orb crosses any hero's pickupR
this.homingSpeed = 0;       // px/s; ramped up each frame by ESSENCE_HOMING_ACCEL
```

Living on the entity means: the magnet bookkeeping is GC'd with the orb, and there's no parallel side-table to keep in sync across resets / new games. `Loot.update(dt)` does not touch these fields — the GameScene loot loop drives all magnet behaviour so the entity stays unaware of `state.units`.

### `state.settings`

```js
settings: {
  // existing…
  showPickupRing: false,
}
```

---

## 5. Behaviour details

### Pickup loop (`GameScene._updateWorld`, ~line 285)

Today the entire pickup logic is a single radius check. After this PR the loop splits into a magnet-aware essence branch and an unchanged body-contact branch for everything else:

```js
const ESSENCE_HOMING_BASE  = 180;   // px/s, speed at moment of capture
const ESSENCE_HOMING_ACCEL = 1200;  // px/s², acceleration once captured
const ESSENCE_HOMING_MAX   = 700;   // px/s, terminal speed

for (const l of state.loot) {
  if (l.picked) continue;

  if (l.type === 'essence') {
    // 1. Target acquisition (lazy — first frame the orb crosses any pickupR)
    if (!l.homingTarget) {
      let bestU = null, bestD = Infinity;
      for (const u of state.units) {
        if (u.dead) continue;
        const d = dist2(u.x, u.y, l.x, l.y);
        if (d < u.pickupR && d < bestD) { bestU = u; bestD = d; }
      }
      if (bestU) { l.homingTarget = bestU; l.homingSpeed = ESSENCE_HOMING_BASE; }
    } else if (l.homingTarget.dead) {
      // Re-acquire nearest living hero (no radius gate — already in flight)
      let bestU = null, bestD = Infinity;
      for (const u of state.units) {
        if (u.dead) continue;
        const d = dist2(u.x, u.y, l.x, l.y);
        if (d < bestD) { bestU = u; bestD = d; }
      }
      l.homingTarget = bestU;  // may be null → orb idles
    }

    // 2. Homing motion + arrival
    if (l.homingTarget && !l.homingTarget.dead) {
      const u = l.homingTarget;
      const dx = u.x - l.x, dy = u.y - l.y;
      const d = Math.hypot(dx, dy);
      l.homingSpeed = Math.min(ESSENCE_HOMING_MAX,
        (l.homingSpeed || ESSENCE_HOMING_BASE) + ESSENCE_HOMING_ACCEL * gameDt);
      const step = l.homingSpeed * gameDt;
      const arriveLimit = u.r + l.r + 2;
      if (d <= step + arriveLimit) {
        // Pop burst — replaces "orb just vanishes" with an arrival animation
        for (let i = 0; i < 8; i++) { /* additive green particle */ }
        l.picked = true; applyLoot(l, u);
      } else if (d > 0.001) {
        l.x += (dx / d) * step;
        l.y += (dy / d) * step;
      }
    }
  } else {
    for (const u of state.units) {
      if (u.dead) continue;
      if (dist2(u.x, u.y, l.x, l.y) < u.r + l.r + 2) {
        l.picked = true; applyLoot(l, u); break;
      }
    }
  }
}
state.loot = state.loot.filter(l => !l.picked);
```

Notes:
- `dist2` returns Euclidean distance in this repo (`Math.hypot` under the hood), so `d < u.pickupR` and `d < bestD` work directly. If math.js ever switches to squared distance, every comparison must square its threshold.
- **Magnet runs on `gameDt`, not `realDt`.** When time is frozen / slowed (space-bar slow-mo) the magnet slows with it — feels natural and avoids the bug where orbs would shoot past frozen heroes.
- Arrival uses `d <= step + arriveLimit` (not `d < arriveLimit`) so high-speed orbs cannot overshoot in a single frame at the terminal speed of 700 px/s + 60-fps step of ~12 px.
- **Locked-target semantics:** acquisition uses *closest hero within pickupR*, then locks. The orb does not re-target a closer hero mid-flight (only on target death). Adding live re-targeting is one `for` loop away if playtest reveals weirdness, but on a 60 px radius across 3 heroes the cost-of-being-wrong is one short detour, not a misfire.
- The bounce z-offset is left untouched — essence collected mid-bounce is still a feature, not a bug.
- Per-essence cost is one `Math.hypot` + a few multiplies. With 25 orbs from a bigboss the loop is ~125 ops/frame — well under the budget the existing entity Y-sort already eats.

### Ring rendering (`drawPickupRings`)

Drawn after the ground/terrain but before units, so unit sprites sit on top of the ring. Cheap; one stroked circle per hero.

```js
export function drawPickupRings(ctx) {
  if (!state.settings.showPickupRing) return;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120, 220, 140, 0.18)';
  ctx.fillStyle   = 'rgba(120, 220, 140, 0.05)';
  for (const u of state.units) {
    if (u.dead) continue;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.pickupR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
```

Wire the call into `GameScene` between the background draw and the unit draw. Look for the existing render order in `GameScene.update` (search for `drawBackground` and `drawShockwaves` to locate the slot).

### Per-hero variation (open question §10)

If we tune `pickupR` per hero later (e.g. Eliott 80, Dick 50, Habib 60 — fits the "ranged blink / brawler / support" archetypes), no code change needed beyond adjusting the def values. The plan keeps them equal to ship cleanly.

---

## 6. Asset wiring

No new assets. The ring is a single stroked arc on the existing canvas.

---

## 7. Audio

None. Pickup sfx for essence is already handled by `applyLoot` and isn't changing.

---

## 8. Implementation order (commits)

Each commit leaves the game runnable. Per `CLAUDE.md`, include doc updates in the same or immediately-following commit.

1. **`feat(pickup): add hero pickupR field and essence range collection`**
   - `HERO_DEFS.pickupR` (60 px, all three heroes) + `DEFAULT_PICKUP_R` export.
   - `Unit.pickupR` assignment.
   - `GameScene` loot loop split for `essence` vs. rest (binary collection, no magnet — magnet lands in commit 2 of the amendment).
   - Test in `dev-mode`: stand near (~40 px away from) an essence — confirm it's collected without stepping on it. Confirm medkits still require stepping on.

2. **`feat(render): optional pickup-range ring under heroes`**
   - `state.settings.showPickupRing` (default false).
   - `drawPickupRings` helper + call site in `GameScene.update`.
   - Test: toggle via console (`state.settings.showPickupRing = true`) — confirm rings appear under all living heroes and disappear on death.

3. **`docs(pickup): describe pickup range in current_game_state`**
   - Update `current_game_state.md` Loot section.
   - Move this file → `docs/executed/pr-pickup-range.md` and update `docs/index.md`.

### Amendment commits (magnetism)

4. **`feat(pickup): magnet essence orbs toward captured hero`**
   - `Loot.homingTarget` / `Loot.homingSpeed` fields in the constructor.
   - Replace `GameScene` essence branch with target-acquisition + accelerated homing + arrival pop.
   - Test: walk near a bigboss kill — orbs visibly stream toward each hero; on body contact each orb pops a small green burst, `+1 XP` floats, the XP bar ticks.

5. **`docs(pickup): describe magnet behaviour`**
   - Update this plan (you are reading it) and `current_game_state.md` to match.

(Optional further commit if a settings UI for the ring toggle is wired in this PR; otherwise defer.)

---

## 9. Test plan (manual)

Run `npm run dev`, pick `dev-mode`:

- [ ] Kill a regular enemy. Walk to within ~60 px of the dropped essence. The orb visibly flies toward the hero, pops on contact with a small green burst, `+1` floating marker appears, the HUD XP bar ticks.
- [ ] Trigger several essences at once. Each orb locks onto its nearest in-range hero independently; orbs near hero A fly to A, orbs near hero B fly to B.
- [ ] Drop a medkit. Walk to within `pickupR` but not within `u.r + l.r + 2`. Medkit should **not** be collected and should **not** fly — only essence magnets. Step onto it → collected.
- [ ] Kill a bigboss. All 25 essence orbs stream toward heroes as the squad moves through the cluster; no orphans after ~2 s of player movement.
- [ ] In console: `state.settings.showPickupRing = true`. Confirm faint green rings under each living hero. Kill a hero (or wait for one to die) — that hero's ring disappears.
- [ ] Kill the hero a homing essence is locked onto mid-flight. The orb should re-target the nearest living hero and continue. If all heroes die, the orb stops in place.
- [ ] Hold the slow-mo key. Orbs should slow with world time, not race past frozen heroes.
- [ ] Restart via `R` after game-over: rings respawn under new heroes, `pickupR` is still 60, new essence orbs start un-captured (don't snap to a hero from across the map).
- [ ] Performance: stand near a bigboss-sized essence drop (25 orbs). Frame time stays within the existing budget — per-orb work is one `Math.hypot` plus a handful of multiplies.

Run `node scripts/check-game-data.js` after the `HERO_DEFS` edit to confirm the validator is happy with the new field.

---

## 10. Risk & open questions

- **Picking radius value.** 60 px is a guess (≈ 5× the hero body radius). Validate in playtest:
  - too small → orbs barely magnet at all
  - too large → essence vacuum trivialises movement positioning
  Adjust after one play session before merging.
- **Magnet tuning.** Three constants — `ESSENCE_HOMING_BASE` (180 px/s), `ESSENCE_HOMING_ACCEL` (1200 px/s²), `ESSENCE_HOMING_MAX` (700 px/s) — define the feel. Watch for:
  - Orbs that look *sluggish* on capture (raise BASE)
  - Orbs that *overshoot* or jitter on close contact (lower MAX, or tighten `arriveLimit`)
  - Orbs that take too long to reach a sprinting hero (raise ACCEL)
  These are local constants; promote to `src/config/loot.js` only if a future upgrade needs to tweak them.
- **Per-hero balance.** Should Eliott (the squishy blinker) have a larger pickup radius as compensation? Open for discussion after the base feature ships. Filed under "follow-up tuning."
- **Outer "capture-only" ring.** Some roguelikes use a *much* larger outer ring (e.g. 60 px instant-pop, 220 px slow-magnet) so orbs from across the screen drift toward you. Deferred — easy to add as a second radius later, but ship the core feel first.
- **Pickup-range upgrade.** Once this PR lands, adding a slot-machine upgrade ("Eliott — Resonant Pull: +40 px pickup range") is one new entry in `eliott_upgrades.json` plus a `unit.pickupR += 40` apply hook in `src/systems/upgrades.js`. Out of scope here; mention in the docs follow-up.
- **Settings UI.** The toggle is reachable from the dev console only in this PR. If the pause/settings menu doesn't currently host similar visual toggles, leave UI integration to whoever ships the next options-screen pass. Flag in the PR description so it isn't forgotten.
- **Phaser 3 native option (Phaser.Geom.Circle.ContainsPoint).** Considered and rejected — the existing pickup loop already uses `dist2` from `utils/math.js`, and switching one branch to Phaser geometry helpers for no perf or clarity gain just adds an import. Keep the math consistent with the rest of the codebase.
