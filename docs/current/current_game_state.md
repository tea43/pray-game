# Current Game State

Source of truth: `src/` (modular build). Run `npm run dev` to play.

This snapshot is for fast agent onboarding. It describes the current playable behaviour without requiring a full read of every source file.

## Game Identity

P-RAY: The Game is a **Phaser 3** survival tactics game (Canvas 2D bridge renderer). The player controls a squad of three survivors in a post-apocalyptic alien-worm setting built around P-RAY, a rare almost magical grass/substance. Time advances only while at least one survivor is moving, creating a hybrid of real-time action and pause-like tactical positioning.

**Runtime:** `index.html` → `src/phaser/game.js` → `GameScene.js`. Do not edit `src/main.js` — it is deleted.

**World:** 3× screen width, 3× play height (9× total area). Camera tracks hero centroid with smooth lerp, clamped to world bounds. Large Map Phase 1 is complete.

## Controls

- Left click: select a survivor.
- Drag select: box-select survivors.
- Shift-click: add/remove a survivor from selection.
- Click portrait: select from the bottom ability panel.
- Right click: move selected survivors, or attack-move if clicking an enemy.
- `1`: Eliott ability (Group Blink). Also charges Eliott's superboost meter (+20% per use).
- `2`: Dick ability (Boomerang Throw). Also charges Dick's superboost meter.
- `3`: Habib ability (Backdoor Blockade). Also charges Habib's superboost meter.
- `F`: Fire group combo for the currently **selected** heroes. The matching combo fires if all selected participants have full superboost charge and are within the required distance. When conditions are met, a pulsing dashed link and "[F] COMBO NAME" indicator appear between the heroes.
- `Q`: Eliott's 1st active skill (if equipped).
- `W`: Dick's 1st active skill (if equipped).
- `E`: Habib's 1st active skill (if equipped).
- `A`: Eliott's 2nd active skill (if equipped).
- `V`: stop selected survivors.
- `S`: fire Dick's 2nd active skill (if equipped).
- `D`: Habib's 2nd active skill (if equipped).
- `+`: increase time speed multiplier (x1 → x2 → x3).
- `-`: decrease time speed multiplier (x3 → x2 → x1).
- `SPACE` tap (< 1s): toggle manual pause on/off.
- `SPACE` hold (≥ 1s): while held, world runs at the current speed multiplier regardless of pause state; releases back to previous pause state on key-up.
- `R`: restart after game over or victory.

## Time Flow Mechanics

Time in P-RAY is activity-driven. The world advances only when something drives it:

1. **Movement**: any living survivor walking → time flows at the current speed multiplier.
2. **Speed multiplier** (`+`/`-`): sets the rate at x1, x2, or x3. Does not start or stop time by itself.
3. **Manual pause** (`SPACE` tap): toggles an explicit freeze. The world stops regardless of survivor movement. Press again to lift.
4. **Hold to advance** (`SPACE` hold ≥ 1s): temporarily forces time forward at the current speed while the key is physically held. Releasing returns to the previous pause/idle state.

Priority order (highest first):

1. Game over → always frozen.
2. Space-hold driving (held ≥ 1s) → run at speed multiplier.
3. Manual pause → frozen.
4. Survivors moving → run at speed multiplier.
5. Otherwise → frozen.

## Core Loop

- Survive escalating alien worm waves.
- Move survivors to advance time, kite enemies, pick up loot, and trigger attacks.
- Time also advances while forced speed is x1, x2, or x3, even if survivors are idle.
- x3 is the maximum forced speed.
- Waves advance every 22 game-seconds.
- Spawn interval starts around 1.4 seconds and shrinks by 16% each wave to a 0.30 second floor.
- After wave 21 completes, spawning stops. Once all remaining enemies are dead, a helicopter flies in from the top edge.
- Heroes must move into the helicopter's landing zone (green circle, centre of arena) to board. When the last living hero boards, the helicopter lifts off and flies off-screen.
- Victory screen: panel fades in over 2s centred on screen, then slides to the right side (x = W−150) after 4s with a dark right band fading in behind it. Video `heli_escape.mp4` plays as background.
- Defeat triggers when all three survivors die.

