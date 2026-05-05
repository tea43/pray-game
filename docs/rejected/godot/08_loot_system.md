# SDD-08: Loot System

## Purpose

Handles enemy loot drops: probability rolls, spawning pickup entities, and applying effects when
a hero collects them. The system is fully data-driven — drop tables live in `EnemyResource` and
`LootResource` files.

---

## Scene Structure

```
Systems (Node)
└── LootSystem (Node)               ← script: LootSystem.gd; acts as a singleton coordinator

LootPickup (Area2D)                 ← one per drop; script: LootPickup.gd
├── Sprite2D                        ← icon sprite (assigned by AssetRegistry)
├── CollisionShape2D                ← circle radius ≈ 20
└── AnimationPlayer                 ← float/bob idle animation
```

`LootPickup` nodes live in `Containers/Loot` in the scene tree.

---

## LootResource Definitions

All in `res://data/loot/`. Key field: `effect_type` drives what happens when collected.

### medkit.tres
```
id: "medkit"
display_name: "Medkit"
effect_type: "heal"
heal_amount: 60.0
```

### stimpack.tres
```
id: "stimpack"
display_name: "Stimpack"
effect_type: "buff"
buff_duration: 5.0
# Applies rage-like buff: 2x damage, 0.4x attack rate
# And reduces ability cooldown by 2s
cooldown_reduction: 2.0
```

### bomb.tres
```
id: "bomb"
display_name: "Bomb"
effect_type: "explosion"
explosion_radius: 280.0
```

### banana_bomb.tres
```
id: "banana_bomb"
display_name: "Banana Bomb"
effect_type: "big_explosion"
explosion_radius: 420.0
# Also applies 2.5s stun and heavy knockback to surviving enemies
```

### spray_gun_pickup.tres
```
id: "spray_gun_pickup"
display_name: "Spray Gun"
effect_type: "weapon"
weapon_grant: preload("res://data/weapons/spray_gun.tres")
```

### samurai_sword_pickup.tres
```
id: "samurai_sword_pickup"
display_name: "Samurai Sword"
effect_type: "weapon"
weapon_grant: preload("res://data/weapons/samurai_sword.tres")
```

---

## Drop Table Rules

### Regular Enemy Drops

After a regular enemy dies, `LootSystem.roll_drop()` is called. Rolls sequentially:

1. Roll `drop_chance` — if fails, no drop.
2. If hard enemy (`mutant`, `blinker`): roll 2% banana_bomb first; then 20% for spray_gun or
   samurai_sword (equal probability). If none, proceed to regular table.
3. Regular table (weighted): 60% medkit, 35% stimpack, 5% bomb.

Drop multiplier from difficulty scales `drop_chance` (capped at 1.0) and `special_loot`
chance linearly.

### Boss Drops

Bosses have a `drop_bundle: Array[LootResource]` that is always spawned — no roll needed.

---

## LootSystem Implementation

