# SDD-00: Architecture Overview

## Purpose

Defines the global constraints, system boundaries, and non-negotiable design decisions that every
other SDD builds on. Read this before implementing any system. Feed this document alongside any
other SDD when prompting an LLM.

---

## Game Identity

P-RAY is a top-down 2D squad survival tactics game. The player commands three heroes against
escalating waves of alien worm/snake enemies. The defining mechanical rule:

> **Time only advances while at least one hero is moving.**

This makes positioning a first-class concern: standing still = world frozen. Every system must
respect this contract.

---

## Global Constraints

| # | Constraint | Rationale |
|---|------------|-----------|
| G1 | All game simulation uses `GameTime.delta`, never raw `delta` | Single freeze/flow control point |
| G2 | No `Engine.time_scale` manipulation | Breaks physics, audio, and future networking |
| G3 | Weapons are `Resource` objects, not hero subclasses | Heroes can swap weapons at runtime |
| G4 | Difficulty is a single swappable `DifficultyResource` | Balance changes require no code edits |
| G5 | All entities live in world-space coordinates | Required for scrolling map; no screen-space shortcuts |
| G6 | Input is separated from entity logic | Multiplayer readiness; `HeroInput` → `Hero` via method call |
| G7 | `EventBus` autoload for cross-system signals | Avoids tight coupling between unrelated systems |
| G8 | No default Godot placeholder art in shipped code | Sprite nodes exist but textures assigned at runtime from asset registry |
| G9 | Every system is pausable via `GameTime` freeze, not `SceneTree.paused` | Allows HUD and menus to remain active |

---

## Autoloads (Singletons)

These four autoloads are the shared infrastructure. All other systems depend on them.

```
GameTime      — controls game_delta, freeze state, speed multiplier
EventBus      — typed signal hub for decoupled communication
GameState     — wave number, phase, hero roster, score
DifficultyConfig — active difficulty resource, exposes balance values
```

### GameTime

```gdscript
# autoload: res://autoloads/GameTime.gd
class_name GameTime extends Node

signal flow_changed(is_flowing: bool)

const SPEED_STEPS := [1.0, 2.0, 3.0]

var speed_index: int = 0
var manual_pause: bool = false
var is_game_over: bool = false

# True when at least one hero is currently moving
var heroes_moving: bool = false

# The delta every game system consumes this frame
var delta: float = 0.0

func _process(raw_delta: float) -> void:
    var flowing := _compute_flowing()
    delta = raw_delta * SPEED_STEPS[speed_index] if flowing else 0.0

func _compute_flowing() -> bool:
    if is_game_over:
        return false
    if manual_pause:
        return false
    return heroes_moving

func set_speed(index: int) -> void:
    speed_index = clamp(index, 0, SPEED_STEPS.size() - 1)

func toggle_pause() -> void:
    manual_pause = !manual_pause
    flow_changed.emit(_compute_flowing())

func notify_hero_moving(any_moving: bool) -> void:
    if heroes_moving != any_moving:
        heroes_moving = any_moving
        flow_changed.emit(_compute_flowing())
```

### EventBus

```gdscript
# autoload: res://autoloads/EventBus.gd
class_name EventBus extends Node

# Hero events
signal hero_died(hero: Hero)
signal hero_boarded_helicopter(hero: Hero)
signal hero_picked_up_loot(hero: Hero, loot_id: StringName)

# Enemy events
signal enemy_died(enemy: Enemy, position: Vector2)
signal wave_cleared(wave_number: int)
signal all_waves_cleared()

# Game phase events
signal game_over()
signal victory()
signal helicopter_arrived()

# Weapon events
signal weapon_swap_requested(from_hero: Hero, to_hero: Hero)
```

### GameState

```gdscript
# autoload: res://autoloads/GameState.gd
class_name GameState extends Node

enum Phase { MENU, PLAYING, EXTRACTION, VICTORY, GAME_OVER }

var phase: Phase = Phase.MENU
var wave: int = 0
var enemies_alive: int = 0
var heroes: Array[Hero] = []
```

