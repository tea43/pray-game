# Abilities Rework — Design Spec

## Design Intent

Replace the passive-upgrade slot machine system with two independent XP tracks — one shared ability
pool and one per-hero weapon pool. Each hero starts with one active ability at level 1 and two
locked secondary abilities. Over the run, the shared ability pool funds upgrades across all heroes'
trees. Abilities can combine: when a hero fires their main ability while a teammate's secondary
ability effect is running, the main ability receives a bonus whose magnitude scales with the active
secondary's current level.

---

## Two XP Tracks

### Ability XP — shared pool

All three heroes draw from a **single shared Ability XP pool**. The pool fills as enemies are killed
(source: essence drops). When the pool reaches the current threshold, it
resets (carryover preserved) and the player is presented with an **ability upgrade picker**: choose
1 tree level-up for any 1 hero.

**Threshold formula:** each successive threshold = `A × previous_threshold + B` (A and B
configurable). The cost escalates with every pick, regardless of which hero was upgraded.

**Total upgrades available per run:**

| Scope | Upgrades needed |
|---|---|
| One hero fully maxed (all 3 trees to level 3) | 8 picks |
| All three heroes fully maxed | 24 picks |

Tree 1 costs 2 picks per hero (level 1→2, 2→3). Trees 2 and 3 cost 3 picks each (0→1, 1→2, 2→3).

### Weapon XP — per hero

Each hero has their own **Weapon XP counter**, filled by damage that hero deals. When the counter
crosses its threshold, a weapon level-up fires for that hero only (same picker UI as today). Weapon
leveling is fully independent of ability leveling — it no longer uses essence drops.

---

## Ability Tree Structure

Each hero has **3 ability trees**. Each tree has **3 levels**.

- **Tree 1 (main ability):** starts at level 1 at game start. Hotkey: `1` / `2` / `3`.
- **Trees 2 & 3 (secondary abilities):** start at level 0 (locked). Activated by hotkeys once
  unlocked — same slots as the current active upgrade keys:

| Hero | Tree 1 (main) | Tree 2 | Tree 3 | Secondary hotkeys |
|---|---|---|---|---|
| Eliott | Blink | Green Pipe | White Powder | `Q` (tree 2) · `A` (tree 3) |
| Dick | Boomerang | Spin Clubs | Scream | `W` (tree 2) · `S` (tree 3) |
| Habib | Backdoor Blockade | Tinkering | Weapon Effects | `E` (tree 2) · `D` (tree 3) |

Leveling a tree upgrades the ability in place: level 2 replaces level 1, level 3 replaces level 2.
Heroes never run two levels of the same tree simultaneously.

---

## Slot Machine Changes

The between-wave slot machine now offers **ability tree levels** instead of passive/active upgrade
cards.

- 3 columns (one per hero), unchanged layout.
- Each reel pool contains the hero's 3 trees, filtered to only show trees that can still be leveled
  (level 0 → 1, 1 → 2, or 2 → 3). Trees already at level 3 are excluded.
- Total possible options per hero: up to 3 (one per tree). The reels spin through them and stop on
  one card per column.
- Player picks **one card** from any column (unchanged selection flow).
- **Reroll button:** visible but disabled for now. Not removed — keep the button in the UI, grayed out.

---

## Ability Definitions

### Eliott

**Tree 1 — Blink** (main ability, key `1`)

| Level | Name | Parameters | Notes |
|---|---|---|---|
| 1 | Blink (self) | `distance` | Eliott only. Current base ability minus the group pull. |
| 2 | Group Blink | `distance`, `groupRadius` | Pulls allied heroes within `groupRadius` of start to destination. Current full implementation. |
| 3 | Vacuum + Group Blink | `distance`, `vacuumRadius` | Draws all heroes within `vacuumRadius` to Eliott first, then group-blinks to destination. |

**Tree 2 — Green Pipe** (secondary, key `Q`)

