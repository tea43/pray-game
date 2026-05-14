# Abilities Structure Rework — Design Document

## Goal

Make every hero ability — base and upgrade — modular and customizable: each ability lives in a single unified file with its own icon, sound, parameters (cooldown, duration, intensity, etc.), and optional passive tick. **Abilities remain bound to their hero; cross-hero swapping is out of scope.**

---

## Current State

The ability system is split across three locations:

### 1. Base abilities (hardcoded in `Unit.js`)

| Hero | Key | Ability | Code location |
|---|---|---|---|
| Eliott | `1` | Group Blink | `Unit._blink()` ~line 730 |
| Dick | `2` | Boomerang Throw | `Unit._boomerang()` / `cast()` |
| Habib | `3` | Backdoor Blockade | `Unit._backdoorBlockade()` ~line 750 |

Logic is implemented directly inside `Unit.js` as private methods. The hero's `type` field drives which method fires.

### 2. Active upgrade skills (`src/systems/activeSkills.js`)

`ACTIVE_SKILL_DEFS` maps skill ID → `{ maxCd, activate(unit), passive?(unit) }`.

These are already modular. `activate()` is called on key press; `passive()` is called by `applyWaveUpgrades()` each wave. Icons live separately in `GameData.abilityIcons`.

### 3. Upgrade pool JSON files (`public/assets/data/upgrades/`)

Each hero's upgrade pool lists skill IDs with name, description, rarity. Hero slot hotkeys are defined in `hud.js` (`HERO_KEYS`).

---

## What Changes Are Needed

1. **Unified ability definition structure** — one shape covering both base and upgrade abilities.
2. **Move base ability logic** out of `Unit.js` into a shared `ABILITY_DEFS` map.
3. **Flatten icon/color/sound** from `GameData.abilityIcons` + `activeSkills.js` into each definition entry.
4. **Hero config names its base ability ID** so `Unit.cast()` dispatches by lookup, not by `switch(this.type)`.

Heroes keep their own abilities. The refactor is structural, not a balance change.

---

## Proposed Unified Ability Shape

```js
{
  id:          'group_blink',
  displayName: 'Group Blink',
  description: 'Teleports up to 240px toward cursor; pulls nearby allies.',
  icon:        'assets/icons/group_blink.png',  // optional; first-char placeholder if absent
  color:       '#8060ff',                        // tint for icon placeholder and HUD border
  sound:       'ability_blink',                  // optional; omit for silent passives

  // Timing — omit fields that don't apply
  cooldown: 9,       // seconds between activations; null = passive (no manual trigger)
  duration: null,    // seconds the effect lasts after activation; null = instant/self-managed

  // Custom params — anything activate() needs; arbitrary per-ability
  params: {
    range:      240,
    pullRadius: 120,
    pullDist:    40,
  },

  // Hooks
  activate(unit, params) { … },   // called on key press
  passive(unit, params)  { … },   // optional; called each wave start
  onExpire(unit, params) { … },   // optional; called when duration runs out
}
```

---

## Migration Plan

### Phase A — Define the structure, migrate base abilities (no gameplay change)

1. Create `src/config/abilities.js` exporting `ABILITY_DEFS`.
2. Move `Unit._blink()`, `Unit._boomerang()`, `Unit._backdoorBlockade()` into `ABILITY_DEFS` entries (`group_blink`, `boomerang_throw`, `backdoor_blockade`).
3. In `HERO_DEFS`, add `baseAbilityId` pointing to the ability ID.
4. In `Unit.cast()`, replace `switch(this.type)` with `ABILITY_DEFS[this.baseAbilityId].activate(this)`.
5. Keep `upgradeSlots` and `activeSkills.js` untouched for now.

### Phase B — Merge activeSkills.js and abilityIcons into ABILITY_DEFS

1. Move all `ACTIVE_SKILL_DEFS` entries into `ABILITY_DEFS`.
2. Flatten `GameData.abilityIcons` icon/color into each definition; remove `abilityIcons`.
3. Remove `activeSkills.js`; import from `abilities.js` everywhere it was used.
4. Upgrade JSON files keep name/description/rarity; runtime params come from `ABILITY_DEFS[id]`.

---

## Open Questions

1. **Boomerang Throw draw state:** Dick's throw animation is tightly coupled to `Unit._drawDick()` and `Projectile.js` — arm extension, smear rendering, and "unarmed" state all reference `unit` internals. The logic can move to `ABILITY_DEFS`, but draw hooks either stay in `Unit.js` or the ability def gets an optional `drawHook(unit, ctx)` field. Preference?

2. **Passive ability scope:** Wave-start passives (stat buffs) go in the `passive()` hook. Per-frame visual effects (Habib's blockade aura, stoned glow) should stay in `Unit.draw()` — they are presentation, not logic. Agreed?

3. **Loot-granted weapons (spray gun, samurai sword):** Currently in `WEAPON_DEFS`, not abilities. Keep them separate or fold into `ABILITY_DEFS` with a `lootPickup: true` flag?

---

## Status: IMPLEMENTED

Phases A and B are complete. `src/config/abilities.js` is now the single source of truth for all ability definitions (icon, color, sound, maxCd, activate, passive). `activeSkills.js` has been deleted. `GameData.abilityIcons` and `loadAbilityIcons()` removed from `upgrades.js`. All import sites updated. No gameplay values changed.
