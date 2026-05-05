# SDD-05: Ability System

## Purpose

Defines how hero abilities are stored, activated, displayed, and resolved. Abilities are
`AbilityResource` data objects; execution logic lives in `AbilityHandlers`. Each hero has one
ability; the system supports adding more via resource customization.

---

## Scene Structure

No standalone scene — ability logic lives in `Hero.gd` (dispatch) and `AbilityHandlers.gd`
(resolution). The HUD displays cooldown state; see SDD-10.

```
Hero (CharacterBody2D)
└── AbilityCooldownTimer (Timer)    ← one-shot; .wait_time = ability.cooldown
```

---

## AbilityResource Schema

See SDD-01. Key fields:

| Field | Purpose |
|-------|---------|
| `id` | StringName key (e.g. `"blink"`) |
| `effect_type` | StringName matched in `AbilityHandlers` dispatch |
| `cooldown` | Seconds before reuse |
| `duration` | Seconds the effect lasts (0 = instant) |
| `range` | Maximum distance for targeting or effect reach |
| `damage` | Damage applied per target hit |
| `stun_duration` | Seconds a hit target is stunned |
| `chain_count` | Number of additional targets (chain lightning) |
| `chain_radius` | Search radius for each chain jump |
| `damage_multiplier` | Applied to hero's damage during buff |
| `attack_rate_multiplier` | Applied to hero's attack rate during buff |

---

## Ability Definitions

### blink.tres
```
id: "blink"
display_name: "Blink"
effect_type: "blink"
cooldown: 6.0
duration: 0.0       # instant
range: 240.0
```

### rage.tres
```
id: "rage"
display_name: "Rage"
effect_type: "rage"
cooldown: 12.0
duration: 5.0
damage_multiplier: 2.0
attack_rate_multiplier: 0.4
```

### chain_lightning.tres
```
id: "chain_lightning"
display_name: "Chain Lightning"
effect_type: "chain_lightning"
cooldown: 8.0
duration: 0.0       # instant application, stun has its own duration
damage: 30.0
stun_duration: 1.8
chain_count: 4
chain_radius: 200.0
```

---

## Activation Flow

```
Player presses ability key
    → HeroInputController._activate_ability_for_index(i)
        → Hero.activate_ability()
            → check AbilityCooldownTimer.is_stopped()
            → AbilityHandlers.dispatch(hero, ability)
            → start AbilityCooldownTimer
            → emit ability_activated signal
                → HUD updates cooldown display
```

---

## AbilityHandlers (Full Implementation)

```gdscript
# res://scripts/AbilityHandlers.gd
class_name AbilityHandlers

# --- Dispatch ---

static func dispatch(hero: Hero, ability: AbilityResource) -> void:
    match ability.effect_type:
        &"blink":           blink(hero, ability)
        &"rage":            rage(hero, ability)
        &"chain_lightning": chain_lightning(hero, ability)
        _:
            push_warning("AbilityHandlers: unknown effect_type '%s'" % ability.effect_type)

# --- Blink ---
# Teleport hero up to ability.range pixels toward mouse cursor.

static func blink(hero: Hero, ability: AbilityResource) -> void:
    var mouse_world: Vector2 = hero.get_global_mouse_position()
    var to_mouse := mouse_world - hero.global_position
    var dist := min(to_mouse.length(), ability.range)
    if dist < 1.0:
        return
    var destination: Vector2 = hero.global_position + to_mouse.normalized() * dist
    # TODO: validate destination is walkable via NavigationServer2D query
    hero.global_position = destination
    _spawn_vfx(hero, &"blink_fx", destination)

# --- Rage ---
# Apply a HeroBuff that doubles damage and multiplies attack rate.

static func rage(hero: Hero, ability: AbilityResource) -> void:
    var buff := HeroBuff.make(
        ability.duration,
        ability.damage_multiplier,
        ability.attack_rate_multiplier
    )
    hero.apply_buff(buff)
    _spawn_vfx(hero, &"rage_fx", hero.global_position)

# --- Chain Lightning ---
# Hits up to chain_count+1 unique enemies, chaining to nearest unfrozen targets.

static func chain_lightning(hero: Hero, ability: AbilityResource) -> void:
    var origin := hero.global_position
    var first_targets := _enemies_in_radius(origin, ability.range)
    if first_targets.is_empty():
        return

    var hit: Array[Enemy] = []
    var current: Enemy = first_targets[0]

    for _i in range(ability.chain_count + 1):
        if not is_instance_valid(current) or not current.is_alive():
            break
        current.take_damage(ability.damage, Vector2.ZERO)
        current.apply_stun(ability.stun_duration)
        hit.append(current)
        _spawn_vfx_at(&"lightning_arc_fx", current.global_position)
        current = _nearest_unchained(current.global_position, ability.chain_radius, hit)
        if current == null:
            break

# --- Helpers ---

static func _enemies_in_radius(center: Vector2, radius: float) -> Array[Enemy]:
    var result: Array[Enemy] = []
    var enemies_node: Node2D = _get_enemies_node()
    if enemies_node == null:
        return result
    for child in enemies_node.get_children():
        if child is Enemy and child.is_alive():
            if center.distance_to(child.global_position) <= radius:
                result.append(child)
    result.sort_custom(func(a, b):
        return center.distance_to(a.global_position) < center.distance_to(b.global_position))
    return result

static func _nearest_unchained(from: Vector2, radius: float,
                                 exclude: Array[Enemy]) -> Enemy:
    var best: Enemy = null
    var best_dist: float = INF
    var enemies_node: Node2D = _get_enemies_node()
    if enemies_node == null:
        return null
    for child in enemies_node.get_children():
        if child is Enemy and child.is_alive() and not exclude.has(child):
            var d := from.distance_to(child.global_position)
            if d <= radius and d < best_dist:
                best_dist = d
                best = child
    return best

static func _get_enemies_node() -> Node2D:
    var scene := Engine.get_main_loop().current_scene
    if scene == null:
        return null
    return scene.find_child("Enemies", true, false) as Node2D

static func _spawn_vfx(hero: Hero, vfx_key: StringName, pos: Vector2) -> void:
    # VFX system stub — replace with particle scene instantiation in Phase 2.
    pass

static func _spawn_vfx_at(vfx_key: StringName, pos: Vector2) -> void:
    pass
```