```gdscript
# res://scenes/systems/LootSystem.gd
class_name LootSystem extends Node

const LOOT_PICKUP_SCENE := preload("res://scenes/loot/LootPickup.tscn")

# Regular drop weight table as parallel arrays
const REGULAR_IDS: Array[StringName] = [&"medkit", &"stimpack", &"bomb"]
const REGULAR_WEIGHTS: Array[float] = [0.60, 0.35, 0.05]

# Preloaded loot resources
var _loot_cache: Dictionary = {}   # StringName → LootResource

func _ready() -> void:
    _preload_loot()

func _preload_loot() -> void:
    var ids: Array[StringName] = [
        &"medkit", &"stimpack", &"bomb", &"banana_bomb",
        &"spray_gun_pickup", &"samurai_sword_pickup"
    ]
    for id in ids:
        _loot_cache[id] = load("res://data/loot/%s.tres" % id)

## Called by Enemy._die(). Rolls and spawns drops at the given world position.
func roll_drop(enemy: Enemy, data: EnemyResource, diff: DifficultyResource) -> void:
    # Boss: guaranteed bundle
    if not data.drop_bundle.is_empty():
        for loot in data.drop_bundle:
            _spawn_pickup(loot, enemy.global_position + _scatter())
        return

    # Boss with guaranteed single drop
    if data.guaranteed_drop != null:
        _spawn_pickup(data.guaranteed_drop, enemy.global_position)
        return

    # Regular drop chance
    var effective_chance: float = min(data.drop_chance * diff.loot_drop_multiplier, 1.0)
    if randf() > effective_chance:
        return

    # Hard enemy special roll
    var is_hard := data.id in [&"mutant", &"blinker"]
    if is_hard:
        var special := _roll_special(diff)
        if special != null:
            _spawn_pickup(special, enemy.global_position)
            return

    # Regular table
    var loot_id := _weighted_pick(REGULAR_IDS, REGULAR_WEIGHTS)
    _spawn_pickup(_loot_cache[loot_id], enemy.global_position)

func _roll_special(diff: DifficultyResource) -> LootResource:
    var banana_chance: float = 0.02 * diff.special_loot_multiplier
    if randf() < banana_chance:
        return _loot_cache[&"banana_bomb"]
    var special_chance: float = 0.20 * diff.special_loot_multiplier
    if randf() < special_chance:
        return _loot_cache[&"spray_gun_pickup"] if randf() < 0.5 \
               else _loot_cache[&"samurai_sword_pickup"]
    return null

func _weighted_pick(ids: Array[StringName], weights: Array[float]) -> StringName:
    var roll := randf()
    var cumulative: float = 0.0
    for i in ids.size():
        cumulative += weights[i]
        if roll <= cumulative:
            return ids[i]
    return ids[-1]

func _spawn_pickup(loot: LootResource, pos: Vector2) -> void:
    var pickup: LootPickup = LOOT_PICKUP_SCENE.instantiate()
    get_tree().current_scene.find_child("Loot").add_child(pickup)
    pickup.global_position = pos
    pickup.configure(loot)

func _scatter() -> Vector2:
    return Vector2(randf_range(-40, 40), randf_range(-40, 40))
```

---

## LootPickup Implementation

```gdscript
# res://scenes/loot/LootPickup.gd
class_name LootPickup extends Area2D

var _loot: LootResource
var _collected: bool = false

@onready var sprite: Sprite2D = $Sprite2D
@onready var anim: AnimationPlayer = $AnimationPlayer

func configure(loot: LootResource) -> void:
    _loot = loot
    AssetRegistry.assign_sprite(sprite, loot.icon_key)

func _ready() -> void:
    body_entered.connect(_on_body_entered)
    if anim.has_animation("bob"):
        anim.play("bob")

func _on_body_entered(body: Node2D) -> void:
    if _collected:
        return
    if body is Hero:
        collected_by(body as Hero)

## Called either by Area2D signal or Hero's PickupArea (whichever fires first).
func collected_by(hero: Hero) -> void:
    if _collected:
        return
    _collected = true
    LootApplicator.apply(_loot, hero)
    EventBus.hero_picked_up_loot.emit(hero, _loot.id)
    queue_free()
```

---

## LootApplicator

Static class that resolves `effect_type` to actual game effects:

