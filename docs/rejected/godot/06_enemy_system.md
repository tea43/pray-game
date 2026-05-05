# SDD-06: Enemy System

## Purpose

Defines enemy entities — worm and snake-type mutant creatures. Enemies pursue heroes, attack,
receive damage, die, and potentially drop loot. Each type is defined by an `EnemyResource` data
file; behavior is shared code that reads those values.

---

## Scene Structure

All enemy types share a single base scene. Type-specific visual differences come from sprites
assigned by `AssetRegistry`.

```
Enemy (CharacterBody2D)             ← script: Enemy.gd
├── Sprite2D                        ← body sprite (assigned at configure time)
│   └── AnimationPlayer             ← idle/walk/attack/death animations
├── CollisionShape2D                ← capsule; radius varies by type
├── HitBox (Area2D)                 ← used by Hero to detect enemies at click
│   └── CollisionShape2D
├── AttackArea (Area2D)             ← detects heroes in melee range
│   └── CollisionShape2D
├── NavigationAgent2D               ← pathfinding to target hero
└── StunVFX (Node2D)                ← visual indicator when stunned (placeholder)
```

---

## EnemyResource Schema

See SDD-01. Key additional detail:

- `wave_unlock` — the first wave number this enemy type can appear in the spawn table.
- `drop_chance` — 0.0–1.0 probability of dropping any loot on death.
- `guaranteed_drop` — if set, always drop this; ignores `drop_chance` (used for bosses).
- `drop_bundle` — array of loot items; all are dropped (boss bundles).

---

## Enemy Type Definitions

All in `res://data/enemies/`. Difficulty multipliers (hp, damage, speed) are applied at spawn
time, not baked into the resource.

| ID | HP | Damage | Speed | Range | Attack Rate | Wave |
|----|----|--------|-------|-------|-------------|------|
| `raider` | 30 | 10 | 48 | 32 | 1.0s | 1 |
| `runner` | 22 | 8 | 105 | 28 | 0.9s | 2 |
| `ghoul` | 50 | 14 | 58 | 32 | 1.2s | 2 |
| `mutant` | 90 | 22 | 32 | 36 | 1.4s | 4 |
| `blinker` | 45 | 18 | 38 | 30 | 1.1s | 3 |
| `miniboss` | 600 | 32 | 40 | 48 | 1.8s | every 4th |
| `bigboss` | 2000 | 48 | 28 | 60 | 2.2s | every 9th |

---

## Enemy Behavior: AI State Machine

```
States: IDLE → PURSUING → ATTACKING → STUNNED → DEAD
```

- **IDLE**: no hero in detection range. Stand still (does not drive time — only heroes do).
- **PURSUING**: navigate toward nearest living hero via `NavigationAgent2D`.
- **ATTACKING**: hero within `attack_range`; stop moving, execute attack on cooldown.
- **STUNNED**: AI and movement paused for `_stun_timer` seconds (game-time).
- **DEAD**: play death animation, emit drops, queue_free.

Transition rules:
- `IDLE → PURSUING`: any hero enters a detection radius (default 800 px).
- `PURSUING → ATTACKING`: distance to target ≤ `attack_range`.
- `ATTACKING → PURSUING`: target moves out of range or dies.
- `any → STUNNED`: `apply_stun()` called with duration > 0.
- `STUNNED → (previous state)`: stun timer expires.
- `any → DEAD`: `_hp ≤ 0`.

---

## Full Implementation