## Heroes

| Hero | Base Role | HP | Attack | Range | Rate | Ability |
|---|---|---:|---:|---:|---:|---|
| Eliott | Alchemical potion provider | 100 | 18 | 32 | 0.28s | `Q` Group Blink |
| Dick | Melee heavy unit | 120 | 26 | 40 | 0.34s | `W` Boomerang Throw |
| Habib | Frontline engineer | 100 | 26 | 40 | 0.34s | `E` Backdoor Blockade |

## Weapon Slots & Level-Up Picker

Each hero owns **3 weapon slots** (`weaponSlots[3]`). Slot 0 starts filled with the hero's starting weapon at level 1; slots 1 and 2 start empty (`null`). Every filled slot fires independently on its own cooldown — heroes with multiple weapons auto-attack with all of them simultaneously, Vampire-Survivors style.

**Weapon levels (1–5):** Each weapon has a `levels[]` array in `WEAPON_DEFS` with per-level stat overrides (`atkDmg`, `atkRate`, `knockback`, `bulletCount`, `piercing`, etc.). Stats are resolved via `resolveWeaponStats(slot)` which merges the base def with the level entry.

**Level-up picker:** When `_levelUp()` fires, `state.pendingLevelUps` is incremented. Before each entity tick, `GameScene` checks `pendingLevelUps > 0 && !state.isLevelUpScreen && !state.isUpgradeScreen` and launches `WeaponLevelUpScene`, pausing the game. The scene presents **3 cards**:
- **↑ UPGRADE** (blue badge): upgrade an existing weapon slot (level N → N+1), showing stat delta.
- **+ NEW** (gold badge): grant a hero a new weapon into an empty slot, drawn from their `weaponPool` in `HERO_DEFS`.
- **♥ HEAL** (green badge): fallback when fewer than 3 weapon offers exist — heals the lowest-HP living hero by 25% of max HP.

Offers are weighted by rarity (Common=1, Rare=2, Epic=3, Legendary=4). Dead heroes are skipped during offer generation. Selection is a **two-step flow**: clicking a card highlights it (gold outer border, rarity stripe fully lit, inner ring); clicking the **CHOOSE UPGRADE** button at the bottom of the modal applies the offer and resumes `GameScene` (120 ms delay). The button is disabled until a card is picked. ESC opens `PauseScene` without closing the picker.

**HUD weapon strip:** Below each hero card in the bottom panel, a row of 3 cells shows the equipped weapons: a coloured background tinted by weapon type (melee = amber, ranged = blue), a 2–4 character abbreviation, and 5 level pips (filled up to current level). Empty slots display a dim box with `+`.

**Hero weapon visuals:** Heroes draw the weapon held in their **highest-index filled slot** (`_displaySlot` getter on `Unit`) — i.e. the most recently equipped weapon. All weapons are now rendered as **16x16 retro pixel art sprites** drawn via Canvas `fillRect` (`src/render/weaponSprites.js`). Melee attacks show bright, sweeping crescent slash trails during the swing animation. Ranged and thrown weapons render the pixel art sprite for the projectile (or boomerang) in flight.

**Hero weapon pools:**
- Eliott: `short_hockey_club`, `throwing_stone`, `bow`, `crossbow`, `samurai_sword`
- Dick: `hockey_club`, `long_club`, `dual_clubs`, `thrown_club`, `boomerang`, `samurai_sword`
- Habib: `hockey_club`, `shotgun`, `crossbow`, `bow`, `samurai_sword`

**State fields:** `state.isLevelUpScreen` (bool, mirrors `isUpgradeScreen`), `state.pendingLevelUps` (int queue). Both reset to `false`/`0` on new-game.

## Base Weapons

- Eliott: `short_hockey_club` (slot 0, level 1); fast short-range melee with moderate knockback.
- Dick: `hockey_club` (slot 0, level 1); dual alternating melee swings with high knockback.
- Habib: `hockey_club` (slot 0, level 1); melee swings (no projectile).

## Abilities

