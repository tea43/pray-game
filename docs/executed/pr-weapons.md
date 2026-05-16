# PR: Vampire-Survivors-Style Weapons & Level-Up Picker

Each hero gets **3 weapon slots**. Every filled slot fires its own weapon on its own cooldown — heroes can carry up to three different weapons that all auto-attack simultaneously, Vampire-Survivors style. When the player **levels up** (existing essence/XP system, see `docs/executed/pr-level-up.md`), a modal scene presents 3 cards: each card either gives one of the heroes a new weapon (in an empty slot) or upgrades one of their existing weapons by a level. Player picks one card. Game resumes.

The existing **upgrades system** (`src/systems/upgrades.js`, `public/assets/data/upgrades/*.json`, `unit.pushUpgrade(...)`, the slot/durability mechanics, and the `UpgradeScene` card UI patterns) is the model — we extend it with a parallel weapon-progression branch rather than duplicating infrastructure.

Phaser 3 hosts the scene; the picker is a new `WeaponLevelUpScene`, opened on level-up the same way `UpgradeScene` is launched between waves.

---

## 1. Goals (what "done" looks like)

- Each hero owns `weaponSlots: [{ key, level } | null, …]` with **3 slots**. Starting weapon (from `HERO_DEFS.startingWeapon`) occupies slot 0 at level 1 on game start.
- Every frame, each filled weapon slot fires independently on its own cooldown (per-slot `atkCd`). Targeting is the existing nearest-enemy-in-range logic, run per slot, because each weapon has its own `atkRange`.
- Weapons exist at **levels 1–5**. Each level boosts `atkDmg` / `atkRate` / (for ranged) `bulletCount` / etc. via a multiplier table in `WEAPON_DEFS` (see §4).
- On level-up (`_levelUp()` in `src/systems/loot.js`), the game pauses and a `WeaponLevelUpScene` modal opens. Three cards are offered. Player clicks one; the choice is applied via `unit.grantWeapon(key)` or `unit.upgradeWeapon(slotIdx)`; scene closes; game resumes.
- Card pool generation:
  - Across all 3 heroes, collect candidate offers:
    - **Upgrade offers**: each filled slot at level < 5 → one offer `{ heroId, slotIdx, kind: 'upgrade' }`.
    - **New-weapon offers**: each hero with at least one empty slot → one offer per weapon `key` they don't already own, drawn from a hero-specific weapon pool (see §4).
  - Sample 3 distinct offers, weighted by rarity (Common/Rare/Epic/Legendary tags on each weapon).
  - If fewer than 3 distinct offers exist (e.g. all heroes maxed out everything), fill the remainder with a guaranteed fallback "+heal 25%" panel that just heals the lowest-HP living hero.
- New-game reset and dead heroes:
  - `_startNewGame` resets `weaponSlots` to `[{ key: startingWeapon, level: 1 }, null, null]` for every hero.
  - Dead heroes are skipped when generating offers (the modal never offers anything to a dead hero, but rendering of the picker still shows all three columns; dead-hero slots show "FALLEN" like the existing `UpgradeScene` does).
- UI is **simple and clean**: 3 cards in a horizontal row, each clearly labelled with which hero is affected and whether it's a NEW weapon or an UPGRADE (level X → X+1, with the stat delta below). No animated reel — single static layout, one click resolves it. Background dims the frozen game beneath.

---

## 2. Non-goals (explicitly excluded)

- **No reroll button.** Player gets one set of 3 offers per level-up. Future: optional reroll cost in essence — deferred.
- **No removing/replacing weapons mid-run** beyond the level-up flow. The existing on-ground weapon-loot pickup (`applyLoot` weapon branch) is **deleted** or repurposed (see §5) — random weapon drops conflict with the slot-based model.
- **No weapon synergies / evolutions** (the Vampire Survivors meta-evolution, e.g. Whip + Hollow Heart → Bloody Tear). Filed as future content.
- **No new weapon art.** All weapons in this PR are already in `WEAPON_DEFS` with sprites in the registry.
- **No balance overhaul of existing wave-upgrade slot machine.** That keeps running between waves untouched. This adds a *second* progression axis (essence-paced) on top.
- **No per-weapon ammo/reload mechanics.** Weapons just fire on cooldown.

