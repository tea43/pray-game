# SDD-03: Hero System

## Purpose

Defines the Hero entity: movement, stats, attack, receiving damage, death, and the interface
through which abilities and weapons interact with the hero. Heroes are fully configurable via
`HeroResource` data files — no hardcoded per-hero logic except ability dispatch.

---

## Scene Structure

```
Hero (CharacterBody2D)              ← root; script: Hero.gd
├── Sprite2D                        ← body sprite (texture assigned by AssetRegistry)
├── WeaponPivot (Node2D)            ← rotates to face attack target
│   └── WeaponSprite (Sprite2D)     ← weapon sprite
├── SelectionRing (Polygon2D)       ← visible when selected, hidden otherwise
├── HealthBar (ProgressBar)         ← world-space health indicator above head
├── CollisionShape2D                ← capsule, radius ≈ 18
├── HitArea (Area2D)                ← detects enemy attacks landing on this hero
│   └── CollisionShape2D
├── PickupArea (Area2D)             ← detects loot in range
│   └── CollisionShape2D            ← radius ≈ 40
├── AttackTimer (Timer)             ← one-shot, auto-restarts after each attack
└── AbilityCooldownTimer (Timer)    ← one-shot per ability activation
```

---

## Resources

`HeroResource` is defined in SDD-01. The Hero scene is instanced once per hero and configured
at spawn time via `configure(resource: HeroResource)`.

---

## Signals

```gdscript
signal hp_changed(current: float, maximum: float)
signal died()
signal weapon_changed(new_weapon: WeaponResource)
signal ability_activated(ability: AbilityResource)
signal selected_changed(is_selected: bool)
```

---

## Public API

```gdscript
## Initialise hero from data resource. Call once after adding to scene tree.
func configure(res: HeroResource) -> void

## Order hero to walk to a world-space position.
func move_to(target: Vector2) -> void

## Order hero to attack-move toward an enemy.
func attack_move(target: Enemy) -> void

## Stop all current movement and attack intentions.
func stop() -> void

## Equip a weapon. Replaces current weapon; emits weapon_changed.
func equip_weapon(weapon: WeaponResource) -> void

## Returns the weapon currently held.
func get_weapon() -> WeaponResource

## Activate the hero's ability (if cooldown ready).
func activate_ability() -> void

## Apply incoming damage from a source.
func take_damage(amount: float, knockback: Vector2) -> void

## Returns true if this hero is currently walking toward a target.
func is_moving() -> bool

## Returns true if HP > 0.
func is_alive() -> bool

## Apply a temporary stat buff (e.g. from stimpack or rage).
func apply_buff(buff: HeroBuff) -> void
```

---

## Implementation

