# Abilities Rework — Implementation Progress

Spec: `docs/planned/abilities_rework_3.md`
Branch: `group-abilities` (continue here)

---

## Phases

| # | Phase | Status | Notes |
|---|---|---|---|
| 1 | State & Config Foundation | ✅ done | abilityXp state, tree levels per hero, global acid/slow config |
| 2 | XP Wiring | ✅ done | essence → abilityXp, melee/cleave → weaponXp, threshold formula |
| 3 | Slot Machine Rework | ✅ done | UpgradeScene shows ability tree level-ups per hero, spin disabled |
| 4 | Ability Dispatch by Level | ✅ done | castTree(treeNum) dispatches by level; Q/W/E/A/S/D wired to tree 2/3 |
| 5a | Eliott Ability Levels | ✅ done | levelAbilityIds dispatch; blink_self, vacuum_group_blink, overcharged_pipe, potato_starch |
| 5b | Dick Ability Levels | ✅ done | ellipse_boomerang, dual_boomerangs, dance_of_death, transgender_talk |
| 5c | Habib Ability Levels | ✅ done | stunned/fire blockade, acid_slingshot, lightning_chain_tinkering, weapon_effects_* |
| 6 | Combination System | ⬜ todo | cross-hero combo detection + bonus effects table |
| 7 | Revive Minigame | ⬜ todo | EKG bar, dark zones, marker, success/fail feedback |
| 8 | ReviveTestScene | ⬜ todo | 10-round standalone test, accessible from dev tools |

---

## Phase 1 — State & Config Foundation

**Goal:** add the structural data needed by every later phase without changing any observable behavior.

### Files changed

- `src/config/abilities.js` — add `ABILITY_XP_CONFIG`, `WEAPON_XP_CONFIG`, `ACID_CONFIG`, `TINKERING_SLOW_CONFIG`, `REVIVE_MINIGAME_CONFIG`; add `levels[]` stubs to existing ability defs; add stub entries for new abilities
- `src/state.js` — add `abilityXp`, `abilityXpThreshold` to initial state
- `src/phaser/scenes/GameScene.js` — initialise `abilityTrees` per hero in reset block
- `src/entities/Unit.js` — expose `abilityTreeLevel(tree)` helper

### Acceptance

- Game boots and plays identically to before.
- `state.abilityXp` exists and is 0.
- Each unit has `unit.abilityTrees = { 1: 1, 2: 0, 3: 0 }`.

---

## Phase 2 — XP Wiring

**Goal:** essence drops fill shared Ability XP pool; damage dealt fills per-hero Weapon XP; threshold formula escalates correctly.

### Files changed

- `src/systems/loot.js` — essence pickup increments `state.abilityXp`; when it crosses `state.abilityXpThreshold`, trigger ability upgrade picker (UpgradeScene) and recompute threshold
- `src/systems/combat.js` — damage dealt by a hero increments `unit.weaponXp`; crossing threshold triggers WeaponLevelUpScene for that hero
- `src/state.js` — replace bare `xp`/`xpToNext` usage with new fields (keep `level` for HUD bar fill)

### Acceptance

- Killing enemies visibly fills the ability XP bar.
- Weapon level-up still fires when a hero deals enough damage.

---

## Phase 3 — Slot Machine Rework

**Goal:** UpgradeScene offers one ability tree level-up per hero column instead of passive cards.

### Files changed

- `src/phaser/scenes/UpgradeScene.js` — replace reel pool with filtered list of levelable trees per hero; card shows tree name and current/next level; reroll button visible but disabled (grayed out)

### Acceptance

- Between waves: 3 columns, each offering a tree level-up for that hero.
- Trees already at max (level 3) do not appear.
- Picking a card increments that hero's tree level.
- Reroll button exists but cannot be clicked.

---

## Phase 4 — Ability Dispatch by Level

**Goal:** pressing an ability hotkey reads the hero's current tree level and calls the right activate function.

### Files changed

- `src/entities/Unit.js` — ability activation logic reads `unit.abilityTrees[tree]` and looks up the level-specific handler from `ABILITY_DEFS[abilityId].levels[level - 1]`
- `src/config/abilities.js` — restructure relevant defs to have `levels[]` arrays; each level entry has `{ params, activate }` or shared `activate` + `params`

### Acceptance

- Level 1 behavior is identical to current behavior.
- Leveling up a tree causes next activation to use the new level behavior.

---

## Phase 5a — Eliott Ability Levels

Blink: L1 = self only; L2 = current group blink; L3 = vacuum then group blink  
Green Pipe: L1 = armor aura; L2 = Stoned (frozen + immortal + attract + blink back); L3 = Stoned + acid explosion  
White Powder: L1/L2 = unchanged; L3 = Potato Starch (dominance + group blink to Eliott destination)

---

## Phase 5b — Dick Ability Levels

Boomerang: L1 = current; L2 = ellipse arc; L3 = dual targeting "most dangerous"  
Spin Clubs: L1 = Mill 360 (no change); L2 = Vortex (pull toward circle perimeter); L3 = Dance of Death  
Scream: L1 = current stun; L2 = Inappropriate Stories (unchanged); L3 = Transgender Talk (continuous stun)

---

## Phase 5c — Habib Ability Levels

Backdoor Blockade: L1 = current; L2 = stun retaliaton; L3 = fire retaliation  
Tinkering: L1 = Acid Slingshot burst; L2 = Flamethrower + slow; L3 = Lightning Chain + slow override  
Weapon Effects: L1/L2/L3 = active window, all heroes, per-hit triggerChance (Flame/Stun/Chain Lightning)

---

## Phase 6 — Combination System

Cross-hero combo detection: when hero fires main ability (key 1/2/3) and a teammate's secondary effect is active, apply the bonus from the combination table in the spec.

---

## Phase 7 — Revive Minigame

EKG bar replaces dead hero column in slot machine. Dark zones, moving marker, click timing, success (heal animation near teammates), failure (random humorous message pool).

---

## Phase 8 — ReviveTestScene

Standalone 10-round test scene. Accessible from dev tools panel. Shows result summary + full success/failure feedback.