| Level | Name | Parameters | Notes |
|---|---|---|---|
| 1 | Green Pipe | `armor`, `duration`, `radius` | Eliott and everyone in the radious gains damage reduction for `duration`. |
| 2 | Stoned Green Pipe | `armor`, `duration` | Eliott got frozen and immortal per period of time and attracts enemies to himself during `duration`. Once duration ends Eliott blinks to the closest his ally. If all allies are dead, he blinks toward selected direction of movement to the max distance of Blink ability|
| 3 | Overcharged Pipe | `armor`, `duration`, `damage` | Stoned pipe effect, then acid explosion around Eliott before he blinks back to the group. |

**Tree 3 — White Powder** (secondary, key `A`)

| Level | Name | Parameters | Notes |
|---|---|---|---|
| 1 | White Powder of Hit | `damage`, `radius` | Same as white powder of hit now, no changes.|
| 2 | White Powder of Dominance | `damage`, `radius` | Same as white powder of dominance ability now, no changes |
| 3 | Potato Starch | `damage`, `radius`, `distance` | Dominance effect, then all heroes blink as a group to Eliott's move destination afterward. |

---

### Dick

**Tree 1 — Boomerang** (main ability, key `2`)

| Level | Name | Parameters | Notes |
|---|---|---|---|
| 1 | Standard Boomerang | `damage`, `maxDistance` | Current base implementation. |
| 2 | Ellipse Boomerang | `maxDistance`, `damage`, `ellipseWidth` | Boomerang arcs in a wider ellipse, hits all enemies in the arc path. |
| 3 | Dual Boomerangs | `maxDistance`, `damage`, `ellipseWidth` | Two boomerangs launched simultaneously with ellipse trajectories into 2 most "dangerous" enemies. |

**Tree 2 — Spin Clubs** (secondary, key `W`)

| Level | Name | Parameters | Notes |
|---|---|---|---|
| 1 | Mill 360 | `radius`, `duration` | Dick's club spins in a circle around him, dealing continuous hit damage to enemies in `radius`. Dick remains selectable and movable. Exacly as now, no changes|
| 2 | Vortex | `radius`, `duration` | Spin clubs with a gentle pull: enemies near the perimeter of the club circle are slowly drawn toward it, increasing the chance of taking hit damage from the spinning clubs. No changes to the spin itself — only the pull toward the circle edge is added. |
| 3 | Dance of Death | `duration`, `radius`, `pullRadius`, `pullRadiusMultiplier`, `slamDamage`, `postStunDuration` | Dick becomes immortal for `duration`. Enemies within `pullRadius` (= `pullRadiusMultiplier × clubCircleRadius`, multiplier configurable, default ~1.5–2) are pulled slowly toward the center of the circle like a black hole — steady inward force, not instant. At the end of `duration`, Dick leaps to the center of the circle and slams: deals `slamDamage` (significant but not colossal) to all enemies there. Enemies that survive the slam are stunned for `postStunDuration` (default 2 s, measured in real seconds independent of game speed). |

**Tree 3 — Scream** (secondary, key `S`)

| Level | Name | Parameters | Notes |
|---|---|---|---|
| 1 | Scream | `stunDuration`, `radius` | Stuns all enemies within `radius` for `stunDuration`. |
| 2 | Inappropriate Stories | `radius`, `heroDuration`, `heroAtkBoost`, `enemyStunDuration` | Unchanged from current. All heroes within `radius` receive a speed boost and `heroAtkBoost`% attack rate increase for `heroDuration`. Enemies within `radius` are stunned for `enemyStunDuration`. Radial particle burst + screen shake on activation. |
| 3 | Transgender Talk | `radius`, `heroDuration`, `heroAtkBoost`, `enemyStunDuration` | Heroes within `radius` receive the same speed + attack rate buff as Inappropriate Stories (same parameters). Enemies within `radius` are **continuously** stunned for the full `heroDuration` — stun is re-applied each tick rather than a one-shot. |

---

### Habib

**Tree 1 — Backdoor Blockade** (main ability, key `3`)