```gdscript
# res://scenes/heroes/Hero.gd
class_name Hero extends CharacterBody2D

signal hp_changed(current: float, maximum: float)
signal died()
signal weapon_changed(new_weapon: WeaponResource)
signal ability_activated(ability: AbilityResource)
signal selected_changed(is_selected: bool)

# --- Inspector ---
@export_group("Authority")
@export var authority_id: int = 1   # peer ID that controls this hero; 1 = server/solo

# --- Child references ---
@onready var sprite: Sprite2D = $Sprite2D
@onready var weapon_pivot: Node2D = $WeaponPivot
@onready var weapon_sprite: Sprite2D = $WeaponPivot/WeaponSprite
@onready var selection_ring: Polygon2D = $SelectionRing
@onready var health_bar: ProgressBar = $HealthBar
@onready var hit_area: Area2D = $HitArea
@onready var pickup_area: Area2D = $PickupArea
@onready var attack_timer: Timer = $AttackTimer
@onready var ability_timer: Timer = $AbilityCooldownTimer

# --- Runtime state ---
var data: HeroResource
var _current_weapon: WeaponResource
var _current_ability: AbilityResource
var _hp: float = 100.0
var _max_hp: float = 100.0
var _move_target: Vector2 = Vector2.ZERO
var _has_move_target: bool = false
var _attack_target: Enemy = null
var _is_selected: bool = false
var _buffs: Array[HeroBuff] = []
var _dead: bool = false

# --- Multiplayer ---
func _is_local() -> bool:
    return multiplayer.get_unique_id() == authority_id

# --- Lifecycle ---

func configure(res: HeroResource) -> void:
    data = res
    _hp = res.max_hp
    _max_hp = res.max_hp
    _current_ability = res.ability
    equip_weapon(res.default_weapon)
    attack_timer.wait_time = res.base_attack_rate
    AssetRegistry.assign_sprite(sprite, res.portrait_key)
    hp_changed.emit(_hp, _max_hp)

func _ready() -> void:
    hit_area.area_entered.connect(_on_hit_area_entered)
    pickup_area.area_entered.connect(_on_pickup_area_entered)
    attack_timer.timeout.connect(_on_attack_timer_timeout)
    selection_ring.visible = false

func _physics_process(raw_delta: float) -> void:
    # Movement always uses raw delta so character doesn't snap on freeze/unfreeze.
    if _dead:
        return
    if not _is_local():
        return
    _process_movement(raw_delta)
    move_and_slide()

func _process(_raw_delta: float) -> void:
    if _dead:
        return
    var dt := GameTime.delta
    if dt == 0.0:
        return
    _process_buffs(dt)
    _process_attack(dt)
    _face_target()

# --- Movement ---

func move_to(target: Vector2) -> void:
    if not _is_local():
        return
    _move_target = target
    _has_move_target = true
    _attack_target = null

func attack_move(target: Enemy) -> void:
    if not _is_local():
        return
    _attack_target = target
    _has_move_target = false

func stop() -> void:
    _has_move_target = false
    _attack_target = null
    velocity = Vector2.ZERO

func is_moving() -> bool:
    return velocity.length_squared() > 1.0

func _process_movement(raw_delta: float) -> void:
    if _has_move_target:
        var dir := _move_target - global_position
        var dist := dir.length()
        if dist < 4.0:
            _has_move_target = false
            velocity = Vector2.ZERO
        else:
            velocity = dir.normalized() * _effective_speed()
    elif _attack_target != null and is_instance_valid(_attack_target):
        var dist := global_position.distance_to(_attack_target.global_position)
        if dist > _effective_range():
            var dir := (_attack_target.global_position - global_position).normalized()
            velocity = dir * _effective_speed()
        else:
            velocity = Vector2.ZERO
    else:
        velocity = velocity.move_toward(Vector2.ZERO, 600.0 * raw_delta)

# --- Attack ---

func _process_attack(_dt: float) -> void:
    if _attack_target == null or not is_instance_valid(_attack_target):
        return
    if not _attack_target.is_alive():
        _attack_target = null
        return
    var dist := global_position.distance_to(_attack_target.global_position)
    if dist <= _effective_range() and attack_timer.is_stopped():
        _execute_attack()

func _execute_attack() -> void:
    var w := _current_weapon
    if w.is_projectile:
        _fire_projectile()
    else:
        _melee_hit()
    attack_timer.wait_time = data.base_attack_rate * w.attack_rate_multiplier * _buff_attack_rate()
    attack_timer.start()

func _melee_hit() -> void:
    if _attack_target == null:
        return
    var dmg := _current_weapon.damage * _buff_damage_multiplier()
    var kb := (_attack_target.global_position - global_position).normalized() \
              * _current_weapon.knockback_force
    _attack_target.take_damage(dmg, kb)

func _fire_projectile() -> void:
    if _current_weapon.projectile_scene == null:
        return
    var proj: Node2D = _current_weapon.projectile_scene.instantiate()
    get_tree().current_scene.find_child("Projectiles").add_child(proj)
    proj.global_position = global_position
    proj.launch(_attack_target, _current_weapon, self)

func _on_attack_timer_timeout() -> void:
    pass  # timer is one-shot; re-started in _execute_attack

# --- Damage & Death ---

func take_damage(amount: float, knockback: Vector2) -> void:
    if _dead:
        return
    _hp = max(0.0, _hp - amount)
    velocity += knockback
    hp_changed.emit(_hp, _max_hp)
    health_bar.value = _hp / _max_hp * 100.0
    if _hp <= 0.0:
        _die()

func _die() -> void:
    _dead = true
    stop()
    died.emit()
    EventBus.hero_died.emit(self)

func is_alive() -> bool:
    return not _dead

# --- Weapon ---

func equip_weapon(weapon: WeaponResource) -> void:
    _current_weapon = weapon
    AssetRegistry.assign_sprite(weapon_sprite, weapon.sprite_key)
    weapon_changed.emit(weapon)

func get_weapon() -> WeaponResource:
    return _current_weapon

# --- Ability ---

func activate_ability() -> void:
    if not ability_timer.is_stopped():
        return
    if _current_ability == null:
        return
    _dispatch_ability(_current_ability)
    ability_timer.wait_time = _current_ability.cooldown
    ability_timer.start()
    ability_activated.emit(_current_ability)

func _dispatch_ability(ability: AbilityResource) -> void:
    match ability.effect_type:
        &"blink":
            AbilityHandlers.blink(self, ability)
        &"rage":
            AbilityHandlers.rage(self, ability)
        &"chain_lightning":
            AbilityHandlers.chain_lightning(self, ability)
        _:
            push_warning("Unknown ability effect type: %s" % ability.effect_type)

# --- Buff System ---

func apply_buff(buff: HeroBuff) -> void:
    _buffs.append(buff)

func _process_buffs(dt: float) -> void:
    for i in range(_buffs.size() - 1, -1, -1):
        _buffs[i].remaining -= dt
        if _buffs[i].remaining <= 0.0:
            _buffs.remove_at(i)

func _buff_damage_multiplier() -> float:
    var m := 1.0
    for b in _buffs:
        m *= b.damage_multiplier
    return m

func _buff_attack_rate() -> float:
    var m := 1.0
    for b in _buffs:
        m *= b.attack_rate_multiplier
    return m

func _effective_speed() -> float:
    return data.move_speed  # future: apply buff speed modifiers here

func _effective_range() -> float:
    return _current_weapon.range if _current_weapon else data.base_attack_range

# --- Selection ---

func set_selected(sel: bool) -> void:
    _is_selected = sel
    selection_ring.visible = sel
    selected_changed.emit(sel)

# --- Pickup Area ---

func _on_pickup_area_entered(area: Area2D) -> void:
    if area.owner is LootPickup:
        (area.owner as LootPickup).collected_by(self)

func _on_hit_area_entered(_area: Area2D) -> void:
    pass  # damage is applied by Enemy directly via take_damage()

# --- Face Target ---

func _face_target() -> void:
    var look_at: Vector2
    if _attack_target != null and is_instance_valid(_attack_target):
        look_at = _attack_target.global_position
    elif _has_move_target:
        look_at = _move_target
    else:
        return
    weapon_pivot.look_at(look_at)
```