### DifficultyConfig

```gdscript
# autoload: res://autoloads/DifficultyConfig.gd
class_name DifficultyConfig extends Node

var data: DifficultyResource

func load_difficulty(id: StringName) -> void:
    data = load("res://data/difficulty/%s.tres" % id)
```

---

## Scene Tree Topology

```
Main (Node)
├── GameWorld (Node2D)
│   ├── MapLayer (TileMapLayer)           # terrain tiles
│   ├── NavigationRegion2D               # baked navmesh for enemy AI
│   ├── SpawnZones (Node2D)              # marker nodes for spawn positions
│   ├── Containers (Node2D)
│   │   ├── Enemies (Node2D)
│   │   ├── Heroes (Node2D)
│   │   ├── Loot (Node2D)
│   │   └── Projectiles (Node2D)
│   └── WorldCamera (Camera2D)           # follows squad centroid
├── Systems (Node)                       # non-visual coordinators
│   ├── WaveSystem (Node)
│   ├── LootSystem (Node)
│   └── InputRouter (Node)
└── HUD (CanvasLayer)
    ├── HeroPanel (Control)
    ├── AbilityBar (Control)
    ├── WaveDisplay (Control)
    └── PauseMenu (Control)
```

---

## System Boundaries

| System | Owns | Does NOT own |
|--------|------|-------------|
| GameTime | delta computation, freeze/flow | Hero movement decisions |
| Hero | movement, attack, ability activation | Spawning, wave logic |
| Weapon | damage calc, attack animation trigger | Who holds it |
| Enemy | AI, pathfinding, attack | Spawning, loot drops |
| WaveSystem | spawn scheduling, wave progression | Enemy behavior |
| LootSystem | drop rolls, pickup detection | What pickups do (delegates to consumers) |
| HUD | display only | Game logic |

---

## Multiplayer Architecture Assumptions

The game is designed for **2–4 players** in a future co-op mode. From day one:

- Each `Hero` has an `authority_id: int` (defaults to `1` for single-player).
- Input handling checks `if multiplayer.get_unique_id() == authority_id` before processing.
- `GameTime` is server-authoritative; clients receive `delta` via RPC, not compute it locally.
- `WaveSystem` runs only on the server (`if not multiplayer.is_server(): return`).
- `EventBus` signals are emitted locally; a thin `NetworkRelay` node forwards relevant signals
  to peers via RPC (stub exists, no implementation required yet).

For single-player: `multiplayer.get_unique_id()` returns `1`, `authority_id` is `1`, all checks
pass, all code runs on the single instance.

---

## Non-Static Map Contract

The map scrolls; heroes travel through it. Required from day one even if the first playable build
uses a large static tile layout:

- All entity positions are **world-space `Vector2`**, never screen fractions.
- The `WorldCamera` node follows the squad centroid with a configurable lag.
- Enemy spawn zones are `Marker2D` nodes placed in world-space, activated by proximity to heroes.
- The `NavigationRegion2D` is rebaked when new map sections load (streaming stub exists).

---

## Asset Placeholder Policy

- Every `Sprite2D` is added to the scene tree.
- `texture` is `null` at scene save time.
- An `AssetRegistry` autoload (see `12_asset_pipeline.md`) assigns textures at `_ready()`.
- If a texture key is missing, the node renders as a colored rectangle via a `ColorRect` sibling
  that is visible only when `Sprite2D.texture == null`.
- This means the game is always playable even with zero art assets.

---

## Coding Standards for All SDDs

- `class_name` on every script that is referenced cross-system.
- Typed arrays: `Array[Hero]`, `Array[Enemy]`, etc.
- Signals typed: `signal foo(bar: Bar)`.
- `@export_group("Section")` to organize inspector properties.
- No magic strings for identifiers — use `StringName` constants or `enum`.
- Every public method has a one-line doc comment.
- `GameTime.delta` replaces `delta` in all `_process` and `_physics_process` overrides.