| Level | Name | Parameters | Notes |
|---|---|---|---|
| 1 | Backdoor Blockade | `duration`, `armorLevel` | 50% damage reduction on all heroes within radius for `duration`. Current base implementation. |
| 2 | Stunned Backdoor Blockade | `duration`, `armorLevel`, `stunDuration` | Same reduction; enemies that strike a protected hero are stunned for `stunDuration`. |
| 3 | Fire Backdoor Blockade | `duration`, `armorLevel`, `fireDamage`, `burnTimer` | Same reduction; enemies that strike a protected hero take `fireDamage` and burn for `burnTimer`. |

**Tree 2 — Tinkering** (secondary, key `E`)

All Tinkering abilities slow enemies on hit. Slow parameters (`tinkeringSlow.factor`, `tinkeringSlow.duration`) are defined once in the global effects config and apply to every Tinkering level unless overridden.

Acid damage-over-time parameters (`acid.dotDamage`, `acid.dotInterval`) are also global and apply to every acid effect in the game (Acid Slingshot, acid combo bonuses, etc.).

| Level | Name | Parameters | Notes |
|---|---|---|---|
| 1 | Acid Slingshot | `initialDamage`, `acidDuration`, `shotCount`, `shotInterval` | Habib fires a burst of `shotCount` acid projectiles, one every `shotInterval` seconds. Each hit enemy takes `initialDamage`, is slowed (global Tinkering slow), and is covered in acid for `acidDuration` — taking `acid.dotDamage` every `acid.dotInterval` seconds for that duration. |
| 2 | Flamethrower | `initialDamage`, `range`, `coneRadius`, `burnTimer` | Cone fire blast in `range` and `coneRadius`. Enemies hit take `initialDamage`, are slowed (global Tinkering slow), and burn for `burnTimer`. |
| 3 | Lightning Chain | `distance`, `jumps`, `lightningDamage`, `slowDuration` | Lightning bolt chains up to `jumps` enemies within `distance`. Each hit enemy takes `lightningDamage` and is slowed for `slowDuration` (overrides the global Tinkering slow duration for this ability; slow factor still from global config). |

**Tree 3 — Weapon Effects** (secondary, key `D`)

Active ability with a timed window. On activation, all three heroes have their weapons enchanted
for `activationDuration` seconds. Every weapon hit during that window rolls a `triggerChance`%
probability of applying the effect to the struck enemy. `triggerChance` is per-level, must be a
multiple of 5, and is expected to be high (e.g. 75–95%).

| Level | Name | Parameters | Notes |
|---|---|---|---|
| 1 | Flame | `activationDuration`, `triggerChance`, `damage`, `burnTimer` | Each hero weapon hit has `triggerChance`% to deal `damage` fire damage and burn the enemy for `burnTimer`. |
| 2 | Stun | `activationDuration`, `triggerChance`, `stunTime` | Each hero weapon hit has `triggerChance`% to stun the enemy for `stunTime`. |
| 3 | Chain Lightning | `activationDuration`, `triggerChance`, `chainCount` | Each hero weapon hit has `triggerChance`% to trigger a `chainCount`-enemy lightning chain from the struck enemy. |

---

## Combination Rules

A **combination** fires when a hero activates their main ability (tree 1) while at least one other hero
has a secondary ability effect currently **active** (i.e., its visual/buff duration has not yet expired).

- All eligible secondaries contribute their bonus simultaneously (combos stack).
- The bonus magnitude and exact effect depend on the **current level** of the active secondary.
- Combinations are cross-hero only: a hero's own active secondary does not trigger a combo with their
  own main ability.
- All combination parameters must be configurable in the ability config file, keyed by
  `[mainAbility][secondaryTree][secondaryLevel]`.

### Boomerang (Dick fires main while…)