---

## HeroBuff Resource

```gdscript
# res://scripts/resources/HeroBuff.gd
class_name HeroBuff extends RefCounted

var remaining: float = 0.0
var damage_multiplier: float = 1.0
var attack_rate_multiplier: float = 1.0
var speed_multiplier: float = 1.0

static func make(duration: float, dmg_mult: float = 1.0,
                 atk_mult: float = 1.0, spd_mult: float = 1.0) -> HeroBuff:
    var b := HeroBuff.new()
    b.remaining = duration
    b.damage_multiplier = dmg_mult
    b.attack_rate_multiplier = atk_mult
    b.speed_multiplier = spd_mult
    return b
```

---

## AbilityHandlers

A static helper class — keeps ability logic out of Hero.gd:

```gdscript
# res://scripts/AbilityHandlers.gd
class_name AbilityHandlers

static func blink(hero: Hero, ability: AbilityResource) -> void:
    var mouse_world: Vector2 = hero.get_global_mouse_position()
    var dir := (mouse_world - hero.global_position).normalized()
    var dist := min(hero.global_position.distance_to(mouse_world), ability.range)
    hero.global_position += dir * dist

static func rage(hero: Hero, ability: AbilityResource) -> void:
    var buff := HeroBuff.make(
        ability.duration,
        ability.damage_multiplier,
        ability.attack_rate_multiplier
    )
    hero.apply_buff(buff)

static func chain_lightning(hero: Hero, ability: AbilityResource) -> void:
    # Find nearest enemy, then chain up to ability.chain_count times
    var enemies: Array[Enemy] = _find_enemies_in_range(
        hero.global_position, ability.range)
    if enemies.is_empty():
        return
    var hit: Array[Enemy] = []
    var current: Enemy = enemies[0]
    for _i in range(ability.chain_count + 1):
        if not is_instance_valid(current):
            break
        current.take_damage(ability.damage, Vector2.ZERO)
        current.apply_stun(ability.stun_duration)
        hit.append(current)
        current = _next_chain_target(current, ability.chain_radius, hit)
        if current == null:
            break

static func _find_enemies_in_range(origin: Vector2, radius: float) -> Array[Enemy]:
    # Implementation queries the Enemies container for nearby nodes.
    # Sorted by distance ascending.
    var result: Array[Enemy] = []
    var enemies_node: Node2D = Engine.get_main_loop().current_scene.find_child("Enemies")
    if enemies_node == null:
        return result
    for child in enemies_node.get_children():
        if child is Enemy and child.is_alive():
            if origin.distance_to(child.global_position) <= radius:
                result.append(child)
    result.sort_custom(func(a, b): return origin.distance_to(a.global_position) \
                                        < origin.distance_to(b.global_position))
    return result

static func _next_chain_target(from: Enemy, radius: float,
                                exclude: Array[Enemy]) -> Enemy:
    var best: Enemy = null
    var best_dist: float = INF
    var enemies_node: Node2D = Engine.get_main_loop().current_scene.find_child("Enemies")
    if enemies_node == null:
        return null
    for child in enemies_node.get_children():
        if child is Enemy and child.is_alive() and not exclude.has(child):
            var d: float = from.global_position.distance_to(child.global_position)
            if d <= radius and d < best_dist:
                best_dist = d
                best = child
    return best
```

