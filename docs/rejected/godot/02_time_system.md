# SDD-02: Time System

## Purpose

Implements the movement-driven time flow mechanic — the single most important and unique rule of
P-RAY. When no hero is moving, game time freezes. All game systems consume `GameTime.delta`
instead of the engine's raw `delta`.

---

## The Rule

```
time flows  ←→  at least one hero is walking
time freezes ←→  all heroes are idle OR manual pause OR game over
```

Speed multiplier (x1, x2, x3) scales the rate of flow but does not start or stop it.

Priority order (highest first):
1. `is_game_over` → always frozen
2. `manual_pause` → frozen
3. `heroes_moving` → flowing at current speed multiplier
4. default → frozen

---

## Node / Scene Structure

`GameTime` is an **autoload singleton** (no scene). It runs in `_process` every frame.

```
Autoload: GameTime (Node)
```

No child nodes required.

---

## Full Implementation

```gdscript
# res://autoloads/GameTime.gd
class_name GameTime extends Node

## Emitted whenever the flow state changes (start/stop of time).
signal flow_changed(is_flowing: bool)
## Emitted each frame only when time is flowing, with the scaled delta.
signal ticked(game_delta: float)

const SPEED_STEPS: Array[float] = [1.0, 2.0, 3.0]

# --- State ---
var speed_index: int = 0
var manual_pause: bool = false
var is_game_over: bool = false
var heroes_moving: bool = false

# Space-hold override: while held >= 1 s, force flowing regardless of pause
var _space_hold_time: float = 0.0
var _space_hold_active: bool = false
const SPACE_HOLD_THRESHOLD: float = 1.0

## The scaled delta for the current frame. 0.0 when frozen.
var delta: float = 0.0

# Tracks previous flow state to detect transitions
var _was_flowing: bool = false

func _ready() -> void:
    process_mode = Node.PROCESS_MODE_ALWAYS   # runs even when SceneTree is "paused"

func _process(raw_delta: float) -> void:
    _update_space_hold(raw_delta)
    var flowing := _compute_flowing()
    delta = raw_delta * SPEED_STEPS[speed_index] if flowing else 0.0

    if flowing != _was_flowing:
        _was_flowing = flowing
        flow_changed.emit(flowing)

    if flowing:
        ticked.emit(delta)

# --- Public API ---

## Increase speed multiplier by one step (wraps at max).
func speed_up() -> void:
    speed_index = min(speed_index + 1, SPEED_STEPS.size() - 1)

## Decrease speed multiplier by one step (wraps at min).
func speed_down() -> void:
    speed_index = max(speed_index - 1, 0)

## Toggle manual pause on/off.
func toggle_pause() -> void:
    manual_pause = !manual_pause

## Called by the hero roster aggregator each frame with whether any hero is walking.
func notify_hero_moving(any_moving: bool) -> void:
    heroes_moving = any_moving

## Called by EventBus listener when game over fires.
func set_game_over() -> void:
    is_game_over = true

## Returns the current speed as a display label ("x1", "x2", "x3").
func speed_label() -> String:
    return "x%d" % int(SPEED_STEPS[speed_index])

func is_flowing() -> bool:
    return _compute_flowing()

# --- Internal ---

func _compute_flowing() -> bool:
    if is_game_over:
        return false
    if _space_hold_active:
        return true
    if manual_pause:
        return false
    return heroes_moving

func _update_space_hold(raw_delta: float) -> void:
    if Input.is_action_pressed(&"game_pause"):
        _space_hold_time += raw_delta
        if _space_hold_time >= SPACE_HOLD_THRESHOLD:
            _space_hold_active = true
    else:
        if _space_hold_time > 0.0 and _space_hold_time < SPACE_HOLD_THRESHOLD:
            # Tap (short press) — toggle pause
            toggle_pause()
        _space_hold_time = 0.0
        _space_hold_active = false
```

---

## Hero Movement Aggregator

The `GameTime` singleton needs to know if **any** hero is moving. This is computed by a small
coordinator that lives in the `Systems` node of the main scene.