---

## Cooldown Tracking in Hero

```gdscript
# Relevant section of Hero.gd

@onready var ability_timer: Timer = $AbilityCooldownTimer

func activate_ability() -> void:
    if _current_ability == null:
        return
    if not ability_timer.is_stopped():
        return   # still on cooldown
    AbilityHandlers.dispatch(self, _current_ability)
    ability_timer.wait_time = _current_ability.cooldown
    ability_timer.one_shot = true
    ability_timer.start()
    ability_activated.emit(_current_ability)

## Returns 0.0 when ready, positive seconds when on cooldown.
func get_ability_cooldown_remaining() -> float:
    return ability_timer.time_left

## Returns 0..1, useful for HUD progress display.
func get_ability_cooldown_fraction() -> float:
    if _current_ability == null:
        return 0.0
    if ability_timer.is_stopped():
        return 0.0
    return ability_timer.time_left / _current_ability.cooldown
```

---

## Cooldown Reduction (Stimpack Loot)

When a hero picks up a stimpack, all ability cooldowns are reduced by a fixed amount:

```gdscript
## Call from LootSystem when stimpack is applied to this hero.
func reduce_ability_cooldown(seconds: float) -> void:
    if not ability_timer.is_stopped():
        var new_time := max(0.0, ability_timer.time_left - seconds)
        ability_timer.start(new_time)
```

---

## Stun on Enemies

Abilities that stun call `enemy.apply_stun(duration)`. Stun is an enemy-side state that freezes
the enemy's AI and movement for the given duration (in game-time seconds):

```gdscript
# Inside Enemy.gd — relevant section
var _stun_timer: float = 0.0

func apply_stun(duration: float) -> void:
    _stun_timer = max(_stun_timer, duration)   # don't reduce an existing longer stun

func _process(_raw_delta: float) -> void:
    var dt := GameTime.delta
    if dt == 0.0:
        return
    if _stun_timer > 0.0:
        _stun_timer -= dt
        return   # stunned: skip AI and movement
    _process_ai(dt)
```

---

## Customization System (Future: Character Builder)

The ability system is already customizable: swap `HeroResource.ability` to any `AbilityResource`
file. To extend:

1. Add a new `AbilityResource .tres` file with a unique `effect_type`.
2. Add a new `static func` to `AbilityHandlers` with the matching name.
3. Add the `effect_type` string to the `match` dispatch block.

No code changes to `Hero.gd` or the HUD are needed — the HUD reads `ability.icon_key` and
`ability.display_name` from the resource.

---

## Signals Summary

| Signal | Emitter | When |
|--------|---------|------|
| `ability_activated(AbilityResource)` | Hero | ability triggered successfully |

HUD listens to this signal to start the cooldown animation and plays a sound via EventBus.

---

## Dependencies

- `GameTime` — stun processing uses `GameTime.delta`
- `HeroBuff` — `rage` effect creates a buff
- `Hero.apply_buff()` — called by `AbilityHandlers.rage()`
- `Enemy.apply_stun()` — called by `AbilityHandlers.chain_lightning()`

---

## LLM Prompt

```
You are implementing the Ability System for P-RAY, a Godot 4.4 GDScript game.

Heroes have one ability each, defined by an AbilityResource data file. Execution logic lives
in AbilityHandlers (static methods), not in Hero.gd.

Task:
1. Create the three AbilityResource .tres files (blink, rage, chain_lightning) with values in SDD-05.
2. Implement AbilityHandlers.gd in full (dispatch, blink, rage, chain_lightning, helpers).
3. Implement the cooldown section of Hero.gd:
   - activate_ability(), get_ability_cooldown_remaining(), get_ability_cooldown_fraction()
   - reduce_ability_cooldown() for stimpack
4. Add apply_stun(duration) to Enemy.gd stub and integrate into _process.
5. Wire Q/W/E keys in HeroInputController to all_heroes[0/1/2].activate_ability().

Rules:
- AbilityHandlers is a GDScript class with only static methods (no extends Node).
- blink must clamp travel to ability.range, not teleport past cursor.
- chain_lightning must not hit the same enemy twice.
- stun uses game-time delta so it doesn't tick while game is frozen.

[paste SDD-00, SDD-02, SDD-03, SDD-05 here]
```