- Eliott, Group Blink: teleports up to 240 px toward the cursor; every allied hero within 120 px of Eliott's start position is also pulled to within ~40 px of his destination. Cooldown: 9s.
- Dick, Boomerang Throw: auto-targets the heaviest enemy within 300 px; the hockey club flies an oval arc outbound (260 px/s, 40 dmg/hit, piercing) then returns (300 px/s, 25 dmg/hit). Dick is unarmed until the club returns. Cooldown: 10s (starts on catch).
- Habib, Backdoor Blockade: all heroes within 150 px of Habib at activation receive 50% damage reduction for 6s (buff travels with each hero). Cooldown: 14s.

All abilities (base + upgrade skills) are defined in `src/config/abilities.js` (`ABILITY_DEFS`): each entry holds `icon`, `color`, `sound`, `maxCd`, and an optional `activate(unit)` function. Passive-only entries omit `activate`. `src/systems/activeSkills.js` has been removed.

## Group (Superboost) Abilities

Each successful base ability use (keys 1/2/3) grants **+20% superboost charge** to that hero. At 100% the hero is "ready." Select the heroes you want and press **F** — the system matches the selection to a combo, checks that all participants are charged and within range, and fires the **friendship-power** combo.

**Charge bar:** rendered as a thin bar below each hero's HP bar in the bottom panel. Blue while charging, gold+pulsing when full.

**Combos (all require 100% charge on participating heroes):**

| Name | Heroes | Distance | Effect |
|---|---|---|---|
| **Chocho Train** | Eliott+Dick | 100–250 px | Dick rushes to Eliott; heavy damage along path; burst at arrival |
| **High Five My Bro** | Dick+Habib | 100–250 px | Dick and Habib converge to midpoint; large electrical nova |
| **Vietnam Memories** | Eliott+Habib | 100–250 px | Eliott pulls Habib; fire lane ignites the path; burn damage |
| **You Should Stay In The Ground** | All three | 80–300 px (pairwise) | Triangle prison; enemies stunned+pulled to center; Dick slams center; all blink in |

All participating heroes are **immortal** during execution. Combos include cinematic slow-motion and screen-flash. System lives in `src/systems/groupAbilities.js`.

**Testing:** `ability-test` difficulty (dev tools → ABILITY TESTING) starts game with superboost always full, enemies spawning 220–350 px from hero centroid at fast rate.

## Active Upgrade Slots

Each hero can hold up to 2 active upgrade skills beyond their base ability. Active skills are awarded by the slot-machine and bound to hotkeys in acquisition order:

| Slot | Eliott | Dick | Habib |
|---|---|---|---|
| 1st | `Q` | `W` | `E` |
| 2nd | `A` | `S` | `D` |

Active upgrades have a durability counter (3 waves by default; modified by difficulty). When the counter reaches 0 the slot empties and the upgrade becomes available in future reels again. Durability pips are shown in the HUD. Passive upgrades remain permanent for the run.

## Between-Wave Upgrades (Slot Machine)

At the end of each 22s wave, `UpgradeScene` appears as a slot machine overlay. If any ability is still executing (blink chain, mill, vortex, dominance chain, etc.) the popup is deferred until the ability finishes, then appears immediately.

**Selection:** Three vertical reels, one per hero column (Elliot | Dick | Habib). Each reel scrolls through that hero's upgrade pool and stops on a card. The player clicks **one** centred card from **any one** column — that upgrade is applied and the next wave begins automatically (no confirm button).

**Reel pool:** Each hero's pool is drawn from their respective JSON file (`public/assets/data/upgrades/`). Previously-chosen upgrades are excluded from future reels via `state.selectedUpgradeHistory`. The pool is shuffled once per scene open.

**Spin animation:**
- *Initial spin* (on screen open): ~1 second, all columns stop simultaneously, no deceleration.
- *Re-spin* (player-triggered): 2–6 seconds, each column stops independently at a random time within ±1 s of a shared base duration, hard-capped at 6 s.

**Spin credits:** Each wave adds 1 credit (max 3 banked). The spin button shows `↻ N`. Spending 1 credit re-rolls all reels. Only one re-spin allowed per wave pause.

**Upgrades have rarities** (Common, Rare, Epic, Legendary) shown as a coloured left stripe and background tint. Effects include stat multipliers (speed, damage, cooldown, attack rate) and special hooks.

