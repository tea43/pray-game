# SDD-04: Weapon System

## Purpose

Weapons are first-class `Resource` objects, independent of any hero. Any hero can hold any weapon.
Heroes can swap weapons with each other at runtime. Temporary weapons (spray gun, samurai sword)
expire after a duration and revert to the hero's default.

---

## Design Principles

- A weapon is data only — it has no node, no scene, no `_process`.
- The `Hero` node executes attack logic by reading `WeaponResource` fields.
- Swapping is done by calling `hero.equip_weapon(weapon_resource)`.
- The default weapon is stored in `HeroResource.default_weapon`; when a temporary weapon expires,
  the hero reverts to it.

---

## WeaponResource Schema

Defined in SDD-01. Key fields used by attack execution:

| Field | Purpose |
|-------|---------|
| `is_projectile` | If true, Hero fires a projectile scene; if false, melee |
| `projectile_scene` | PackedScene to instantiate for projectile weapons |
| `projectile_speed` | Pixels/sec for the projectile |
| `damage` | Base damage per hit |
| `range` | Maximum attack reach in pixels |
| `attack_rate_multiplier` | Multiplies hero's base attack rate (lower = faster) |
| `knockback_force` | Magnitude of knockback applied to target |
| `aoe_radius` | If > 0, damage hits all enemies within this radius of impact |
| `aoe_angle_deg` | If > 0, damage hits enemies in a cone (melee cleave) |
| `bullet_count` | Number of projectiles fired per attack (spray gun = 5) |
| `cone_spread_deg` | Total spread of multi-bullet cone |
| `is_temporary` | True for pickup weapons |
| `duration` | Seconds before revert (only when `is_temporary`) |

---

## Weapon Definitions

All defined as `.tres` files in `res://data/weapons/`. Values below match the original game.

### long_club.tres
```
id: "long_club"
display_name: "Long Club"
damage: 32.0
range: 56.0
attack_rate_multiplier: 1.0
knockback_force: 80.0
is_projectile: false
is_temporary: false
```

### dual_clubs.tres
```
id: "dual_clubs"
display_name: "Dual Clubs"
damage: 24.0
range: 36.0
attack_rate_multiplier: 1.0    # hero Dick has fast base rate 0.34s
knockback_force: 60.0
is_projectile: false
is_temporary: false
```

### thrown_club.tres
```
id: "thrown_club"
display_name: "Thrown Club"
damage: 36.0
range: 220.0
attack_rate_multiplier: 1.0
knockback_force: 40.0
is_projectile: true
projectile_scene: preload("res://scenes/projectiles/ThrownClub.tscn")
projectile_speed: 300.0
is_temporary: false
```

### spray_gun.tres
```
id: "spray_gun"
display_name: "Spray Gun"
damage: 15.0        # per bullet
range: 320.0
attack_rate_multiplier: 0.25   # very fast
knockback_force: 20.0
is_projectile: true
projectile_scene: preload("res://scenes/projectiles/SprayBullet.tscn")
projectile_speed: 480.0
bullet_count: 5
cone_spread_deg: 30.0
is_temporary: true
duration: 15.0
```

### samurai_sword.tres
```
id: "samurai_sword"
display_name: "Samurai Sword"
damage: 0.0            # damage computed as hero_base * 2.2 in attack code
range: 80.0
attack_rate_multiplier: 1.0
knockback_force: 100.0
aoe_radius: 80.0
aoe_angle_deg: 120.0
is_temporary: true
duration: 20.0
```

> Note: samurai_sword damage multiplier (2.2×) is a special case in Hero._melee_hit():
> `if weapon.aoe_angle_deg > 0: dmg *= 2.2`. Set `damage` to 0 and handle in code, or add a
> `damage_multiplier` field to `WeaponResource` for cleaner data-driving.

---

## Temporary Weapon Timer

Hero.gd tracks temporary weapon expiry internally:

```gdscript
# additions to Hero.gd

var _temp_weapon_timer: float = 0.0

func equip_weapon(weapon: WeaponResource) -> void:
    _current_weapon = weapon
    if weapon.is_temporary:
        _temp_weapon_timer = weapon.duration
    else:
        _temp_weapon_timer = 0.0
    AssetRegistry.assign_sprite(weapon_sprite, weapon.sprite_key)
    weapon_changed.emit(weapon)

func _process_weapon_expiry(dt: float) -> void:
    if _temp_weapon_timer <= 0.0:
        return
    _temp_weapon_timer -= dt
    if _temp_weapon_timer <= 0.0:
        equip_weapon(data.default_weapon)   # revert to hero default

# Add call to _process_weapon_expiry(dt) inside the _process block
```