---

## 3. Files touched

| File | Change |
|---|---|
| `src/state.js` | Add `state.isLevelUpScreen = false` (mirror of `isUpgradeScreen`); reset in `_startNewGame`. |
| `src/config/weapons.js` | Add `rarity` and `heroPools` metadata. Add per-weapon `levels` array (5 entries) with per-level multipliers / additive bonuses. See §4. |
| `src/config/heroes.js` | (Optional, but recommended) declare `weaponPool: ['hockey_club', 'thrown_club', 'shotgun', …]` per hero so we can constrain offers thematically. If omitted, falls back to "any weapon". |
| `src/entities/Unit.js` | Replace `this.currentWeapon` single-string with `this.weaponSlots = [{ key, level } | null, null, null]`. Add per-slot `atkCd`. Rewrite the auto-attack loop in `update()` to iterate slots. Add `grantWeapon(key)`, `upgradeWeapon(slotIdx)`. Update `_wDef`, `atkDmg`, `atkRate`, `atkRange` getters to accept a slot (most damage paths become per-slot). |
| `src/systems/loot.js` | In `_levelUp()`, pause `GameScene` and launch `WeaponLevelUpScene` (post-flash). Remove the on-ground "weapon loot grant" path (or replace with an essence boost — see §5). |
| `src/phaser/scenes/GameScene.js` | Listen for the `levelup` event (or check `state._levelUpPending` flag) and launch the modal. While the modal is up, freeze game ticks the same way `UpgradeScene` already freezes them. |
| `src/phaser/scenes/WeaponLevelUpScene.js` *(new)* | The 3-card picker. ~150–200 LOC. Mirrors `UpgradeScene`'s scene lifecycle but is a single static frame, no reel animation. |
| `src/phaser/scenes/HUDScene.js` | Render the 3 weapon slots per hero in the existing left/bottom HUD area: small icon + level pip indicator (1–5 dots). Empty slot = dim placeholder. |
| `src/render/hud.js` | Helper `drawWeaponSlotBadge(ctx, x, y, slot)` if HUD draws via the Canvas 2D bridge. (Confirm in code whether HUDScene uses Phaser GameObjects or the canvas bridge — likely Phaser, in which case it's done in the scene.) |
| `public/assets/data/weapons/level_pools.json` *(new, optional)* | Externalise per-weapon level multipliers if the team wants data-driven tuning without code edits. Defer to §10 — first ship inline in `weapons.js` for simplicity. |
| `docs/current/current_game_state.md` | Add a "Weapon Slots & Level-Up Picker" subsection under Loot/XP. |
| `docs/index.md` | Add this file under `planning/`; move to `executed/` on phase completion. |

---

## 4. Data shapes

### Weapon slot on `Unit`

```js
this.weaponSlots = [
  { key: 'hockey_club', level: 1, atkCd: 0 },
  null,
  null,
];
```

`atkCd` lives on the slot, not on the unit. The unit's old `this.atkCd` is removed.

### Weapon level table (in `WEAPON_DEFS`)

Each weapon gets a `levels` field with **5 entries** (level 1 is the baseline, mirrored from the existing top-level stats so old code paths keep working during the transition). Stats not listed inherit from level 1.

```js
hockey_club: {
  displayName: 'Hockey Club',
  type: 'melee',
  rarity: 'Common',
  atkRange: 40, atkDmg: 26, atkRate: 0.34, knockback: 90,
  swingArc: 2.2, swingOffset: 1.1,
  // …
  levels: [
    /* L1 */ { atkDmg: 26, atkRate: 0.34 },
    /* L2 */ { atkDmg: 32, atkRate: 0.32 },
    /* L3 */ { atkDmg: 40, atkRate: 0.30, knockback: 110 },
    /* L4 */ { atkDmg: 50, atkRate: 0.28, knockback: 120 },
    /* L5 */ { atkDmg: 65, atkRate: 0.25, knockback: 140 },
  ],
},
```

For ranged: bumps `bulletCount` at L3 and L5, tightens `spread`, raises `atkDmg`. For thrown: bumps `projectileMaxRange` and `piercing` becomes true at L4.

Helper:

```js
export function resolveWeaponStats(slot) {
  const def = WEAPON_DEFS[slot.key];
  const lvl = def.levels?.[slot.level - 1] ?? {};
  return { ...def, ...lvl };
}
```

All getter paths (`_wDef`, `atkDmg`, `atkRate`, `atkRange`) take an optional slot argument. When omitted, default to slot 0 — keeps legacy callers (UI labels, ability code referencing "current weapon") working with minimal churn during the refactor.

### Hero weapon pools (per `HERO_DEFS`)

```js
eliott: { /* … */, weaponPool: ['short_hockey_club', 'throwing_stone', 'bow', 'crossbow', 'samurai_sword'] },
dick:   { /* … */, weaponPool: ['hockey_club', 'long_club', 'dual_clubs', 'thrown_club', 'boomerang', 'samurai_sword'] },
habib:  { /* … */, weaponPool: ['hockey_club', 'shotgun', 'crossbow', 'bow', 'samurai_sword'] },
```

Justification: keeps thematic fit (Dick = brawler, Eliott = ranged/agile, Habib = ranged/heavy) and prevents 3 identical weapon options across all heroes.

### Card offer shape (internal, never persisted)

```js
// Upgrade existing slot
{ kind: 'upgrade', heroId: 'dick', slotIdx: 0, fromLevel: 2, toLevel: 3, weaponKey: 'hockey_club', stats: { atkDmg: '+8', atkRate: '-0.02' } }

// Grant new weapon (fills the lowest empty slot)
{ kind: 'new', heroId: 'eliott', weaponKey: 'bow', rarity: 'Rare' }
```

---

## 5. Behaviour details

### Auto-attack rewrite (`Unit.update` in `src/entities/Unit.js`)

Current loop (line ~419–438) targets the single closest enemy and attacks if in range. Replace with:

```js
for (let i = 0; i < this.weaponSlots.length; i++) {
  const slot = this.weaponSlots[i];
  if (!slot) continue;
  slot.atkCd -= dt;
  if (slot.atkCd > 0) continue;

  const stats = resolveWeaponStats(slot);
  const target = this._findTarget(stats.atkRange);
  if (!target) continue;

  this.attack(target, slot, stats);   // refactored signature
  slot.atkCd = stats.atkRate;
}
```

`attack(target, slot, stats)` (and `_attackMelee`, `_attackRanged`, `_attackThrown`, `_attackCleave`) take the resolved stats object so each branch reads damage/range/bullets from the per-slot pack rather than from `this._wDef`.

The single `this.swing` / `this.throwArm` / `this.facing` animation state is shared across slots — that's fine; the strongest visible animation wins per frame. If multiple slots fire on the same frame the player sees one swing animation. Acceptable for v1; if it feels weak we add per-slot swing later.

### Level-up trigger (`src/systems/loot.js` `_levelUp`)

Currently `_levelUp` just decrements XP, increments level, sets `_levelUpFlash`, plays sfx. After incrementing the level, set a one-shot flag:

```js
state.pendingLevelUps = (state.pendingLevelUps || 0) + 1;
```

In `GameScene.update`, *before* the per-entity tick, if `state.pendingLevelUps > 0 && !state.isLevelUpScreen && !state.isUpgradeScreen`:

```js
state.pendingLevelUps -= 1;
state.isLevelUpScreen = true;
this.scene.launch('WeaponLevelUpScene');
this.scene.pause();
```

The decrement-one-and-queue-the-rest pattern means a boss drop that pushes the player up two levels in one frame yields **two consecutive picker screens**, each granting one choice. Honest and simple.

### `WeaponLevelUpScene` flow

- Dim the frozen GameScene (graphics rect, alpha 0.62 — same as `UpgradeScene`).
- Header: `LEVEL UP — choose one` (right-anchored level number for clarity).
- Body: three cards horizontally centred (~180 × 220 px each). Each card shows:
  - Hero portrait icon (top-left, 28 px) + hero name above it.
  - Big weapon icon (centre, 64 px).
  - Title: `NEW WEAPON: Shotgun` or `UPGRADE: Hockey Club  Lv 2 → 3`.
  - Stat delta lines (`+8 dmg`, `+0.02s rate` rendered as `faster`, `+1 bullet`, etc. — show only fields that changed).
  - Rarity stripe on the left edge using the existing palette (Common/Rare/Epic/Legendary tints from `UpgradeScene`'s `RARITY` const — reuse it).
- Hover: brighter border + slight scale (1.04). Click: confetti particle (cheap), close after 180 ms delay so the highlight is visible. ESC opens the existing PauseScene.
- Empty state: if fewer than 3 distinct offers exist, fill remaining card slots with `HEAL +25% (lowest HP hero)` panel that's always taken in addition (still 1 pick = 1 effect — picking this just heals).
- Scene lifecycle exactly mirrors `UpgradeScene._advance()`: stop self, resume GameScene, clear `state.isLevelUpScreen`.

### On pick — applying the choice

```js
function applyLevelUpOffer(offer) {
  const unit = state.units.find(u => u.type === offer.heroId);
  if (!unit || unit.dead) return;
  if (offer.kind === 'new') {
    unit.grantWeapon(offer.weaponKey);   // fills first null slot
  } else if (offer.kind === 'upgrade') {
    unit.upgradeWeapon(offer.slotIdx);   // slot.level = Math.min(5, slot.level + 1)
  } else if (offer.kind === 'heal') {
    unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * 0.25);
  }
}
```

### Removing the old on-ground weapon-loot grant (`applyLoot` weapon branch)

`applyLoot` currently calls `_equipWeapon(unit, weaponKey, ...)` which sets `unit.currentWeapon = weaponKey; unit.weaponTimer = lootDuration`. This conflicts with the slot model — a weapon pickup would overwrite the slot-0 weapon for a fixed duration, which is now nonsense in a multi-slot world.

Decision (lowest-friction): **convert weapon pickups into essence bonuses**. The pickup grants `xpPerPickup × 10` instead of equipping. The existing weapon-loot sprites and SFX still play. Document this in `current_game_state.md`. Skip the slot/duration mutation entirely. This keeps the loot table intact without orphaning sprites or having weapons sometimes-randomly-bypass the level-up flow.

Alternative considered: weapon loot adds a **temporary 4th slot** that expires after `lootDuration` seconds. Rejected — adds complexity to the slot model and conflicts with the "exactly 3 slots" goal stated in this PR.

### HUD changes

In `HUDScene`, where each hero card is drawn (existing layout — locate via `state.units` loop in `HUDScene._build` or similar), append a small slot strip below the hero portrait:

```
[icon] [icon] [---]      ← 3 cells, 22 × 22 px each, 4 px gap
 •••    ••    ---        ← level pips (filled dots up to current level)
```

Empty slot = dim grey box with a `+` glyph. The HUD scene already redraws each frame via its `update()` so picking the icon up reactively is automatic. Use `resolveAsset('loot', weaponKey)` — most weapon sprite keys exist in the loot icon set already.

### Reset (`GameScene._startNewGame`)

In the existing `Object.assign(state, {...})` reset block, ensure:

```js
isLevelUpScreen: false,
pendingLevelUps: 0,
```

When instantiating each `Unit`, the constructor change in §3 already sets `weaponSlots` to `[{key: def.startingWeapon, level: 1, atkCd: 0}, null, null]` — no additional plumbing needed.

---

## 6. Asset wiring

No new sprites. Weapon icons already exist (loot table renders them). For the modal:

- Hero portrait icon — reuse the existing HUD hero icon key.
- Weapon icon — `resolveAsset('loot', weaponKey)` or its sprite registry equivalent. If a key is missing, fall back to the `UpgradeScene` placeholder rect at rarity tint (already implemented there — copy the pattern).

Confirm during commit 3 that every weapon in the per-hero `weaponPool` has a resolvable icon. If any are missing, fall back rather than blocking the PR; flag in PR description.

---

## 7. Audio

- Reuse `loot.essence` for level-up cue (already plays).
- On scene open: `playSfx('ui.levelup', { synthetic: 'loot' })` (already in `_levelUp`).
- On card hover: `playSfx('upgrade_card_select')` (already exists, used by `UpgradeScene`).
- On card pick: same select sfx + the weapon's own `sfxAttack` once as a "weapon equipped" stinger (or skip — defer if noisy).

---

## 8. Implementation order (commits)

Each commit leaves the game runnable. Per `CLAUDE.md`, include doc updates in the same commit (or a docs-only follow-up).

1. **`feat(weapons): per-slot weapon model and multi-weapon auto-fire`**
   - Replace `currentWeapon` string with `weaponSlots[3]` on `Unit`.
   - Per-slot `atkCd`. `resolveWeaponStats(slot)` helper.
   - Refactor `attack(...)` and its four `_attack*` helpers to take a stats pack.
   - Auto-attack loop in `Unit.update` iterates slots.
   - Initialise slot 0 from `HERO_DEFS.startingWeapon`.
   - Test: each hero still attacks with their starting weapon. Slot 1/2 still null. Frame time unchanged.

2. **`feat(weapons): per-weapon level table and level-aware combat`**
   - Add `levels[]` arrays to every weapon in `WEAPON_DEFS`.
   - All combat stats now read through `resolveWeaponStats(slot)`.
   - Console test: force a slot to `{ key:'hockey_club', level:5 }` via dev console, confirm damage scales up.

3. **`feat(level-up): pause and open WeaponLevelUpScene on _levelUp`**
   - `state.pendingLevelUps` flag.
   - `GameScene` launches modal; freezes game like `UpgradeScene`.
   - `WeaponLevelUpScene` scaffold (frame + dim + close-on-pick — no real cards yet, just three placeholder buttons that each grant a dummy weapon to confirm wiring).
   - Test: pick up essence, hit 50 XP, modal appears, pick a card, game resumes, weapon slot updated.

4. **`feat(level-up): real offer generation, card UI, hero pools`**
   - `weaponPool` on `HERO_DEFS`.
   - Offer generator (collect upgrades + news, sample 3, weight by rarity).
   - Card rendering with hero portrait, weapon icon, stat delta lines, rarity stripe, hover/click.
   - Heal fallback when offers < 3.
   - Test: level up 6× in dev-mode, confirm a mix of new-weapon and upgrade cards appears, dead-hero offers never generated.

5. **`feat(hud): show 3 weapon slots + level pips per hero`**
   - HUD slot strip per hero card.
   - Test at multiple resolutions; confirm no overlap with the existing essence XP bar from `pr-level-up`.

6. **`refactor(loot): convert weapon pickups to essence bonuses`**
   - Delete `_equipWeapon` (or repurpose) — weapon-loot now grants `+10 XP` and plays the existing weapon stinger.
   - Update `current_game_state.md` accordingly.

7. **`docs(weapons): write down the slot/level-up model and move plan to executed`**
   - `current_game_state.md` subsection.
   - Move this file → `docs/executed/pr-weapons.md` and update `docs/index.md`.

---

## 9. Test plan (manual)

Run `npm run dev`, pick `dev-mode`:

- [ ] Each hero spawns with exactly their starting weapon in slot 0 at level 1. Slots 1 & 2 empty (dimmed `+`).
- [ ] Heroes attack with slot 0 at the same cadence as before this PR (regression check on baseline DPS).
- [ ] Kill enemies until first level-up (~50 essence). Modal opens, game pauses, XP bar stops climbing, ESC opens pause menu correctly.
- [ ] Three cards visible, one is clearly an UPGRADE (`hockey_club Lv 1 → 2`), one is a NEW weapon, one is either.
- [ ] Hovering a card highlights it (rarity colour); clicking dismisses the modal and applies the choice.
- [ ] Confirm the slot strip in the HUD reflects the change (new icon appears, or pips fill).
- [ ] Grant `bow` to Dick via picker; confirm Dick now fires arrows from slot 1 *while still swinging his hockey club* every interval. Both weapons should be hitting independently.
- [ ] Bigboss kill that crosses two thresholds at once: modal opens, pick, modal opens again, pick. Game stays paused throughout.
- [ ] Kill a hero, then level up. The dead hero's column in the modal is "FALLEN" (offers never generated for them).
- [ ] Pick up a weapon drop on the floor: confirm no slot is overwritten; instead `+10 XP` (or whatever the new value is) is granted and the existing sfx plays.
- [ ] Restart via `R` after game-over: slot 0 = starting weapon, level 1; slots 1/2 null; `state.level = 1`, `xp = 0`.
- [ ] Performance: kill ~40 enemies/second in dev-mode with all 9 weapon slots filled across the team (3 heroes × 3 slots). Frame time should remain stable — per-slot loop is O(slots × enemies) which is unchanged in scaling from the previous single-weapon path.
- [ ] No console errors throughout. `node scripts/check-game-data.js` passes after `WEAPON_DEFS` and `HERO_DEFS` edits.

---

## 10. Risk & open questions

- **Migration risk: `currentWeapon` is read in many places** (boomerang ability, weapon-timer expiry, audio key lookups, draw code in `src/render/`). Commit 1 has to grep `currentWeapon` and replace each call site with `weaponSlots[0]?.key` or a slot-aware variant. Estimate ~15–25 sites — non-trivial. Run a full code search before starting and pre-tag every site in the commit message to ensure none are missed. If a site reads `unit.currentWeapon` to render the swing animation, default to slot 0 since that's the player's "default" weapon for visual purposes.
- **Active abilities that reference weapons** (e.g. `boomerang` ability throws `unit.currentWeapon`). Decision: each ability defines what it throws explicitly in `ABILITY_DEFS`, not "throw current weapon". Most already do — verify in `src/config/abilities.js` during commit 1. Anything that genuinely needs "current weapon" can use `weaponSlots[0]?.key ?? def.startingWeapon`.
- **Power creep balance.** Multi-slot DPS scales fast: 3 weapons × 5 levels = ~15× DPS vs. baseline. Plan to **scale enemy HP by wave more aggressively** *or* cap each level's multiplier more conservatively after the first playtest. Numbers in §4 are placeholders — expect to tune. Adding `xpToNext: 100 → 100 + 25 * level` is a cheap pacing knob if leveling is too fast.
- **Loot weapon drops are de-facto removed** (converted to essence). This may feel like a regression to players who enjoyed the temporary-weapon mechanic. Mitigation: leave the existing animated weapon-loot sprites and `+10 XP` text — they'll feel like a "lucky big drop", not a missing feature. Revisit only if playtest hates it.
- **UI clarity:** showing both "NEW WEAPON" and "UPGRADE" on the same card layout risks the player misreading. Use distinct top-line typography (`+ NEW`, gold, vs `↑ UP`, blue) and a different rarity stripe colour saturation. Iterate after first playtest.
- **Per-slot atkCd vs. one shared atkCd** — verified safe; melee weapons use unit position so simultaneous melee swings just deal stacked damage which is fine. Two ranged shots in the same frame from the same hero is intentional ("a barrage").
- **Externalising weapon level tables to JSON (`level_pools.json`)** is tempting for designers, but premature now. Inline in `WEAPON_DEFS` ships faster; once the model is proven we can move it data-side with a 30-min refactor. Filed.
- **Reroll affordance** (spend essence to re-draw the 3 cards) is the obvious v2 feature once the system feels good. Don't build it in this PR.
- **Save/load is not in scope.** Weapon slots reset per run, like everything else. If save/load lands later, `weaponSlots` is trivially serialisable (`[{key, level}, …]`).
- **Conflict with between-wave UpgradeScene.** Both can theoretically queue up. Resolution: never run both at once. If a level-up fires during the wave-end frame, queue it — `state.pendingLevelUps` increments and the picker opens *after* the wave-upgrade screen closes. Add a guard in `GameScene.update` (the `!state.isUpgradeScreen` clause in §5 already does this; verify in commit 3).