**Passive upgrades are temporary** — they wipe at the start of each wave; `selectedUpgradeHistory` persists for the run. **Active upgrades** are stored on the unit and tick down a durability counter each wave (see Active Upgrade Slots above).

`GameScene` is paused while `UpgradeScene` is active. ESC opens the settings/pause panel without closing the upgrade screen. On selection, `GameScene` resumes and `advanceWave()` is called.

## Loot

| Loot | Effect |
|---|---|
| `medkit` | Heals the pickup survivor over 4s (total ~60 HP). |
| `rare_medkit` | Blue medkit; heals over 5s for 1.8× the normal amount. |
| `stimpack` | Applies 5s rage-like buff and reduces ability cooldown by 2s. |
| `bomb` | Area explosion, radius 280. Damage falls off linearly from 150 at centre to 0 at edge (`LOOT_DEFS.bombDamage`). |
| `banana_bomb` | Larger explosion, radius 420, damage 300 at centre (`LOOT_DEFS.bananaBombDamage`), heavy knockback, 2.5s stun. |
| `shotgun` | **+10 XP** (weapon sprites and SFX still play; no longer equips temporarily). |
| `samurai_sword` | **+10 XP** (weapon sprites and SFX still play; no longer equips temporarily). |

Regular enemy drop distribution: medkit ~52%, rare_medkit ~8%, stimpack ~35%, bomb ~5%. Loot spawn rates in difficulty configs are low (e.g. brood-hunter: medkit 6%, stimpack 3.5%, bomb 1%).

Drop chance by enemy:

- Raider: 45%
- Runner: 30%
- Ghoul: 65%
- Blinker: 80%
- Mutant: 100%
- Miniboss and bigboss: guaranteed custom bundles.

Hard regular enemies (`mutant`, `blinker`) also roll for specials: 2% banana bomb, otherwise 20% chance for `shotgun` or `samurai_sword` loot (both grant +10 XP on pickup).

### Player Level & Essence

Every enemy death drops essence orbs (small green-yellow gradient spheres, rendered via `essence_drop.png` sprite or canvas fallback):

| Enemy | Essence drops | Placement |
|---|---:|---|
| Regular | 1 | Random ±6 px around corpse |
| Miniboss | 8 | 22 px ring around corpse |
| Bigboss | 25 | 36 px ring with ±4 px jitter |

Each living hero has a **60 px pickup radius** (`pickupR`) for essence. The instant an essence orb's centre crosses any hero's circle it **locks onto that hero** and flies toward them — Vampire-Survivors-style magnet. The orb's speed starts at 180 px/s, accelerates at 1200 px/s², and caps at 700 px/s; on body contact (`u.r + l.r + 2`) it pops a small green additive particle burst and applies pickup through the normal `applyLoot` path (XP + `+1` floating text + `loot.essence` sfx). All other loot (medkits, stimpacks, bombs, weapons) still requires body contact and does **not** magnet. If a locked hero dies mid-flight the orb re-acquires the nearest living hero with no radius gate; if all heroes are dead the orb stops in place. The magnet runs on `gameDt`, so slow-mo slows the orbs in lockstep with the rest of the world. `pickupR` is hero-intrinsic (defined in `HERO_DEFS` as `pickupR: 60`) and does not reset on death; the per-orb `homingTarget` / `homingSpeed` fields live on the `Loot` instance and are GC'd with it. A debug capture ring can be toggled via `state.settings.showPickupRing = true` in the console.

Picking up an essence orb grants **1 XP** to a run-wide pool (`state.xp`). At **50 XP** the pool resets (carryover preserved), `state.level` increments, a gold flash plays on the HUD bar, and a synthetic rising-arpeggio sfx fires. Boss drops that push past multiple thresholds in one frame are handled by a `while` loop — the player can level up twice at once.

**HUD (top-right):** `LV N` label and a 180×8 px amber progress bar anchored to `(W − 14, 14)`. Bar brightens to gold for 0.9 s on level-up (`state._levelUpFlash`), then decays in realtime. Level and XP reset to `level: 1, xp: 0` on new-game; no cross-run persistence.