```gdscript
# res://scenes/systems/HeroMovementMonitor.gd
class_name HeroMovementMonitor extends Node

## Set this reference after heroes are spawned.
var hero_roster: Array[Hero] = []

func _process(_delta: float) -> void:
    var any_moving := false
    for hero in hero_roster:
        if hero.is_alive() and hero.is_moving():
            any_moving = true
            break
    GameTime.notify_hero_moving(any_moving)
```

Add `HeroMovementMonitor` as a child of `Systems` in `GameWorld.tscn`. After heroes are spawned,
assign `hero_roster`.

---

## Hero Side: is_moving()

Each `Hero` node exposes this method used by the monitor:

```gdscript
# inside Hero.gd
func is_moving() -> bool:
    return velocity.length_squared() > 1.0
```

The hero's `_physics_process` must still run every frame (raw delta) to handle velocity damping
and arrive detection. Only the **simulation** (attacks, ability timers, AI, particles) uses
`GameTime.delta`. Movement itself always uses raw delta so the character never gets "stuck" in
a half-step when time freezes.

---

## How Other Systems Use GameTime

Every system that should freeze when heroes stop must:

```gdscript
func _process(_raw_delta: float) -> void:
    var dt := GameTime.delta      # 0.0 when frozen
    if dt == 0.0:
        return
    # ... simulation ...
```

Or connect to the `ticked` signal for event-driven systems:

```gdscript
func _ready() -> void:
    GameTime.ticked.connect(_on_tick)

func _on_tick(dt: float) -> void:
    # ... simulation ...
```

**Never** pass the raw `_delta` argument to simulation logic.

---

## Input Handling for Speed and Pause

The `InputRouter` system node handles these (not the hero, not the HUD):

```gdscript
# res://scenes/systems/InputRouter.gd
class_name InputRouter extends Node

func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed(&"speed_up"):
        GameTime.speed_up()
    elif event.is_action_pressed(&"speed_down"):
        GameTime.speed_down()
    # Space is handled inside GameTime._update_space_hold()
    # to distinguish tap vs. hold without relying on _input callbacks.
```

---

## Signals Summary

| Signal | When | Payload |
|--------|------|---------|
| `flow_changed(bool)` | Flow state transitions | `true` = now flowing |
| `ticked(float)` | Every frame while flowing | scaled delta |

---

## Dependencies

- None. `GameTime` is the lowest-level autoload; nothing it depends on is game-specific.

---

## Edge Cases

- **Hero dies mid-walk**: the dead hero no longer calls `is_moving()` (returns false when HP ≤ 0).
  The monitor picks this up next frame.
- **All heroes dead**: `is_game_over` is set by `EventBus.game_over` before `heroes_moving` can
  matter — the game freezes correctly.
- **Speed change while frozen**: `speed_index` updates immediately; the new rate applies on the
  next frame that has flowing time. No need to re-emit.
- **Reload**: `GameTime._ready()` resets all state because the autoload is re-initialized on
  scene reload.

---

## LLM Prompt

```
You are implementing the Time System for a Godot 4.4 GDScript game called P-RAY.

Context: The game's defining rule is "time only advances while at least one hero is moving."
All game simulation uses GameTime.delta (a float) instead of the engine's raw delta.
When frozen, GameTime.delta == 0.0.

Task:
1. Implement GameTime.gd exactly as shown in SDD-02 (pasted below). It is an autoload singleton.
2. Implement HeroMovementMonitor.gd as shown.
3. Add is_moving() to the Hero stub (Hero.gd need not be fully implemented yet, just the method).
4. Implement InputRouter.gd for speed_up/speed_down input.
5. Write a short integration test script (TestTimeSystem.gd, not autoloaded) that:
   - Instantiates a mock hero with is_moving() returning true/false
   - Verifies GameTime.delta > 0 when hero moving, == 0 when not
   - Verifies toggle_pause() freezes time regardless of hero state
   - Verifies speed_up/down changes SPEED_STEPS[speed_index]

Rules:
- No raw delta passed to simulation code anywhere.
- The Space key tap/hold distinction must work as described.
- GameTime runs with PROCESS_MODE_ALWAYS.

[paste SDD-00 and SDD-02 here]
```
