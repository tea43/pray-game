# Current Game State

Source of truth: `wasteland_survivors-v4.html`.

This snapshot is for fast agent onboarding. It describes the current playable behavior without requiring a full read of the 3k+ line HTML file.

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
- Victory triggers after clearing wave 21.
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

Current internal IDs still use the legacy prototype names. Player-facing direction is alien worms and snake-like worm mutations.

| Future Display | Legacy ID | HP | Damage | Speed | Role |
|---|---|---:|---:|---:|---|
| Worm Hatchling | `raider` | 30 | 10 | 48 | Basic early melee worm. |
| Dart Worm | `runner` | 22 | 8 | 105 | Fast low-HP pressure worm. |
| Husk Crawler | `ghoul` | 50 | 14 | 58 | Midweight infected crawler. |
| Burrow Brute | `mutant` | 90 | 22 | 32 | Slow durable worm mutation with better drops. |
| Phase Worm | `blinker` | 45 | 18 | 38 | Teleports behind survivors after a telegraph. |
| Brood Warden | `miniboss` | 600 | 32 | 40 | Boss-class worm, knockback resistant. |
| Elder Worm | `bigboss` | 2000 | 48 | 28 | Major worm boss with slam shockwave attack. |

Enemy entry by wave:

- Wave 1: worm hatchlings.
- Wave 2: husk crawlers and dart worms enter.
- Wave 3: phase worms enter.
- Wave 4: burrow brutes enter.
- Every 4th wave: miniboss.
- Every 9th wave: bigboss takes priority over miniboss.

## World And Rendering

- Static screen-space arena, no camera and no world-coordinate layer yet.
- Canvas size is approximately 97% of the browser window.
- Bottom HUD panel reserves 74 px plus padding.
- Terrain is procedural decoration: debris, cracks, dust, soil variation, blood stains, vignette, and warm tint.
- Characters, enemies, loot, weapons, particles, telegraphs, and HUD are all Canvas 2D primitives.
- Asset injection is planned but not implemented yet. See `asset_injection_plan.md`.

## Audio

- The modular source has a first-pass Web Audio layer in `src/systems/audio.js`.
- Audio initializes after player interaction from the menu/pause controls to satisfy browser autoplay rules.
- The pause menu exposes master volume and mute controls backed by localStorage.
- Initial asset folders, `catalog.json`, and generated `manifest.json` exist under `public/assets/audio/`; run `npm run audio:manifest` after adding files.
- `src/systems/audio.js` loads `manifest.json`, randomly chooses loaded variants, applies per-event volume/pitch/cooldown settings, and follows fallback chains.
- Current manifest-driven SFX hooks cover character death, alien attack, melee weapon attacks, thrown weapon launch/impact, spray impacts, boss ability/attack/death, plus legacy synthetic fallbacks for effects that do not have files yet.
- Music hooks exist for menu/game transitions and loop tracks while active. Browser autoplay rules mean menu music starts after the first player interaction, not before.
- Missing files are intended to fail silently; synthetic SFX provide fallback coverage.
- Phase 6 still needs manifest-driven sound variants, richer menu/UI sounds, boss movement/attack/death cues, hero death cues, and golden/single-file parity decisions. See `audio_plan.md`.

## Current Architecture

Phase 4 modular build is complete. The game runs from `src/` via `npm run dev`. `wasteland_survivors-v4.html` is retained as the golden single-file reference.

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

Next planned phases: finish Audio (Phase 6), Lore/Cutscenes (Phase 7), Asset Registry + Enemy Visual Overhaul (Phase 8), World Exploration + Impassable Blocks (Phase 9). See `plan.md` for full details.