Config: `LOOT_DEFS.essence` in `src/config/loot.js` (xpPerPickup, xpPerLevel, dropCount per enemy tier). State fields: `state.xp`, `state.level`, `state.xpToNext`, `state._levelUpFlash`.

## Enemies

All enemies are rendered as segmented worms/crawlers using 2.5D shaded canvas primitives. Each type has a distinct silhouette and color scheme; no sprites yet.

| Display Name | ID | HP | Damage | Speed | Visual |
|---|---|---:|---:|---:|---|
| Worm Hatchling | `raider` | 30 | 10 | 48 | 4-segment brown worm, red dot eyes |
| Dart Worm | `runner` | 22 | 8 | 105 | 3-segment elongated amber worm, pointed snout, speed stripes |
| Husk Crawler | `ghoul` | 50 | 14 | 58 | 5-segment fat grub, sickly green, tiny legs on each segment |
| Burrow Brute | `mutant` | 90 | 22 | 32 | 4-segment dark-green armored worm with forward claws |
| Phase Worm | `blinker` | 45 | 18 | 38 | 3-segment purple ghost worm, glowing eyes, ethereal tendrils |
| Brood Warden | `miniboss` | 600 | 32 | 40 | 5-segment red-brown boss worm with horns and armor ridges |
| Elder Worm | `bigboss` | 2000 | 48 | 28 | 6-segment colossal green worm, open maw with teeth, bioluminescent spines |

All types animate with sinusoidal lateral body wobble keyed to `walkCycle`. Drawing rotates to `facing` angle; +X = forward, segments extend in −X direction.

Enemy entry by wave:

- Wave 1: worm hatchlings.
- Wave 2: husk crawlers and dart worms enter.
- Wave 3: phase worms enter.
- Wave 4: burrow brutes enter.
- Every 4th wave: miniboss.
- Every 9th wave: bigboss takes priority over miniboss.

## Difficulty Modes

Five options on the difficulty screen:

| ID | Label | Notes |
|---|---|---|
| `cavity-cadet` | Cavity Cadet | Fewer/weaker enemies, generous loot |
| `brood-hunter` | Brood Hunter | Balanced, intended experience |
| `crack-knight` | The Crack Knight | Harder enemies, scarcer loot |
| `rear-admiral` | Rear Admiral | Brutal, multiple bosses per wave |
| `dev-mode` | Dev Mode | Starts directly at wave 21; all enemy types + both bosses from the first spawn tick; single wave then extraction |
| `ability-test` | Ability Test | Superboost charge always full; enemies spawn 220–350 px from hero centroid; fast spawn rate; accessible via dev tools → ABILITY TESTING |

Dev mode sets `devWaves: [21]` in `difficulty.js`. `newGame()` detects `devWaves` and initialises `state.wave` to the first entry (21), recalculates spawn interval for that wave, and immediately spawns the configured bosses (1 miniboss + 1 bigboss). All regular enemy types are available because the spawn table gates by wave number. After the 22 s wave timer the game clears to allWavesCleared and the extraction phase begins.

## UI

- **HOW TO PLAY button**: small button at bottom-right during gameplay. Clicking it toggles a controls reference panel. Clicking anywhere else closes it.
- Controls panel is hidden by default; wired in `main.js` after `initMenu()`.

### Text Readability System

All Phaser scene text uses **Georgia serif** as the primary typeface (replaced Courier New project-wide for legibility). Standard sizes: 13px body, 15px buttons, 20px section headers, 42px main title. All text has `stroke: '#000000', strokeThickness: 2–3` for contrast against varied backgrounds.

- **`src/phaser/ui/widgets.js`**: shared `txt()` default is now Georgia 13px with strokeThickness 2. Button labels 15px, slider labels 11px, toggle labels 12px.
- **Canvas 2D HUD** (`src/render/hud.js`): uses a `_txt(ctx, text, x, y, color, font)` double-draw helper (offset dark copy + color copy) instead of shadowBlur (banned for performance). Hero names 13px Georgia bold, HP/cooldown labels 10–12px Georgia, buff pills 9px Georgia.
- **`shadowBlur` is banned project-wide** — expensive software blur. Drop-shadow always uses the double-draw technique.