---

## Weapon Swapping Between Heroes

Two heroes swap weapons. Initiated by the player selecting two heroes and pressing the swap key,
or via UI drag-and-drop (future).

### Swap Rules

- Temporary weapons can be swapped.
- If hero B already has a temporary weapon, it is returned to the loot pool (dropped at hero B's
  feet) before hero A's weapon is equipped. This prevents weapon loss.
- After the swap, timers are preserved (the remaining duration travels with the weapon).

### Implementation

```gdscript
# res://scenes/systems/WeaponSwapSystem.gd
class_name WeaponSwapSystem extends Node

## Reference set by HeroInputController after hero roster is known.
var selected_heroes: Array[Hero]
var all_heroes: Array[Hero]

func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed(&"weapon_swap"):
        _attempt_swap()

func _attempt_swap() -> void:
    if selected_heroes.size() != 2:
        return
    var hero_a: Hero = selected_heroes[0]
    var hero_b: Hero = selected_heroes[1]
    _swap(hero_a, hero_b)

func _swap(a: Hero, b: Hero) -> void:
    var weapon_a := a.get_weapon()
    var weapon_b := b.get_weapon()
    var timer_a := a.get_temp_timer()
    var timer_b := b.get_temp_timer()

    a.equip_weapon_with_timer(weapon_b, timer_b)
    b.equip_weapon_with_timer(weapon_a, timer_a)
```

Add these methods to Hero.gd:

```gdscript
## Returns remaining time on current temporary weapon (0.0 if not temporary).
func get_temp_timer() -> float:
    return _temp_weapon_timer

## Equip weapon and override the temporary timer (used in swaps).
func equip_weapon_with_timer(weapon: WeaponResource, remaining_time: float) -> void:
    _current_weapon = weapon
    _temp_weapon_timer = remaining_time if weapon.is_temporary else 0.0
    AssetRegistry.assign_sprite(weapon_sprite, weapon.sprite_key)
    weapon_changed.emit(weapon)
```

---

## Projectile: ThrownClub

Boomerang behavior — flies to target, returns to hero, disappears on catch.

```gdscript
# res://scenes/projectiles/ThrownClub.gd
class_name ThrownClub extends Node2D

var _weapon: WeaponResource
var _owner_hero: Hero
var _target: Enemy
var _hit: bool = false
var _returning: bool = false
var _speed: float = 300.0

func launch(target: Enemy, weapon: WeaponResource, owner_hero: Hero) -> void:
    _target = target
    _weapon = weapon
    _owner_hero = owner_hero
    _speed = weapon.projectile_speed

func _process(_raw_delta: float) -> void:
    var dt := GameTime.delta
    if dt == 0.0:
        return
    if _returning:
        _move_toward_hero(dt)
    else:
        _move_toward_target(dt)

func _move_toward_target(dt: float) -> void:
    if not is_instance_valid(_target):
        _start_return()
        return
    var dir := (_target.global_position - global_position).normalized()
    global_position += dir * _speed * dt
    if global_position.distance_to(_target.global_position) < 12.0:
        if not _hit:
            _hit = true
            _target.take_damage(_weapon.damage, Vector2.ZERO)
        _start_return()

func _start_return() -> void:
    _returning = true

func _move_toward_hero(dt: float) -> void:
    if not is_instance_valid(_owner_hero):
        queue_free()
        return
    var dir := (_owner_hero.global_position - global_position).normalized()
    global_position += dir * _speed * dt
    if global_position.distance_to(_owner_hero.global_position) < 20.0:
        queue_free()   # caught
```

---

## Projectile: SprayBullet

Simple forward-moving bullet with max range. Spawned in a cone by Hero._fire_projectile().

```gdscript
# res://scenes/projectiles/SprayBullet.gd
class_name SprayBullet extends Node2D

var _direction: Vector2
var _speed: float
var _damage: float
var _max_range: float
var _traveled: float = 0.0

func launch(direction: Vector2, weapon: WeaponResource) -> void:
    _direction = direction
    _speed = weapon.projectile_speed
    _damage = weapon.damage
    _max_range = weapon.range

func _process(_raw_delta: float) -> void:
    var dt := GameTime.delta
    if dt == 0.0:
        return
    var step: float = _speed * dt
    global_position += _direction * step
    _traveled += step
    if _traveled >= _max_range:
        queue_free()
```

