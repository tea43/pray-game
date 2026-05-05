# Current Game State

Source of truth: `src/` (modular build). Run `npm run dev` to play.

This snapshot is for fast agent onboarding. It describes the current playable behaviour without requiring a full read of every source file.

## Game Identity

P-RAY: The Game is a Canvas 2D survival tactics prototype. The player controls a squad of three survivors in a post-apocalyptic alien-worm setting built around P-RAY, a rare almost magical grass/substance. Time advances only while at least one survivor is moving, creating a hybrid of real-time action and pause-like tactical positioning.

## Controls

- Left click: select a survivor.
- Drag select: box-select survivors.
- Shift-click: add/remove a survivor from selection.
- Click portrait: select from the bottom ability panel.
- Right click: move selected survivors, or attack-move if clicking an enemy.
- `Q`: Elliot ability.
- `W`: Dick ability.
- `E`: Habib ability.
- `S`: stop selected survivors.
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
- Victory screen fades in over ~3.5 s. If `public/assets/video/victory/victory.mp4` exists it plays muted as a background behind the overlay.
- Defeat triggers when all three survivors die.

## Heroes

| Hero | Base Role | HP | Attack | Range | Rate | Ability |
|---|---|---:|---:|---:|---:|---|
| Elliot | Flexible melee skirmisher | 100 | 32 | 56 | 0.55s | `Q` Blink |
| Dick | Fast melee bruiser | 120 | 24 | 36 | 0.34s | `W` Rage |
| Habib | Ranged control attacker | 100 | 36 | 220 | 0.90s | `E` Chain Lightning |

## Base Weapons

- Elliot: `longClub`; melee hit with moderate knockback.
- Dick: `dualClubs`; alternating melee swings with high attack frequency.
- Habib: `thrownClub`; boomerang-style projectile that flies toward the target, hits once if it collides, then returns to Habib and disappears when caught.

## Abilities

- Elliot, Blink: teleports up to 240 px toward the cursor. Cooldown: 6s.
- Dick, Rage: lasts 5s, doubles damage, speeds attacks by applying a 0.4x attack-rate multiplier, and increases knockback. Cooldown: 12s.
- Habib, Chain Lightning: chains to up to 4 enemies within 200 px per jump. Each hit deals 30 damage and stuns for 1.8s. Cooldown: 8s.

## Temporary Weapons

Temporary weapons replace or modify a survivor's normal attack after pickup.

- `spray_gun`: 15s duration. Fires 5 bullets in a cone at 480 px/s, each up to 320 px. Attack rate is multiplied by 0.25.
- `samurai_sword`: 20s duration. Wide 120-degree cleave within 80 px. Damage is multiplied by 2.2.

## Between-Wave Upgrades

At the end of each 22s wave, time pauses and `UpgradeScene` appears.
- The player drafts one upgrade per hero (Elliot, Dick, Habib) from 3 random choices drawn from their respective JSON upgrade pools (`public/assets/data/upgrades/`).
- Each pool has 10 entries; 3 are randomly sampled each wave, providing variety.
- Upgrades have rarities (Common, Rare, Epic, Legendary).
- Effects include stat multipliers (speed, base damage, ability cooldown) and special hooks (e.g., chain lightning damage multiplier, melee damage reflection).
- Upgrades are temporary and only last for the next wave, wiping out when the wave completes.
- The game logic pauses `GameScene` while `UpgradeScene` is active to prevent any processing during upgrade selection. Once the draft is locked in, `GameScene` resumes and advances to the next wave.

## Loot

| Loot | Effect |
|---|---|
| `medkit` | Heals the pickup survivor for up to 60 HP. |
| `stimpack` | Applies 5s rage-like buff and reduces ability cooldown by 2s. |
| `bomb` | Immediate area explosion, radius 280. |
| `banana_bomb` | Immediate larger explosion, radius 420, heavy knockback, and 2.5s stun on surviving enemies. |
| `spray_gun` | Grants temporary spray gun. |
| `samurai_sword` | Grants temporary sword cleave. |

Regular enemy drop distribution after a successful drop: 60% medkit, 35% stimpack, 5% bomb.

Drop chance by enemy:

- Raider: 45%
- Runner: 30%
- Ghoul: 65%
- Blinker: 80%
- Mutant: 100%
- Miniboss and bigboss: guaranteed custom bundles.

Hard regular enemies (`mutant`, `blinker`) also roll for specials: 2% banana bomb, otherwise 20% chance for spray gun or samurai sword.

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

Dev mode sets `devWaves: [21]` in `difficulty.js`. `newGame()` detects `devWaves` and initialises `state.wave` to the first entry (21), recalculates spawn interval for that wave, and immediately spawns the configured bosses (1 miniboss + 1 bigboss). All regular enemy types are available because the spawn table gates by wave number. After the 22 s wave timer the game clears to allWavesCleared and the extraction phase begins.

## UI

- **HOW TO PLAY button**: small button at bottom-right during gameplay. Clicking it toggles a controls reference panel. Clicking anywhere else closes it.
- Controls panel is hidden by default; wired in `main.js` after `initMenu()`.

## World And Rendering

- Static screen-space arena, no camera and no world-coordinate layer yet.
- Canvas size is approximately 97% of the browser window.
- Bottom HUD panel reserves 74 px plus padding.
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
    loot.js            # LOOT_DEFS
    waves.js           # WAVE_DEFS
    assets.js          # asset registry shape
  systems/
    input.js           # mouse/keyboard handlers
    time.js            # activity-driven time flow
    combat.js          # hit resolution, knockback, explosions
    abilities.js       # Blink, Rage, Chain Lightning
    loot.js            # pickup, apply, expiry
    spawning.js        # wave and boss spawn logic
    world.js           # terrain generation
  entities/
    Unit.js            # survivor stats, movement, attack
    Enemy.js           # enemy AI, behaviors, drops
    Projectile.js      # thrown club
    SprayBullet.js     # spray gun bullet
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
