# Current Game State

Source of truth: `wasteland_survivors-v4.html`.

This snapshot is for fast agent onboarding. It describes the current playable behavior without requiring a full read of the 3k+ line HTML file.

## Game Identity

Wasteland Survivors is a Canvas 2D survival tactics prototype. The player controls a squad of three survivors on a static wasteland arena. Time advances only while at least one survivor is moving, creating a hybrid of real-time action and pause-like tactical positioning.

## Controls

- Left click: select a survivor.
- Drag select: box-select survivors.
- Shift-click: add/remove a survivor from selection.
- Click portrait: select from the bottom ability panel.
- Right click: move selected survivors, or attack-move if clicking an enemy.
- `Q`: Elliot ability.
- `W`: Dikiy ability.
- `E`: Dick ability.
- `S`: stop selected survivors.
- `+`: increase forced time speed from x0 to x1, x2, then x3.
- `-`: decrease forced time speed from x3 to x2, x1, then x0.
- `SPACE`: force time speed to x0.
- `R`: restart after game over or victory.

## Core Loop

- Survive escalating enemy waves.
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
| Dikiy | Fast melee bruiser | 120 | 24 | 36 | 0.34s | `W` Rage |
| Dick | Ranged control attacker | 100 | 36 | 220 | 0.90s | `E` Chain Lightning |

## Base Weapons

- Elliot: `longClub`; melee hit with moderate knockback.
- Dikiy: `dualClubs`; alternating melee swings with high attack frequency.
- Dick: `thrownClub`; projectile attack that tracks a target, travels at 380 px/s, and expires after 280 px.

## Abilities

- Elliot, Blink: teleports up to 240 px toward the cursor. Cooldown: 6s.
- Dikiy, Rage: lasts 5s, doubles damage, speeds attacks by applying a 0.4x attack-rate multiplier, and increases knockback. Cooldown: 12s.
- Dick, Chain Lightning: chains to up to 4 enemies within 200 px per jump. Each hit deals 30 damage and stuns for 1.8s. Cooldown: 8s.

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

| Enemy | HP | Damage | Speed | Role |
|---|---:|---:|---:|---|
| Raider | 30 | 10 | 48 | Basic early melee enemy. |
| Runner | 22 | 8 | 105 | Fast low-HP pressure unit. |
| Ghoul | 50 | 14 | 58 | Midweight melee enemy. |
| Mutant | 90 | 22 | 32 | Slow durable hard enemy with better drops. |
| Blinker | 45 | 18 | 38 | Teleports behind survivors after a telegraph. |
| Miniboss, Warlord | 600 | 32 | 40 | Boss-class melee enemy, knockback resistant. |
| Bigboss, Behemoth | 2000 | 48 | 28 | Major boss with slam shockwave attack. |

Enemy entry by wave:

- Wave 1: raiders.
- Wave 2: ghouls and runners enter.
- Wave 3: blinkers enter.
- Wave 4: mutants enter.
- Every 4th wave: miniboss.
- Every 9th wave: bigboss takes priority over miniboss.

## World And Rendering

- Static screen-space arena, no camera and no world-coordinate layer yet.
- Canvas size is approximately 97% of the browser window.
- Bottom HUD panel reserves 74 px plus padding.
- Terrain is procedural decoration: debris, cracks, dust, soil variation, blood stains, vignette, and warm tint.
- Characters, enemies, loot, weapons, particles, telegraphs, and HUD are all Canvas 2D primitives.

## Current Architecture

The game is still one HTML file containing CSS, markup, JavaScript classes, state, input, update, and drawing.

Main code units:

- `Unit`: survivor stats, movement, attacks, abilities, drawing.
- `Projectile`: thrown club projectile.
- `SprayBullet`: spray gun projectile.
- `Loot`: pickup state and icon drawing.
- `Enemy`: enemy stats, AI, special behavior, death drops, drawing.
- Global `state`: all runtime arrays and counters.
- `newGame`, `spawnEnemy`, `spawnBoss`, `applyLoot`, explosion helpers.
- Input handlers for mouse/keyboard.
- `frame`: main update/draw loop.

## Immediate Technical Risk

The single-file structure is productive for prototyping but will become expensive for agents and humans as features grow. The safest next architectural move is not a direct split; it is a staged extraction where data definitions, pure helpers, and system boundaries are identified while `wasteland_survivors-v4.html` remains the golden playable file.