Collision detection for SprayBullet — add an `Area2D` with a small `CollisionShape2D` and connect
`area_entered` or `body_entered`:

```gdscript
func _on_body_entered(body: Node2D) -> void:
    if body is Enemy and body.is_alive():
        body.take_damage(_damage, _direction * 20.0)
        queue_free()
```

---

## Multi-Bullet Firing (Spray Gun)

Override `_fire_projectile` in Hero.gd to handle `bullet_count > 1`:

```gdscript
func _fire_projectile() -> void:
    var w := _current_weapon
    if w.projectile_scene == null:
        return
    if w.bullet_count <= 1:
        _fire_single_projectile(w, (_attack_target.global_position - global_position).normalized())
        return
    # Cone spread
    var base_angle := global_position.angle_to_point(_attack_target.global_position)
    var half_spread := deg_to_rad(w.cone_spread_deg / 2.0)
    for i in w.bullet_count:
        var t: float = float(i) / float(w.bullet_count - 1) if w.bullet_count > 1 else 0.5
        var angle: float = lerp(-half_spread, half_spread, t) + base_angle
        var dir := Vector2.from_angle(angle)
        _fire_single_projectile(w, dir)

func _fire_single_projectile(w: WeaponResource, direction: Vector2) -> void:
    var proj: Node2D = w.projectile_scene.instantiate()
    get_tree().current_scene.find_child("Projectiles").add_child(proj)
    proj.global_position = global_position
    if proj is ThrownClub:
        proj.launch(_attack_target, w, self)
    elif proj is SprayBullet:
        proj.launch(direction, w)
```

---

## Cone AoE Melee (Samurai Sword)

Override `_melee_hit` to handle `aoe_angle_deg > 0`:

```gdscript
func _melee_hit() -> void:
    var w := _current_weapon
    var base_dmg := w.damage * _buff_damage_multiplier()

    if w.aoe_angle_deg > 0.0:
        # Cleave: hit all enemies in cone
        var half_angle := deg_to_rad(w.aoe_angle_deg / 2.0)
        var forward := Vector2.from_angle(weapon_pivot.rotation)
        var enemies_node := get_tree().current_scene.find_child("Enemies")
        for child in enemies_node.get_children():
            if child is Enemy and child.is_alive():
                var to_enemy := (child.global_position - global_position)
                if to_enemy.length() <= w.aoe_radius:
                    var angle := forward.angle_to(to_enemy.normalized())
                    if abs(angle) <= half_angle:
                        # Samurai sword multiplier
                        child.take_damage(base_dmg * 2.2,
                            to_enemy.normalized() * w.knockback_force)
    else:
        if _attack_target == null:
            return
        var kb := (_attack_target.global_position - global_position).normalized() \
                  * w.knockback_force
        _attack_target.take_damage(base_dmg, kb)
```

---

## Signals Summary

| Signal | Emitter | When |
|--------|---------|------|
| `weapon_changed(WeaponResource)` | Hero | `equip_weapon()` called |

---

## Dependencies

- `GameTime` — projectiles use `GameTime.delta`
- `AssetRegistry` — weapon sprite assignment
- `Hero` — receives `equip_weapon()` calls

---

## LLM Prompt

```
You are implementing the Weapon System for P-RAY, a Godot 4.4 GDScript game.

Weapons are WeaponResource data objects. Heroes execute attacks by reading weapon fields.
Any hero can hold any weapon. Weapons are swapped at runtime via WeaponSwapSystem.

Task:
1. Create all WeaponResource .tres files with the values in SDD-04.
2. Implement ThrownClub.gd and ThrownClub.tscn (boomerang: flies to target, returns to hero).
3. Implement SprayBullet.gd and SprayBullet.tscn (straight moving bullet with max range).
4. Add _process_weapon_expiry(), get_temp_timer(), equip_weapon_with_timer() to Hero.gd.
5. Override _fire_projectile() in Hero.gd for cone spray (bullet_count > 1).
6. Override _melee_hit() in Hero.gd for cone AoE (aoe_angle_deg > 0).
7. Implement WeaponSwapSystem.gd.

Rules:
- Projectile _process uses GameTime.delta, not raw delta.
- ThrownClub must handle invalid target (enemy died mid-flight): return immediately.
- SprayBullet despawns at max range or on enemy hit.
- Swap preserves remaining timer for temporary weapons.

[paste SDD-00, SDD-03, SDD-04 here]
```