---

## Input Routing to Heroes

The `HeroInputController` node (child of `Systems`) reads player input and dispatches it to the
selected heroes. It does not live inside Hero.gd — this separation enables multiplayer.

```gdscript
# res://scenes/systems/HeroInputController.gd
class_name HeroInputController extends Node

var selected_heroes: Array[Hero] = []
var all_heroes: Array[Hero] = []

func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed(&"game_stop"):
        for h in selected_heroes:
            h.stop()
    if event.is_action_pressed(&"hero_ability_1"):
        _activate_ability_for_index(0)
    if event.is_action_pressed(&"hero_ability_2"):
        _activate_ability_for_index(1)
    if event.is_action_pressed(&"hero_ability_3"):
        _activate_ability_for_index(2)

func _input(event: InputEvent) -> void:
    if event is InputEventMouseButton and event.pressed:
        if event.button_index == MOUSE_BUTTON_RIGHT:
            _on_right_click(event.global_position)
        elif event.button_index == MOUSE_BUTTON_LEFT:
            _on_left_click(event)

func _on_right_click(world_pos: Vector2) -> void:
    # Check if clicking an enemy (attack-move) or open ground (move)
    var enemy := _enemy_at(world_pos)
    for h in selected_heroes:
        if enemy:
            h.attack_move(enemy)
        else:
            h.move_to(world_pos)

func _on_left_click(_event: InputEvent) -> void:
    pass  # Selection is handled by SelectionSystem (box-select, single click)

func _activate_ability_for_index(index: int) -> void:
    if index < all_heroes.size():
        all_heroes[index].activate_ability()

func _enemy_at(world_pos: Vector2) -> Enemy:
    # Physics point query for enemy collision shapes at world_pos
    var space := get_viewport().world_2d.direct_space_state
    var params := PhysicsPointQueryParameters2D.new()
    params.position = world_pos
    params.collision_mask = 0b0010  # enemy layer
    var results := space.intersect_point(params, 1)
    if results.is_empty():
        return null
    var body := results[0].collider
    return body if body is Enemy else null
```

---

## Hero Spawning

The `GameWorld` spawns heroes from their resource files during `_ready`:

```gdscript
const HERO_SCENE: PackedScene = preload("res://scenes/heroes/Hero.tscn")
const HERO_RESOURCES: Array[StringName] = [&"elliot", &"dick", &"habib"]
const HERO_START_POSITIONS: Array[Vector2] = [
    Vector2(400, 540), Vector2(480, 540), Vector2(560, 540)
]

func _spawn_heroes() -> void:
    var heroes_node: Node2D = $Containers/Heroes
    for i in HERO_RESOURCES.size():
        var res: HeroResource = load("res://data/heroes/%s.tres" % HERO_RESOURCES[i])
        var hero: Hero = HERO_SCENE.instantiate()
        heroes_node.add_child(hero)
        hero.global_position = HERO_START_POSITIONS[i]
        hero.configure(res)
        GameState.heroes.append(hero)
```

---

## Dependencies

- `GameTime` (autoload) — `GameTime.delta` in `_process`
- `AssetRegistry` (autoload) — sprite texture assignment
- `EventBus` (autoload) — `hero_died` signal emit
- `AbilityHandlers` (static class) — ability dispatch
- `HeroBuff` (RefCounted) — buff application

---

## LLM Prompt

```
You are implementing the Hero System for P-RAY, a Godot 4.4 GDScript top-down survival game.

Key rule: time only flows when heroes move. All simulation uses GameTime.delta (0.0 = frozen).
Movement itself always uses raw delta so heroes don't snap on freeze.

Task:
1. Create Hero.tscn with the node tree described in SDD-03.
2. Implement Hero.gd exactly as shown. No logic beyond what is described.
3. Implement HeroBuff.gd (RefCounted, no Node).
4. Implement AbilityHandlers.gd (static methods only, no Node).
5. Implement HeroInputController.gd.
6. Implement HeroMovementMonitor.gd (from SDD-02) and wire it to the hero roster after spawn.
7. Create stub HeroResource .tres files for elliot, dick, habib with values from SDD-07 balance table.

Rules:
- Weapon equipping is runtime — Hero.equip_weapon() accepts any WeaponResource.
- Input handling must check authority_id for future multiplayer.
- Do not add any hardcoded per-character logic into Hero.gd — use AbilityHandlers dispatch.

[paste SDD-00, SDD-02, SDD-03 here]
```
