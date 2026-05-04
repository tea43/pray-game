# SDD-01: Project Setup

## Purpose

Defines the Godot 4.4 project structure, autoload registration, project settings, and folder
layout that every other system assumes exists. Implement this first — all other SDDs depend on it.

---

## Godot Project Settings

In `Project > Project Settings`:

| Setting | Value |
|---------|-------|
| Display / Window / Size / Viewport Width | 1920 |
| Display / Window / Size / Viewport Height | 1080 |
| Display / Window / Stretch / Mode | `canvas_items` |
| Display / Window / Stretch / Aspect | `keep` |
| Physics / 2D / Default Gravity | 0 (top-down, no gravity) |
| Rendering / 2D / Snap / Snap 2D Transforms | true |
| Input / Use Accumulated Input | false |
| Application / Run / Main Scene | `res://scenes/main/Main.tscn` |

### Input Map

Add these actions in `Project > Project Settings > Input Map`:

| Action | Default Key |
|--------|------------|
| `game_select` | Left Mouse Button |
| `game_move` | Right Mouse Button |
| `game_stop` | S |
| `hero_ability_1` | Q |
| `hero_ability_2` | W |
| `hero_ability_3` | E |
| `game_pause` | Space |
| `speed_up` | Equal (=) |
| `speed_down` | Minus (-) |
| `game_restart` | R |
| `weapon_swap` | Tab |

---

## Folder Structure

```
res://
├── autoloads/
│   ├── GameTime.gd
│   ├── EventBus.gd
│   ├── GameState.gd
│   ├── DifficultyConfig.gd
│   └── AssetRegistry.gd
├── data/
│   ├── difficulty/
│   │   ├── cavity_cadet.tres       # DifficultyResource
│   │   ├── brood_hunter.tres
│   │   ├── crack_knight.tres
│   │   ├── rear_admiral.tres
│   │   └── dev_mode.tres
│   ├── heroes/
│   │   ├── elliot.tres             # HeroResource
│   │   ├── dick.tres
│   │   └── habib.tres
│   ├── weapons/
│   │   ├── long_club.tres          # WeaponResource
│   │   ├── dual_clubs.tres
│   │   ├── thrown_club.tres
│   │   ├── spray_gun.tres
│   │   └── samurai_sword.tres
│   ├── abilities/
│   │   ├── blink.tres              # AbilityResource
│   │   ├── rage.tres
│   │   └── chain_lightning.tres
│   ├── enemies/
│   │   ├── raider.tres             # EnemyResource
│   │   ├── runner.tres
│   │   ├── ghoul.tres
│   │   ├── mutant.tres
│   │   ├── blinker.tres
│   │   ├── miniboss.tres
│   │   └── bigboss.tres
│   ├── loot/
│   │   ├── medkit.tres             # LootResource
│   │   ├── stimpack.tres
│   │   ├── bomb.tres
│   │   ├── banana_bomb.tres
│   │   ├── spray_gun_pickup.tres
│   │   └── samurai_sword_pickup.tres
│   └── waves/
│       └── wave_table.tres         # WaveTableResource
├── scenes/
│   ├── main/
│   │   └── Main.tscn
│   ├── world/
│   │   └── GameWorld.tscn
│   ├── heroes/
│   │   ├── Hero.tscn               # base scene, instanced per hero
│   │   └── HeroInput.tscn
│   ├── enemies/
│   │   └── Enemy.tscn              # base scene, configured per type
│   ├── loot/
│   │   └── LootPickup.tscn
│   ├── projectiles/
│   │   ├── ThrownClub.tscn
│   │   └── SprayBullet.tscn
│   ├── systems/
│   │   ├── WaveSystem.tscn
│   │   └── LootSystem.tscn
│   └── hud/
│       ├── HUD.tscn
│       ├── HeroPanel.tscn
│       ├── AbilityBar.tscn
│       └── WaveDisplay.tscn
├── scripts/
│   ├── resources/                  # Resource class definitions
│   │   ├── DifficultyResource.gd
│   │   ├── HeroResource.gd
│   │   ├── WeaponResource.gd
│   │   ├── AbilityResource.gd
│   │   ├── EnemyResource.gd
│   │   ├── LootResource.gd
│   │   └── WaveTableResource.gd
│   └── utils/
│       ├── MathUtils.gd
│       └── GeomUtils.gd
├── assets/
│   ├── sprites/
│   │   ├── heroes/
│   │   ├── enemies/
│   │   ├── weapons/
│   │   ├── loot/
│   │   └── ui/
│   ├── audio/
│   │   ├── sfx/
│   │   └── music/
│   └── tiles/
└── export_presets.cfg
```

