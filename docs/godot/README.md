# P-RAY Godot Edition — Document Index

This folder contains Software Design Documents (SDDs) for implementing P-RAY: The Game in Godot 4
using GDScript. Each document is a self-contained implementation spec written for use with an LLM
(Claude, Codex, Gemini, etc.). Feed the relevant SDD(s) into a fresh context and ask the LLM to
implement the described system.

## Reading Order for a New Implementation

### Shared Foundation (both modes)

| Step | Doc | What it produces |
|------|-----|-----------------|
| 1 | `00_architecture.md` | High-level picture, constraint list, non-negotiables |
| 2 | `01_project_setup.md` | Folder layout, autoloads, project settings |
| 3 | `02_time_system.md` | The core movement-drives-time mechanic |
| 4 | `03_hero_system.md` | Hero entities, stats, input, movement |
| 5 | `04_weapon_system.md` | Weapon resources, equipping, swapping between heroes |
| 6 | `05_ability_system.md` | Ability resources, cooldowns, targeting |
| 7 | `06_enemy_system.md` | Enemy types (worms/snakes), AI base |
| 8 | `08_loot_system.md` | Drop tables, pickup entities, apply effects |
| 9 | `09_map_camera.md` | Non-static scrolling map, camera, world-space architecture |
| 10 | `10_hud_ui.md` | HUD layout, hero portraits, ability bar, wave info |
| 11 | `11_multiplayer.md` | Multiplayer-ready architecture assumptions and stubs |
| 12 | `12_asset_pipeline.md` | Sprite swap-in contract, placeholder policy |

### Arena Mode (wave survival)

| Step | Doc | What it produces |
|------|-----|-----------------|
| 13 | `13_game_modes.md` | Mode selection architecture, ArenaWorld scene |
| 14 | `07_wave_difficulty.md` | Wave sequencer, difficulty configs, boss logic |

### Story Mode (patrol/ambush missions)

| Step | Doc | What it produces |
|------|-----|-----------------|
| 13 | `13_game_modes.md` | Mode selection architecture, StoryWorld scene |
| 14 | `14_story_mode.md` | Hero discovery, squad inventory, patrol AI, cutscenes, 4-chapter outline |
| 15 | `15_procedural_map.md` | Designer-constrained terrain generation, biomes, landmarks |

## LLM Usage Pattern

Each SDD follows this structure:
- **Purpose** — what the system does and why it exists
- **Scene / Node Structure** — exact Godot scene tree to create
- **Resources** — `class_name` GDScript Resource definitions (data schemas)
- **Signals** — what this system emits and what it listens to
- **Public API** — methods other systems call on this one
- **Implementation Notes** — edge cases, gotchas, ordering constraints
- **Dependencies** — autoloads and sibling systems required
- **LLM Prompt** — paste this into a fresh chat to implement the system

When using the LLM Prompt section, always prepend the contents of `00_architecture.md` so the
model has the global constraints, then add the specific SDD.

## Key Design Decisions (read before any doc)

1. **Time is custom-delta, not `Engine.time_scale`** — all game systems receive `GameTime.delta`
   instead of raw `delta`. The `GameTime` autoload controls freeze/flow.
2. **Weapons are Resources, not hero subclasses** — any hero can hold any weapon; everything is
   swappable and squad-shared in Story Mode.
3. **Difficulty is a Resource file** — swap one file to change the entire balance curve.
4. **Map is world-space from day one** — no screen-space shortcuts; camera follows squad centroid.
5. **Multiplayer authority from day one** — input is separated from entity logic; RPCs are stubbed
   but the call sites exist.
6. **No default Godot sprites** — all visual nodes use `Sprite2D` with a placeholder texture until
   the asset pipeline delivers real sheets.
7. **Two modes share all entity systems** — Arena Mode adds wave spawning; Story Mode adds patrol
   AI, hero discovery, squad inventory, cutscenes, and procedural map generation.
8. **Designer-constrained generation** — Story Mode maps are authored as constraint sets
   (landmarks, paths, pod zones); the generator fills in details. No code changes between
   design iterations.

## Godot Version

Target: **Godot 4.6.2**. Use `TileMapLayer` (not deprecated `TileMap`). Use typed GDScript
with `class_name`, `@export`, and signal type hints throughout. If an LLM suggests an API
that does not compile, tell it "Godot 4.6.2" and ask it to correct.