## World And Rendering

- Static screen-space arena, no camera and no world-coordinate layer yet.
- Canvas size is approximately 97% of the browser window.
- Bottom HUD panel reserves 96 px plus padding (expanded to fit active skill slot rows).
- Terrain is procedural decoration: debris, cracks, dust, soil variation, blood stains, vignette, and warm tint.
- Characters, enemies, loot, weapons, particles, telegraphs, and HUD are all Canvas 2D primitives.
- **Pseudo-3D / 2.5D System**: Entities feature a `z` (height) axis and pseudo-gravity. They draw a decoupled ground shadow at `y`, and their main sprite is drawn at `y - z` to give them verticality. Worms use radial gradients to give segments a tubular, 3D appearance.
- Asset injection is planned but not implemented yet. See `asset_injection_plan.md`.

## Audio

- The modular source has a first-pass Web Audio layer in `src/systems/audio.js`.
- Audio initializes after player interaction from the menu/pause controls to satisfy browser autoplay rules.
- The pause menu exposes master volume and mute controls backed by localStorage.
- Initial asset folders, `catalog.json`, and generated `manifest.json` exist under `public/assets/audio/`; run `npm run audio:manifest` after adding files.
- `src/systems/audio.js` loads `manifest.json`, randomly chooses loaded variants, applies per-event volume/pitch/cooldown settings, and follows fallback chains.
- Current manifest-driven SFX hooks cover character death, alien attack/hit/death, melee weapon attacks, thrown weapon launch/impact, spray impacts, boss ability/attack/death, abilities (blink/rage/lightning), loot pickups, and explosions.
- Music hooks exist for menu/game transitions and loop tracks while active. Browser autoplay rules mean menu music starts after the first player interaction, not before.
- **Synthetic fallback policy**: explosion and boss-spawn oscillators have been removed. If real audio files are absent for those events the game is silent. Other events (hit, shoot, loot, ability, death for heroes) still have synthetic fallbacks. Missing files never crash or block play.
- To add or replace sounds: drop files in the matching folder under `public/assets/audio/`, run `npm run audio:manifest`, done — no code change needed.
- Phase 6 still needs alien death variants, boss movement/slam cues, hero death cues per-character, and menu/UI sounds. See `audio_plan.md`.

## Current Architecture

Modular build (Phases 0–5 complete, Phase 6 Audio in progress). The game runs from `src/` via `npm run dev`. The legacy single-file `wasteland_survivors-v4.html` has been removed; the modular build is now the primary source.

Module layout:

```
src/
  main.js              # bootstraps canvas, state, game loop
  state.js             # createInitialState, reset helpers
  globals.js           # shared mutable references
  config/
    heroes.js          # HERO_DEFS
    enemies.js         # ENEMY_DEFS
    loot.js            # LOOT_DEFS (incl. bombDamage, bananaBombDamage)
    waves.js           # WAVE_DEFS
    assets.js          # asset registry shape
    abilities.js       # ABILITY_DEFS — single source for all abilities (icon, color, sound, maxCd, activate)
  systems/
    input.js           # mouse/keyboard handlers
    time.js            # activity-driven time flow
    combat.js          # hit resolution, knockback, explosions
    loot.js            # pickup, apply, expiry
    spawning.js        # wave and boss spawn logic
    world.js           # terrain generation
  entities/
    Unit.js            # survivor stats, movement, attack
    Enemy.js           # enemy AI, behaviors, drops
    Projectile.js      # thrown club
    ShotgunBullet.js   # shotgun bullet
    Loot.js            # pickup state and icon
  render/
    background.js      # terrain, debris, vignette
    units.js           # survivor drawing
    enemies.js         # enemy drawing
    loot.js            # loot icon drawing
    hud.js             # bottom HUD panel
    effects.js         # particles, telegraphs
  utils/
    math.js            # rand, randInt, dist2, clamp
    canvas.js          # canvas helpers
```

Next planned phases: finish Audio (Phase 6), Lore/Cutscenes (Phase 7), Asset Registry + Enemy Visual Overhaul (Phase 8), World Exploration + Impassable Blocks (Phase 9). See `docs/planning/plan.md` for full details.