| Active secondary | Lvl 1 effect on Boomerang | Lvl 2 effect | Lvl 3 effect |
|---|---|---|---|
| Tinkering (Habib) | Acid trail on hit | Fire trail on hit | Lightning chain on hit |
| Weapon Effects (Habib) | Knockback on hit + Flame | Knockback on hit + Stun | Knockback on hit + Chain Lightning |
| Green Pipe (Eliott) | Boomerang slows enemies on hit | Slows + brief freeze | Slows + freeze + armor reduction |
| White Powder (Eliott) | Knockback on hit | Heavy knockback | Heavy knockback + brief stun |

### Blink (Eliott fires main while…)

| Active secondary | Lvl 1 effect on Blink | Lvl 2 effect | Lvl 3 effect |
|---|---|---|---|
| Tinkering (Habib) | Acid burst at landing zone | Fire burst at landing | Lightning burst at landing |
| Weapon Effects (Habib) | Knockback + Flame at landing | Knockback + Stun at landing | Knockback + Chain Lightning at landing |
| Spin Clubs (Dick) | Spin clubs travel from blink origin to landing, damaging everyone on path | Wider path | Wider path + vortex pull at landing |
| Scream (Dick) | Enemies stunned in landing radius | Longer stun + debuff | Continuous stun in landing radius for duration |

### Backdoor Blockade (Habib fires main while…)

| Active secondary | Lvl 1 effect on Blockade | Lvl 2 effect | Lvl 3 effect |
|---|---|---|---|
| Green Pipe (Eliott) | 2× protection multiplier | 2× + enemies slow on hit | 2× + freeze on hit |
| White Powder (Eliott) | Enemy that hits a protected hero is teleported back away | Teleport + brief stun | Teleport + stun + acid |
| Spin Clubs (Dick) | 1 round of Mill 360 spawns around each protected hero | Vortex around each hero | Dance of Death around each hero |
| Scream (Dick) | Already-stunned enemies get 3× stun duration | 3× stun + debuff | 3× stun + debuff + fear (flee behavior) |

---

## Implementation Notes

- **Do not remove any existing ability configuration.** Only add fields that are currently absent.
  Existing level-1 behaviors (Boomerang, Group Blink, Backdoor Blockade) map to the level-1 entries
  above and must remain bit-for-bit compatible with current behavior.
- **Blink distance:** if the destination is farther than `distance`, Eliott blinks as far as he can
  along that vector (current behavior — preserve it at all levels).
- **Spin Clubs / Mill 360:** Dick remains selectable, movable, and targetable for group blink during
  the spin. The center of the spin circle is considered Dick's position (current behavior).
- **Superboost / Group Abilities:** unchanged. Main ability activations (keys 1/2/3) still charge the
  superboost meter (+20% per use). Group combos (F key) are unaffected by this rework.
- **Config location:** `src/config/abilities.js` (`ABILITY_DEFS`). Each tree entry should include a
  `levels[]` array (indexed 0–2) with per-level parameters and an optional `combos` map keyed by
  `[secondaryTree][level]`.

---

## Resolved Decisions

**Ability XP thresholds:** Starting threshold = 100 essence kills. Formula: `next = 1 × prev + 10`
(i.e. linear +10 per pick: 100, 110, 120, 130 …). All values configurable.

**Weapon XP thresholds:** Same `A × prev + B` formula, pool fills from damage dealt by that hero.
Starting threshold and A/B values configurable independently from ability XP.

**Superboost charging:** All ability activations charge the superboost meter — main abilities
(keys `1`/`2`/`3`) and secondary abilities (keys `Q`/`W`/`E`/`A`/`S`/`D`) each grant +20% on use.

**Global effects config location:** `acid` and `tinkeringSlow` blocks live in
`src/config/abilities.js` alongside `ABILITY_DEFS`.

**Slot machine — dead hero column:** See Revive Minigame section below.

---

## Revive Minigame

When a hero is dead, their column in the slot machine is replaced by a **revive challenge** instead
of ability cards. The player can attempt a revive by interacting with that column.

### Visual

- A pulsing heart icon signals the revive attempt is available.
- Below it: a short, wide horizontal bar (EKG/heartrate style).
- Some zones of the bar are filled with a **darker highlight colour**; the rest is a lighter
  background. Zone positions are randomised each round.
