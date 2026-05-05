# SDD-07: Wave System & Difficulty

## Purpose

Controls the escalating enemy spawn sequence: wave timing, enemy type selection, boss scheduling,
and the extraction phase after all waves clear. Difficulty is a single swappable
`DifficultyResource` file — changing balance requires no code edits.

---

## Scene Structure

```
Systems (Node)
└── WaveSystem (Node)               ← script: WaveSystem.gd
    ├── WaveTimer (Timer)           ← counts down wave_duration_sec in game-time
    └── SpawnTimer (Timer)          ← fires per-enemy spawn interval
```

`WaveSystem` runs only on the authority (server in multiplayer, local in single-player).

---

## Wave Rules

1. Waves advance every `difficulty.wave_duration_sec` seconds (default 22s, game-time).
2. Spawn interval starts at `difficulty.base_spawn_interval` and is multiplied by
   `difficulty.spawn_interval_decay` each wave, floored at `difficulty.min_spawn_interval`.
3. Total waves: `difficulty.total_waves` (default 21).
4. After the last wave completes and all enemies are dead, extraction begins (see SDD-09).
5. Miniboss spawns on every 4th wave; bigboss takes priority on every 9th wave.
6. In `rear_admiral` difficulty, `boss_per_wave_extra` additional minibosses spawn per boss wave.

---

## Spawn Table Logic

The wave table defines which enemy types are eligible to spawn each wave. A type becomes
available when `enemy.wave_unlock <= current_wave`. The `WaveSystem` builds a weighted
probability list each wave from eligible types.

### WaveTableResource

```gdscript
# res://scripts/resources/WaveTableResource.gd
class_name WaveTableResource extends Resource

# Array of EnemyResource in preferred spawn priority order.
# Weights are computed dynamically based on wave_unlock and difficulty.
@export var all_enemy_types: Array[EnemyResource] = []
@export var miniboss_type: EnemyResource
@export var bigboss_type: EnemyResource
```

---

## Difficulty Definitions

Five `.tres` files in `res://data/difficulty/`. All extend `DifficultyResource`.

### cavity_cadet.tres
```
id: "cavity_cadet"
display_name: "Cavity Cadet"
total_waves: 21
wave_duration_sec: 22.0
base_spawn_interval: 1.8
spawn_interval_decay: 0.87
min_spawn_interval: 0.40
enemy_hp_multiplier: 0.75
enemy_damage_multiplier: 0.75
enemy_speed_multiplier: 0.9
boss_per_wave_extra: 0
loot_drop_multiplier: 1.4
special_loot_multiplier: 1.2
```

### brood_hunter.tres
```
id: "brood_hunter"
display_name: "Brood Hunter"
total_waves: 21
wave_duration_sec: 22.0
base_spawn_interval: 1.4
spawn_interval_decay: 0.84
min_spawn_interval: 0.30
enemy_hp_multiplier: 1.0
enemy_damage_multiplier: 1.0
enemy_speed_multiplier: 1.0
boss_per_wave_extra: 0
loot_drop_multiplier: 1.0
special_loot_multiplier: 1.0
```

### crack_knight.tres
```
id: "crack_knight"
display_name: "The Crack Knight"
total_waves: 21
wave_duration_sec: 22.0
base_spawn_interval: 1.2
spawn_interval_decay: 0.82
min_spawn_interval: 0.25
enemy_hp_multiplier: 1.3
enemy_damage_multiplier: 1.25
enemy_speed_multiplier: 1.1
boss_per_wave_extra: 0
loot_drop_multiplier: 0.7
special_loot_multiplier: 0.6
```

### rear_admiral.tres
```
id: "rear_admiral"
display_name: "Rear Admiral"
total_waves: 21
wave_duration_sec: 22.0
base_spawn_interval: 1.0
spawn_interval_decay: 0.80
min_spawn_interval: 0.20
enemy_hp_multiplier: 1.6
enemy_damage_multiplier: 1.5
enemy_speed_multiplier: 1.2
boss_per_wave_extra: 1
loot_drop_multiplier: 0.5
special_loot_multiplier: 0.4
```

### dev_mode.tres
```
id: "dev_mode"
display_name: "Dev Mode"
total_waves: 21
wave_duration_sec: 22.0
base_spawn_interval: 1.4
spawn_interval_decay: 0.84
min_spawn_interval: 0.30
dev_start_wave: 21
enemy_hp_multiplier: 1.0
enemy_damage_multiplier: 1.0
enemy_speed_multiplier: 1.0
boss_per_wave_extra: 0
loot_drop_multiplier: 1.0
special_loot_multiplier: 1.0
```

---

## WaveSystem Implementation