---

## Autoload Registration

In `Project > Project Settings > Autoload`, register in this exact order (order matters for
dependency resolution):

| Name | Path | Enabled |
|------|------|---------|
| `GameTime` | `res://autoloads/GameTime.gd` | true |
| `EventBus` | `res://autoloads/EventBus.gd` | true |
| `GameState` | `res://autoloads/GameState.gd` | true |
| `DifficultyConfig` | `res://autoloads/DifficultyConfig.gd` | true |
| `AssetRegistry` | `res://autoloads/AssetRegistry.gd` | true |

---

## Resource Base Definitions

These scripts define the data schemas. They contain no logic — just typed exported fields.
The LLM implementing this step creates the `.gd` files; `.tres` files are filled in per
SDD-07 (wave/difficulty) and the relevant system SDDs.

### DifficultyResource

```gdscript
# res://scripts/resources/DifficultyResource.gd
class_name DifficultyResource extends Resource

@export_group("Identity")
@export var id: StringName
@export var display_name: String

@export_group("Wave Scaling")
@export var total_waves: int = 21
@export var wave_duration_sec: float = 22.0
@export var base_spawn_interval: float = 1.4
@export var spawn_interval_decay: float = 0.84   # multiplied each wave
@export var min_spawn_interval: float = 0.30
@export var dev_start_wave: int = 0              # 0 = normal start; 21 = dev mode

@export_group("Enemy Scaling")
@export var enemy_hp_multiplier: float = 1.0
@export var enemy_damage_multiplier: float = 1.0
@export var enemy_speed_multiplier: float = 1.0
@export var boss_per_wave_extra: int = 0         # rear admiral stacks extra bosses

@export_group("Loot")
@export var loot_drop_multiplier: float = 1.0    # scales drop chances
@export var special_loot_multiplier: float = 1.0
```

### HeroResource

```gdscript
# res://scripts/resources/HeroResource.gd
class_name HeroResource extends Resource

@export_group("Identity")
@export var id: StringName
@export var display_name: String
@export var portrait_key: StringName            # key into AssetRegistry

@export_group("Stats")
@export var max_hp: float = 100.0
@export var move_speed: float = 120.0
@export var base_attack_range: float = 56.0
@export var base_attack_rate: float = 0.55      # seconds between attacks

@export_group("Loadout")
@export var default_weapon: WeaponResource
@export var ability: AbilityResource
```

### WeaponResource

```gdscript
# res://scripts/resources/WeaponResource.gd
class_name WeaponResource extends Resource

@export_group("Identity")
@export var id: StringName
@export var display_name: String
@export var sprite_key: StringName

@export_group("Combat")
@export var damage: float = 20.0
@export var range: float = 56.0
@export var attack_rate_multiplier: float = 1.0  # applied on top of hero base rate
@export var knockback_force: float = 80.0
@export var aoe_radius: float = 0.0             # 0 = single target
@export var aoe_angle_deg: float = 0.0          # 0 = point, >0 = cone

@export_group("Projectile")
@export var is_projectile: bool = false
@export var projectile_scene: PackedScene        # null for melee
@export var projectile_speed: float = 0.0

@export_group("Temporary Weapon")
@export var is_temporary: bool = false
@export var duration: float = 0.0

@export_group("Special Behaviour")
@export var bullet_count: int = 1               # spray gun = 5
@export var cone_spread_deg: float = 0.0
```

