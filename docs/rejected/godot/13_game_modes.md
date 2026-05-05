# SDD-13: Game Modes Architecture

## Purpose

Defines the two game modes — **Arena Mode** and **Story Mode** — how they are selected, what
systems they share, and what each mode exclusively owns. All combat, time-flow, hero, weapon,
and loot systems are shared. Mode determines progression structure, map generation, and enemy
behavior model.

---

## Mode Overview

| | Arena Mode | Story Mode |
|--|-----------|------------|
| **Goal** | Survive 21 waves, extract | Travel A→B across designed missions |
| **Map** | Static tile arena | Semi-generated mission map |
| **Hero start** | All 3 heroes, full loadout | 1 hero, find others on map |
| **Abilities** | All abilities from start | Acquired through story events |
| **Enemy model** | Escalating wave spawns | Patrol/ambush pods |
| **Items** | Auto-pickup, hero-local | Squad shared inventory |
| **Time flow** | Movement-driven (all heroes) | Movement-driven (all found heroes) |
| **Camera** | Centroid of living heroes | Centroid of found heroes |
| **End condition** | All heroes board helicopter | Reach end zone of final mission |

Both modes use:
- `GameTime` (movement-drives-time)
- `Hero`, `Enemy`, `WeaponResource`, `AbilityResource`, `LootResource`
- Combat resolution, abilities, projectiles
- `WorldCamera` (squad centroid follow)
- Asset pipeline and HUD

---

## GameMode Enum and Selection

```gdscript
# In GameState autoload

enum GameMode { ARENA, STORY }

var current_mode: GameMode = GameMode.ARENA
var current_mission: MissionResource = null   # Story Mode only
var squad_inventory: SquadInventory = null    # Story Mode only; null in Arena
```

### Mode Selection Flow

```
MainMenu
├── Arena Mode → select difficulty → load ArenaWorld.tscn
└── Story Mode → load StoryMenu.tscn → select mission/chapter → load StoryWorld.tscn
```

Both `ArenaWorld` and `StoryWorld` are separate scene trees that share the same entity scenes
(Hero.tscn, Enemy.tscn, etc.) and all autoloads.

---

## Shared Systems (no changes needed)

| SDD | System | Shared as-is |
|-----|--------|-------------|
| SDD-02 | GameTime | Yes — time still movement-driven |
| SDD-03 | Hero entity | Yes — minor additions for discovery |
| SDD-04 | Weapon system | Yes — swap system works in both |
| SDD-05 | Ability system | Yes — acquisition is story-side |
| SDD-06 | Enemy entity | Extended for patrol states |
| SDD-08 | Loot system | Extended for squad inventory |
| SDD-12 | Asset pipeline | Yes |

---

## Mode-Exclusive Systems

### Arena Mode owns:
- `WaveSystem` (SDD-07) — wave timer, spawn interval, boss scheduling
- `ArenaSpawner` — viewport-edge random spawning
- Starting with all heroes and full loadout

### Story Mode owns:
- `MissionLoader` — reads `MissionResource`, initialises map gen
- `ProceduralMapGen` — terrain generation within designer constraints (SDD-15)
- `PatrolSystem` — enemy pod patrol/ambush AI layer (SDD-14)
- `HeroDiscovery` — finding and adding heroes mid-mission (SDD-14)
- `SquadInventory` — shared item pool, pass-between-heroes (SDD-14)
- `CutsceneSystem` — observation zones, dialogue, story triggers (SDD-14)
- `MissionProgression` — chapter order, save checkpoints (SDD-14)

---

## World Scene Roots

### ArenaWorld.tscn
```
ArenaWorld (Node2D)
├── MapLayer (TileMapLayer)      ← static arena tile layout
├── NavigationRegion2D
├── SpawnZones (Node2D)          ← viewport-edge markers
├── Containers (Node2D)
│   ├── Enemies, Heroes, Loot, Projectiles
└── Systems (Node)
    ├── WaveSystem
    ├── LootSystem
    ├── HeroInputController
    ├── WeaponSwapSystem
    ├── HeroMovementMonitor
    └── InputRouter
```

### StoryWorld.tscn
```
StoryWorld (Node2D)
├── MapManager (Node)            ← loads mission map sections
│   └── MapLayer (TileMapLayer)
├── NavigationRegion2D
├── Containers (Node2D)
│   ├── Enemies, Heroes, Loot, Projectiles
│   └── EnemyPods (Node2D)       ← pod containers, each a PatrolPod node
├── Systems (Node)
    ├── MissionLoader
    ├── PatrolSystem
    ├── HeroDiscovery
    ├── SquadInventory
    ├── CutsceneSystem
    ├── LootSystem               ← same as Arena, extended for squad inv
    ├── HeroInputController
    ├── WeaponSwapSystem
    ├── HeroMovementMonitor
    └── InputRouter
```

---

## GameTime in Story Mode

Story Mode starts with **one hero**. `HeroMovementMonitor` tracks all heroes in
`GameState.heroes`. Because the squad starts with one hero, time flows when that hero moves —
no special case. When hero 2 is found and added to `GameState.heroes`, the monitor picks them
up automatically next frame.

---

## Camera in Both Modes

`WorldCamera` already follows the centroid of `GameState.heroes`. In Story Mode this means:
- Start: camera centres on single hero.
- Hero 2 found: camera smoothly shifts toward new centroid.
- Hero 3 found: shifts again.

No code change to `WorldCamera` — the hero roster change is the only event needed.

---

## HUD Differences

| Element | Arena Mode | Story Mode |
|---------|-----------|------------|
| HeroCards | All 3 visible from start | Cards appear as heroes are found |
| Wave display | Yes | No — replaced by mission objective display |
| Inventory button | No | Yes — opens SquadInventory panel |
| Minimap | No | Yes — shows mission map with fog of war |

`HUD.gd` checks `GameState.current_mode` in `_ready()` to show/hide mode-specific elements.

---

## LLM Prompt

```
You are implementing the Game Mode architecture for P-RAY, a Godot 4.4 GDScript game.

The game has two modes: Arena (wave survival) and Story (patrol/ambush mission progression).
All core systems are shared. Mode determines world scene, progression, and enemy behavior.

Task:
1. Add GameMode enum and current_mode, current_mission, squad_inventory fields to GameState.gd.
2. Create ArenaWorld.tscn with the node tree from SDD-13.
3. Create StoryWorld.tscn stub with the node tree from SDD-13 (Systems can be empty nodes).
4. Create MainMenu.tscn with Arena Mode and Story Mode buttons.
5. Update HUD.gd to show/hide mode-specific elements based on GameState.current_mode.
6. Ensure WorldCamera works with a single-hero roster (centroid of one point = that point).

Rules:
- ArenaWorld and StoryWorld are separate root scenes — they do not inherit from each other.
- Shared entity scenes (Hero.tscn, Enemy.tscn) are instantiated in both with no modification.
- HeroMovementMonitor and WorldCamera work identically in both modes.

[paste SDD-00, SDD-13 here]
```