```gdscript
# res://scenes/systems/WaveSystem.gd
class_name WaveSystem extends Node

signal wave_started(wave_number: int)
signal wave_ended(wave_number: int)
signal all_waves_cleared()

@onready var wave_timer: Timer = $WaveTimer
@onready var spawn_timer: Timer = $SpawnTimer

var _wave: int = 0
var _spawn_interval: float = 1.4
var _enemies_alive: int = 0
var _spawning_active: bool = false
var _all_cleared: bool = false

const WAVE_TABLE_PATH := "res://data/waves/wave_table.tres"
var _table: WaveTableResource

func _ready() -> void:
    if not multiplayer.is_server():
        return   # wave logic is server-authoritative
    _table = load(WAVE_TABLE_PATH)
    EventBus.enemy_died.connect(_on_enemy_died)
    wave_timer.timeout.connect(_on_wave_timer_timeout)
    spawn_timer.timeout.connect(_on_spawn_timer_timeout)
    _start_game()

func _start_game() -> void:
    var diff := DifficultyConfig.data
    _spawn_interval = diff.base_spawn_interval

    if diff.dev_start_wave > 0:
        _wave = diff.dev_start_wave - 1   # will be incremented in _advance_wave
    else:
        _wave = 0

    _advance_wave()

func _advance_wave() -> void:
    var diff := DifficultyConfig.data
    _wave += 1
    GameState.wave = _wave

    if _wave > diff.total_waves:
        return   # should not happen; all_waves_cleared fires on enemy count reaching 0

    wave_started.emit(_wave)
    EventBus.wave_started.emit(_wave)

    # Recalculate spawn interval
    var decay_steps := _wave - 1
    _spawn_interval = diff.base_spawn_interval
    for _i in range(decay_steps):
        _spawn_interval *= diff.spawn_interval_decay
    _spawn_interval = max(_spawn_interval, diff.min_spawn_interval)

    # Spawn boss if applicable
    _spawn_wave_bosses()

    # Start wave timer and spawn timer
    wave_timer.wait_time = diff.wave_duration_sec
    wave_timer.one_shot = true
    wave_timer.start()

    spawn_timer.wait_time = _spawn_interval
    spawn_timer.one_shot = false
    spawn_timer.start()

    _spawning_active = true

func _on_wave_timer_timeout() -> void:
    _spawning_active = false
    spawn_timer.stop()
    var diff := DifficultyConfig.data
    wave_ended.emit(_wave)

    if _wave >= diff.total_waves:
        # Check if any enemies remain
        if GameState.enemies_alive <= 0:
            _trigger_all_clear()
        # Otherwise wait for _on_enemy_died to trigger
    else:
        _advance_wave()

func _on_spawn_timer_timeout() -> void:
    if not _spawning_active:
        return
    _spawn_regular_enemy()

func _on_enemy_died(_enemy: Enemy, _pos: Vector2) -> void:
    GameState.enemies_alive = max(0, GameState.enemies_alive - 1)
    var diff := DifficultyConfig.data
    if _wave >= diff.total_waves and not _spawning_active:
        if GameState.enemies_alive <= 0:
            _trigger_all_clear()

func _trigger_all_clear() -> void:
    if _all_cleared:
        return
    _all_cleared = true
    all_waves_cleared.emit()
    EventBus.all_waves_cleared.emit()

# --- Spawning ---

func _spawn_wave_bosses() -> void:
    var diff := DifficultyConfig.data
    var boss_res: EnemyResource

    if _wave % 9 == 0:
        boss_res = _table.bigboss_type
    elif _wave % 4 == 0:
        boss_res = _table.miniboss_type
    else:
        return

    _spawn_enemy(boss_res)

    # Rear admiral: extra minibosses
    for _i in range(diff.boss_per_wave_extra):
        _spawn_enemy(_table.miniboss_type)

func _spawn_regular_enemy() -> void:
    var eligible := _eligible_types()
    if eligible.is_empty():
        return
    var res := eligible[randi() % eligible.size()]
    _spawn_enemy(res)

func _eligible_types() -> Array[EnemyResource]:
    var result: Array[EnemyResource] = []
    for type in _table.all_enemy_types:
        if type.wave_unlock <= _wave:
            result.append(type)
    return result

func _spawn_enemy(res: EnemyResource) -> void:
    const ENEMY_SCENE := preload("res://scenes/enemies/Enemy.tscn")
    var enemy: Enemy = ENEMY_SCENE.instantiate()
    var enemies_node: Node2D = get_tree().current_scene.find_child("Enemies")
    enemies_node.add_child(enemy)
    enemy.global_position = _random_spawn_position()
    enemy.configure(res, DifficultyConfig.data)
    GameState.enemies_alive += 1

func _random_spawn_position() -> Vector2:
    # Spawns off-screen or at designated SpawnZone markers.
    # Prefer SpawnZone Marker2D nodes if present; fall back to viewport edge.
    var spawn_zones: Node2D = get_tree().current_scene.find_child("SpawnZones")
    if spawn_zones and spawn_zones.get_child_count() > 0:
        var zone: Node2D = spawn_zones.get_child(randi() % spawn_zones.get_child_count())
        return zone.global_position + Vector2(randf_range(-60, 60), randf_range(-60, 60))
    # Viewport-edge fallback
    var vp := get_viewport().get_visible_rect()
    var edge := randi() % 4
    match edge:
        0: return Vector2(randf_range(vp.position.x, vp.end.x), vp.position.y - 60)
        1: return Vector2(randf_range(vp.position.x, vp.end.x), vp.end.y + 60)
        2: return Vector2(vp.position.x - 60, randf_range(vp.position.y, vp.end.y))
        3: return Vector2(vp.end.x + 60, randf_range(vp.position.y, vp.end.y))
    return Vector2.ZERO

# --- GameTime integration ---
# WaveTimer and SpawnTimer are Godot Timers which run on engine time.
# We want them to only tick when GameTime is flowing.
# Solution: pause both timers when time is frozen; resume when flowing.

func _ready() -> void:
    # ... existing code ...
    GameTime.flow_changed.connect(_on_flow_changed)

func _on_flow_changed(is_flowing: bool) -> void:
    if is_flowing:
        if wave_timer.is_stopped() == false:
            wave_timer.paused = false
        if spawn_timer.is_stopped() == false:
            spawn_timer.paused = false
    else:
        wave_timer.paused = true
        spawn_timer.paused = true
```