### AbilityResource

```gdscript
# res://scripts/resources/AbilityResource.gd
class_name AbilityResource extends Resource

@export_group("Identity")
@export var id: StringName
@export var display_name: String
@export var icon_key: StringName

@export_group("Timing")
@export var cooldown: float = 6.0
@export var duration: float = 0.0              # 0 = instant

@export_group("Effect")
@export var effect_type: StringName            # "blink", "rage", "chain_lightning", custom
@export var range: float = 240.0
@export var damage: float = 0.0
@export var stun_duration: float = 0.0
@export var chain_count: int = 0
@export var chain_radius: float = 0.0
@export var damage_multiplier: float = 1.0
@export var attack_rate_multiplier: float = 1.0
```

### EnemyResource

```gdscript
# res://scripts/resources/EnemyResource.gd
class_name EnemyResource extends Resource

@export_group("Identity")
@export var id: StringName
@export var display_name: String
@export var sprite_key: StringName
@export var wave_unlock: int = 1               # first wave this type can appear

@export_group("Stats")
@export var max_hp: float = 30.0
@export var damage: float = 10.0
@export var move_speed: float = 48.0
@export var attack_range: float = 32.0
@export var attack_rate: float = 1.0

@export_group("Drop Table")
@export var drop_chance: float = 0.45
@export var guaranteed_drop: LootResource      # null = random
@export var drop_bundle: Array[LootResource]   # for bosses
```

### LootResource

```gdscript
# res://scripts/resources/LootResource.gd
class_name LootResource extends Resource

@export_group("Identity")
@export var id: StringName
@export var display_name: String
@export var icon_key: StringName

@export_group("Effect")
@export var effect_type: StringName            # "heal", "buff", "weapon", "explosion"
@export var heal_amount: float = 0.0
@export var weapon_grant: WeaponResource       # if effect_type == "weapon"
@export var explosion_radius: float = 0.0
@export var buff_duration: float = 0.0
@export var cooldown_reduction: float = 0.0
```

---

## Main Scene Bootstrap

```gdscript
# res://scenes/main/Main.gd
class_name Main extends Node

@export var difficulty_id: StringName = &"brood_hunter"

@onready var game_world: Node2D = $GameWorld
@onready var hud: CanvasLayer = $HUD

func _ready() -> void:
    DifficultyConfig.load_difficulty(difficulty_id)
    _connect_event_bus()

func _connect_event_bus() -> void:
    EventBus.game_over.connect(_on_game_over)
    EventBus.victory.connect(_on_victory)

func _on_game_over() -> void:
    hud.show_game_over()

func _on_victory() -> void:
    hud.show_victory()

func _input(event: InputEvent) -> void:
    if event.is_action_pressed(&"game_restart"):
        get_tree().reload_current_scene()
```

---

## LLM Prompt

```
You are implementing a Godot 4.4 GDScript project called "P-RAY: The Game".

Task: Set up the project from scratch.

1. Create the folder structure exactly as specified in SDD-01 (pasted below).
2. Create all five autoload scripts (GameTime, EventBus, GameState, DifficultyConfig,
   AssetRegistry) with the full implementations shown in SDD-00 and SDD-01.
3. Create all Resource class definition scripts under res://scripts/resources/ using the
   @export field layouts shown. These are data containers — no logic.
4. Create the Main scene (Main.tscn + Main.gd) with the bootstrap shown.
5. Register autoloads in project.godot in the correct order.
6. Set all Project Settings as listed in SDD-01.
7. Create all Input Map actions.

Rules:
- All scripts use class_name and typed GDScript.
- No placeholder logic — stubs are fine but must compile.
- Do not add any nodes or logic not described in the SDDs.

[paste SDD-00 and SDD-01 here]
```