```gdscript
# res://scenes/enemies/Enemy.gd
class_name Enemy extends CharacterBody2D

signal died(enemy: Enemy, position: Vector2)

enum State { IDLE, PURSUING, ATTACKING, STUNNED, DEAD }

# --- Data ---
var data: EnemyResource
var _hp: float
var _max_hp: float
var _damage: float
var _speed: float
var _attack_range: float
var _attack_rate: float

# --- Runtime ---
var _state: State = State.IDLE
var _stun_timer: float = 0.0
var _attack_timer: float = 0.0
var _target_hero: Hero = null
var _pre_stun_state: State = State.IDLE
var _dead: bool = false

@export_group("Authority")
@export var authority_id: int = 1

@onready var nav_agent: NavigationAgent2D = $NavigationAgent2D
@onready var attack_area: Area2D = $AttackArea
@onready var sprite: Sprite2D = $Sprite2D
@onready var anim: AnimationPlayer = $Sprite2D/AnimationPlayer
@onready var stun_vfx: Node2D = $StunVFX

const DETECTION_RADIUS: float = 800.0

func configure(res: EnemyResource, difficulty: DifficultyResource) -> void:
    data = res
    _hp = res.max_hp * difficulty.enemy_hp_multiplier
    _max_hp = _hp
    _damage = res.damage * difficulty.enemy_damage_multiplier
    _speed = res.move_speed * difficulty.enemy_speed_multiplier
    _attack_range = res.attack_range
    _attack_rate = res.attack_rate
    AssetRegistry.assign_sprite(sprite, res.sprite_key)

func _ready() -> void:
    nav_agent.path_desired_distance = 4.0
    nav_agent.target_desired_distance = _attack_range * 0.8
    attack_area.body_entered.connect(_on_attack_area_entered)
    attack_area.body_exited.connect(_on_attack_area_exited)

func _physics_process(raw_delta: float) -> void:
    if _dead:
        return
    var dt := GameTime.delta
    if dt == 0.0:
        velocity = Vector2.ZERO
        move_and_slide()
        return

    if _state == State.STUNNED:
        _process_stun(dt)
        velocity = Vector2.ZERO
        move_and_slide()
        return

    _update_target()
    _process_state(dt)
    move_and_slide()

func _process_state(dt: float) -> void:
    match _state:
        State.IDLE:
            velocity = velocity.move_toward(Vector2.ZERO, 300.0 * dt)
        State.PURSUING:
            _navigate(dt)
        State.ATTACKING:
            velocity = Vector2.ZERO
            _attack_timer -= dt
            if _attack_timer <= 0.0:
                _execute_attack()
                _attack_timer = _attack_rate

func _update_target() -> void:
    # Find nearest living hero
    var nearest: Hero = _find_nearest_hero()
    if nearest == null:
        _transition(State.IDLE)
        return
    _target_hero = nearest
    var dist := global_position.distance_to(nearest.global_position)
    if _state == State.IDLE and dist <= DETECTION_RADIUS:
        _transition(State.PURSUING)
    elif _state == State.PURSUING and dist <= _attack_range:
        _transition(State.ATTACKING)
    elif _state == State.ATTACKING and dist > _attack_range * 1.1:
        _transition(State.PURSUING)

func _navigate(dt: float) -> void:
    if _target_hero == null:
        return
    nav_agent.target_position = _target_hero.global_position
    if nav_agent.is_navigation_finished():
        return
    var next: Vector2 = nav_agent.get_next_path_position()
    var dir := (next - global_position).normalized()
    velocity = dir * _speed

func _transition(new_state: State) -> void:
    _state = new_state
    if new_state == State.ATTACKING:
        _attack_timer = 0.0   # attack immediately on enter

func _execute_attack() -> void:
    if _target_hero == null or not is_instance_valid(_target_hero):
        return
    if not _target_hero.is_alive():
        return
    var dist := global_position.distance_to(_target_hero.global_position)
    if dist > _attack_range:
        return
    var kb := (_target_hero.global_position - global_position).normalized() * 60.0
    _target_hero.take_damage(_damage, kb)

# --- Damage & Death ---

func take_damage(amount: float, knockback: Vector2) -> void:
    if _dead:
        return
    _hp = max(0.0, _hp - amount)
    velocity += knockback
    if _hp <= 0.0:
        _die()

func _die() -> void:
    _dead = true
    _state = State.DEAD
    velocity = Vector2.ZERO
    died.emit(self, global_position)
    EventBus.enemy_died.emit(self, global_position)
    _roll_drop()
    # Play death animation then free
    if anim.has_animation("death"):
        anim.play("death")
        await anim.animation_finished
    queue_free()

func is_alive() -> bool:
    return not _dead

# --- Stun ---

func apply_stun(duration: float) -> void:
    if _dead:
        return
    if _state != State.STUNNED:
        _pre_stun_state = _state
    _stun_timer = max(_stun_timer, duration)
    _state = State.STUNNED
    stun_vfx.visible = true

func _process_stun(dt: float) -> void:
    _stun_timer -= dt
    if _stun_timer <= 0.0:
        _stun_timer = 0.0
        _state = _pre_stun_state
        stun_vfx.visible = false

# --- Loot Drop ---

func _roll_drop() -> void:
    LootSystem.roll_drop(self, data, DifficultyConfig.data)

# --- Hero Detection ---

func _find_nearest_hero() -> Hero:
    var best: Hero = null
    var best_dist: float = INF
    for hero in GameState.heroes:
        if hero.is_alive():
            var d := global_position.distance_to(hero.global_position)
            if d < best_dist:
                best_dist = d
                best = hero
    return best

func _on_attack_area_entered(body: Node2D) -> void:
    pass   # handled via state machine polling, not signal

func _on_attack_area_exited(body: Node2D) -> void:
    pass
```