- A **marker** travels from left to right across the bar at a configurable speed.
- The player must **click** while the marker is inside a dark zone to succeed that round.

### Rules

- **Rounds per revive:** 3 for the first revive of a given hero. Each subsequent revive of the same
  hero adds 2 more rounds (configurable base and increment).
- **Success:** all rounds cleared → hero is revived at **33% of max HP**, placed near the centroid
  of the surviving heroes. A green healing pulse animation plays on the revived hero (expanding
  rings + rising green particles). A brief success message appears and fades out (e.g. "He's back!",
  "Against all odds…").
- **Failure:** any single round missed (click outside a dark zone, or no click before marker exits)
  → challenge fails immediately; game continues without revival. A short humorous message pops up
  centred on screen and fades out after ~2 seconds. Messages are drawn randomly from the failure
  pool (see below).
- **Round progression:** on a successful click the bar is replaced with a new one — different dark
  zone positions, marker resets to left and moves at the same (or slightly faster) speed.

### Failure Messages

Shown as a bold floating label, fades out over ~2 s. One is chosen at random per failure:

- *"Your hands weren't exactly steady for a heart massage."*
- *"You broke three of his ribs. Was that a rescue or an attack?"*
- *"Did you just slap him in the face and call it medicine?"*
- *"CPR certification: revoked."*
- *"He was already dead. You made it worse somehow."*
- *"Field surgery with the confidence of a drunk mechanic."*
- *"Next time try not to kneel on his neck."*
- *"The worms outside are less dangerous than your first aid."*
- *"He twitched. You panicked. He died again."*
- *"Technically that counts as a second cause of death."*

All messages live in a configurable string array in `REVIVE_MINIGAME_CONFIG` so new ones can be
added without touching code.

### Parameters (configurable)

| Parameter | Description |
|---|---|
| `baseRounds` | Rounds required for the first revive (default 3) |
| `roundsIncrement` | Extra rounds added per subsequent revive of the same hero (default 2) |
| `markerSpeed` | Marker traversal time in seconds (default TBD) |
| `zoneCount` | Number of dark zones shown on the bar per round (default TBD) |
| `zoneWidthFraction` | Starting dark zone width as a fraction of the full bar width (default TBD) |
| `zoneWidthDecayA` | Multiplier applied to `zoneWidthFraction` per wave: `width = zoneWidthFraction × zoneWidthDecayA ^ wave` (default TBD, e.g. 0.97) |
| `zoneWidthDecayB` | Flat reduction subtracted per wave after the multiplier (default TBD, e.g. 0) |
| `zoneWidthMin` | Minimum zone width fraction — zones never shrink below this floor (default TBD) |
| `reviveHpFraction` | HP fraction on revival (default 0.33) |

**Zone scaling:** as the wave number increases, dark zones become narrower according to the decay
formula, making late-game revives harder. `zoneCount` controls how many separate dark zones appear
on the bar — more zones give the player more target area but add visual complexity. Both
`zoneWidthFraction` and `zoneCount` are defined in a dedicated config block (e.g.
`REVIVE_MINIGAME_CONFIG` in `src/config/abilities.js`) so they can be tuned without touching code.

### Testing Scene

The main menu dev tools must include a **Revive Minigame Test** entry that opens a standalone test
scene (`ReviveTestScene`).

- Runs **10 rounds** back-to-back — the maximum possible number of rounds a player could face in a
  real game (3 base + 2 × 2 extra revives + 1 = worst-case scenario ceiling, round up to 10 for
  coverage).
- Zone width and count use the configurable values from `REVIVE_MINIGAME_CONFIG`, so the tester
  reflects the actual tuned feel.
- After all 10 rounds the scene shows a result summary: how many rounds succeeded, failed, and total
  time taken.
- Success and failure feedback (heal animation, floating messages) play exactly as they would
  in-game — the test scene is the primary tuning ground for message timing, fade speed, and feel.
- Accessible from the same dev tools panel as the existing `ABILITY TESTING` difficulty button.