> Important: Godot's `Timer.paused` property (added in 4.x) pauses the timer without resetting it.
> Set `wave_timer.process_callback = Timer.TIMER_PROCESS_IDLE` so it follows `_process` pause mode.
> Set `process_mode = Node.PROCESS_MODE_ALWAYS` on WaveSystem to ensure it receives the signal.

---

## Dev Mode

Dev mode starts at wave 21 directly. `DifficultyResource.dev_start_wave = 21` triggers
special start logic in `_start_game()`:

```gdscript
func _start_game() -> void:
    var diff := DifficultyConfig.data
    if diff.dev_start_wave > 0:
        _wave = diff.dev_start_wave - 1
        # Force-spawn one miniboss + one bigboss immediately
        _spawn_enemy(_table.miniboss_type)
        _spawn_enemy(_table.bigboss_type)
    _advance_wave()
```

---

## EventBus Additions

Add to `EventBus.gd`:
```gdscript
signal wave_started(wave_number: int)
signal wave_ended(wave_number: int)
```

---

## Hero Balance Values (Reference)

| Hero | HP | Move Speed | Base Attack Range | Base Attack Rate |
|------|----|------------|-------------------|-----------------|
| Elliot | 100 | 130 | 56 | 0.55s |
| Dick | 120 | 160 | 36 | 0.34s |
| Habib | 100 | 120 | 220 | 0.90s |

These go in `res://data/heroes/*.tres`. Dick has the fastest attack rate; Habib has the longest
range via ranged weapon.

---

## Dependencies

- `GameTime` — `flow_changed` signal to pause/resume timers
- `GameState` — `wave`, `enemies_alive` fields
- `DifficultyConfig` — scaling values
- `EventBus` — `enemy_died`, `all_waves_cleared`

---

## LLM Prompt

```
You are implementing the Wave System and Difficulty for P-RAY, a Godot 4.4 GDScript game.

Waves escalate every 22 game-time seconds. Enemy types unlock per wave. Bosses spawn on
4th and 9th wave multiples. After wave 21 and all enemies dead, extraction begins.

Task:
1. Create WaveSystem.tscn with WaveTimer and SpawnTimer children.
2. Implement WaveSystem.gd in full as shown in SDD-07.
3. Create all five DifficultyResource .tres files with values from SDD-07.
4. Create WaveTableResource .tres and populate it with the seven EnemyResource references.
5. Wire WaveSystem to pause/resume timers based on GameTime.flow_changed.
6. Create EventBus wave_started and wave_ended signals and emit them from WaveSystem.
7. Implement dev_mode fast-start: spawn miniboss + bigboss immediately, start at wave 21.

Rules:
- WaveSystem runs only on the server (multiplayer authority). Use multiplayer.is_server() guard.
- Timer.paused pauses without reset — use this, not stop()/start().
- _spawn_enemy uses preload() for ENEMY_SCENE; do not load() every call.
- Difficulty values are read from DifficultyConfig.data, never hardcoded in WaveSystem.

[paste SDD-00, SDD-02, SDD-06, SDD-07 here]
```