```gdscript
# res://scripts/LootApplicator.gd
class_name LootApplicator

static func apply(loot: LootResource, hero: Hero) -> void:
    match loot.effect_type:
        &"heal":
            _apply_heal(loot, hero)
        &"buff":
            _apply_buff(loot, hero)
        &"weapon":
            _apply_weapon(loot, hero)
        &"explosion":
            _apply_explosion(loot, hero.global_position, false)
        &"big_explosion":
            _apply_explosion(loot, hero.global_position, true)
        _:
            push_warning("LootApplicator: unknown effect_type '%s'" % loot.effect_type)

static func _apply_heal(loot: LootResource, hero: Hero) -> void:
    hero._hp = min(hero._hp + loot.heal_amount, hero._max_hp)
    hero.hp_changed.emit(hero._hp, hero._max_hp)

static func _apply_buff(loot: LootResource, hero: Hero) -> void:
    var buff := HeroBuff.make(loot.buff_duration, 2.0, 0.4)
    hero.apply_buff(buff)
    hero.reduce_ability_cooldown(loot.cooldown_reduction)

static func _apply_weapon(loot: LootResource, hero: Hero) -> void:
    hero.equip_weapon(loot.weapon_grant)

static func _apply_explosion(loot: LootResource, origin: Vector2, big: bool) -> void:
    var enemies_node: Node2D = Engine.get_main_loop().current_scene.find_child("Enemies")
    if enemies_node == null:
        return
    var stun_dur: float = big_explosion_stun if big else 0.0
    for child in enemies_node.get_children():
        if not (child is Enemy) or not child.is_alive():
            continue
        var dist := origin.distance_to(child.global_position)
        if dist <= loot.explosion_radius:
            var falloff := 1.0 - (dist / loot.explosion_radius)
            var dmg := 80.0 * falloff   # fixed explosion damage
            var kb := (child.global_position - origin).normalized() \
                      * (200.0 if big else 120.0) * falloff
            child.take_damage(dmg, kb)
            if big and stun_dur > 0.0 and child.is_alive():
                child.apply_stun(stun_dur)

const big_explosion_stun: float = 2.5
```

> Note: `_apply_heal` accesses `hero._hp` directly. To keep encapsulation, add a
> `heal(amount: float)` public method to `Hero.gd` instead. This is cleaner and preferred:
> ```gdscript
> func heal(amount: float) -> void:
>     _hp = min(_hp + amount, _max_hp)
>     hp_changed.emit(_hp, _max_hp)
> ```

---

## Pickup Lifetime

Loot pickups are permanent until collected — they do not despawn automatically. Future versions
may add a configurable auto-despawn timer via `LootResource.pickup_lifetime` (0 = permanent).

---

## Hero Pickup Area

Heroes have a `PickupArea (Area2D)` with radius ≈ 40 px. Entering it triggers auto-pickup:

```gdscript
# In Hero.gd
func _on_pickup_area_entered(area: Area2D) -> void:
    if area.owner is LootPickup:
        (area.owner as LootPickup).collected_by(self)
```

The area's collision mask should be set to layer 4 (Loot).

---

## Dependencies

- `GameState` — not directly; `LootSystem` is called by `Enemy._die()`
- `DifficultyConfig` — drop chance and special multipliers
- `AssetRegistry` — pickup sprite assignment
- `EventBus` — `hero_picked_up_loot` signal
- `Hero.heal()`, `Hero.apply_buff()`, `Hero.equip_weapon()`, `Hero.reduce_ability_cooldown()`
- `Enemy.apply_stun()` — for banana_bomb

---

## LLM Prompt

```
You are implementing the Loot System for P-RAY, a Godot 4.4 GDScript game.

Loot drops when enemies die, based on per-enemy drop tables. Heroes auto-pickup loot by
walking near it. Effects are applied immediately on pickup.

Task:
1. Create LootPickup.tscn with the node tree from SDD-08.
2. Implement LootPickup.gd.
3. Implement LootSystem.gd (static helper accessible as LootSystem autoload or Node singleton).
4. Implement LootApplicator.gd (static methods only).
5. Create all six LootResource .tres files with values from SDD-08.
6. Add heal() public method to Hero.gd.
7. Wire Hero.PickupArea to auto-collect nearby LootPickup.

Rules:
- LootPickup._collected guard prevents double-pickup race conditions.
- Explosion damage uses a falloff curve (1 - dist/radius), not flat damage.
- Drop rolls use DifficultyConfig.data multipliers, not hardcoded values.
- LootApplicator is a static class (no Node, no extends).

[paste SDD-00, SDD-03, SDD-06, SDD-08 here]
```