---

## Boss Behavior Additions

Bosses (`miniboss`, `bigboss`) use the same `Enemy.gd` with extra config. Add:

```gdscript
# Extra fields on EnemyResource for boss types:
@export var is_boss: bool = false
@export var boss_ability_cooldown: float = 8.0   # seconds between special attacks
```

Bosses override `_execute_attack()` to alternate between normal attacks and a special ability:

```gdscript
var _boss_ability_timer: float = 0.0

func _process_state(dt: float) -> void:
    # ... same as base ...
    if data.is_boss and _state == State.ATTACKING:
        _boss_ability_timer -= dt
        if _boss_ability_timer <= 0.0:
            _execute_boss_ability()
            _boss_ability_timer = data.boss_ability_cooldown

func _execute_boss_ability() -> void:
    # bigboss: ground slam AoE around self
    # miniboss: charge toward nearest hero
    match data.id:
        &"miniboss": _boss_charge()
        &"bigboss": _boss_slam()

func _boss_charge() -> void:
    if _target_hero == null:
        return
    var dir := (_target_hero.global_position - global_position).normalized()
    velocity = dir * _speed * 3.5   # short burst; decays next frames

func _boss_slam() -> void:
    var radius := 180.0
    for hero in GameState.heroes:
        if hero.is_alive():
            var dist := global_position.distance_to(hero.global_position)
            if dist <= radius:
                var kb := (hero.global_position - global_position).normalized() * 200.0
                hero.take_damage(_damage * 1.5, kb)
```

---

## Collision Layers

| Layer | Bit | Used for |
|-------|-----|---------|
| Heroes | 1 | Hero CollisionShape2D and HitArea |
| Enemies | 2 | Enemy CollisionShape2D and HitBox |
| Projectiles | 3 | Projectile bodies |
| Loot | 4 | LootPickup areas |

Set `collision_layer` and `collision_mask` accordingly:
- Enemy body: layer 2, mask 1 (collides with heroes for physics, not with other enemies by default)
- Enemy HitBox Area2D: layer 2, mask 0 (queried by hero click detection)
- Enemy AttackArea Area2D: layer 0, mask 1 (detects heroes for attack range)

---

## Worm / Snake Visual Notes

Since sprites will be provided externally, the `AnimationPlayer` should have stubs for:
- `idle` — slow body wave
- `walk` — faster body wave + segment trailing
- `attack` — lunge forward
- `death` — collapse/dissolve

The `AnimationPlayer` is connected to the `Sprite2D` which uses a spritesheet. The exact frame
layout is defined by the asset pipeline (see SDD-12).

---

## Dependencies

- `GameTime` — movement and stun use `GameTime.delta`
- `GameState.heroes` — target finding
- `DifficultyConfig.data` — scale multipliers at configure time
- `AssetRegistry` — sprite assignment
- `EventBus` — `enemy_died` signal
- `LootSystem` — `roll_drop()` call on death

---

## LLM Prompt

```
You are implementing the Enemy System for P-RAY, a Godot 4.4 GDScript game.

Enemies are worm/snake mutant creatures that pursue and attack heroes. They share a single
base scene (Enemy.tscn) configured by EnemyResource data files. Time only flows when heroes
move (GameTime.delta).

Task:
1. Create Enemy.tscn with the node tree from SDD-06.
2. Implement Enemy.gd in full as shown, including the boss behavior additions.
3. Create all seven EnemyResource .tres files with the stats from the table in SDD-06.
4. Set collision layers as specified.
5. Wire EventBus.enemy_died emission in _die().
6. Add stub AnimationPlayer animations (idle, walk, attack, death) — no keyframes needed yet.

Rules:
- All simulation uses GameTime.delta; raw delta is never passed to AI or attack logic.
- Stun timer ticks game-time only, so it doesn't count down while game is frozen.
- Difficulty multipliers are applied at configure() time, not inside _process.
- Enemy _find_nearest_hero() reads GameState.heroes — never holds direct node references
  beyond what is needed for the current frame.

[paste SDD-00, SDD-02, SDD-06 here]
```
