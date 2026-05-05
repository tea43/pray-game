# SDD-14: Story Mode

## Purpose

Defines every Story Mode-exclusive system: hero discovery, squad shared inventory, patrol/ambush
enemy model, cutscene/observation triggers, mission progression, and the mission shell resource
that gives designers control over generated maps without writing code.

---

## Design Pillars

1. **Start alone, grow the squad** — each mission or story beat can introduce new heroes and
   abilities. The world feels larger as the squad expands.
2. **Everything is shared** — no hero "owns" an item permanently. Weapons, consumables, and
   temporary pickups all live in a squad pool and can be handed off mid-mission.
3. **Patrol/Ambush** — enemies have patrol routes and detection. Stealth is an option.
   Engagement is optional in some areas; mandatory in others. Cascading alerts raise stakes.
4. **Designer-controlled, generator-detailed** — you place the landmarks and rules; the generator
   fills the rest. Missions feel authored, not random.
5. **Story through observation** — key story moments happen when heroes reach trigger zones.
   Time freezes, camera pans, text or dialogue plays, then control returns.

---

## MissionResource (The Mission Shell)

The designer authors one `MissionResource` per mission. This is the contract between you and the
generator. It defines the constraints; the generator respects them.

```gdscript
# res://scripts/resources/MissionResource.gd
class_name MissionResource extends Resource

@export_group("Identity")
@export var mission_id: StringName
@export var chapter: int = 1
@export var display_title: String
@export var story_context: String     # brief text description for designer reference

@export_group("Squad")
@export var starting_hero: StringName = &"elliot"
@export var discoverable_heroes: Array[HeroDiscoveryData] = []

@export_group("Map Shape")
@export var map_width_tiles: int = 80
@export var map_height_tiles: int = 60
@export var start_zone: Rect2i          # tile coords; heroes spawn here
@export var end_zone: Rect2i            # reaching this triggers mission complete
@export var path_count: int = 2         # designer-specified number of viable routes A→B

@export_group("Terrain Rules")
@export var biome: StringName = &"wasteland"   # drives tile palette and props
@export var terrain_rules: Array[TerrainRule] = []   # landmarks the generator must place

@export_group("Enemy Pods")
@export var pod_templates: Array[PodTemplate] = []   # pods the generator places on map

@export_group("Loot Rules")
@export var loot_density: float = 1.0           # multiplier on loot scatter density
@export var guaranteed_loot_zones: Array[LootZoneData] = []

@export_group("Events")
@export var observation_zones: Array[ObservationZone] = []
@export var story_triggers: Array[StoryTrigger] = []

@export_group("Narrative")
@export var intro_text: String = ""
@export var outro_text: String = ""
@export var ambient_log_entries: Array[String] = []   # scattered text pickups
```

---

## Terrain Rule Resource

Each `TerrainRule` describes one designer-placed landmark. The generator reads these and
ensures they appear in approximately the specified location and style.

```gdscript
# res://scripts/resources/TerrainRule.gd
class_name TerrainRule extends Resource

enum LandmarkType {
    LAKE,           # impassable water body; shapes paths around it
    RIVER,          # narrow water crossing; may have bridges
    WALL_LINE,      # ruined concrete/stone wall; provides cover
    BUILDING_CLUSTER, # group of damaged buildings; interior corridors
    ROAD,           # wide navigable path; faster movement (future)
    CRATER,         # explosion pit; partial cover on edges
    DENSE_RUBBLE,   # slows movement, provides heavy cover
    OPEN_FIELD,     # generator avoids placing obstacles here
    CHOKE_POINT,    # narrow passage; generator funnels one path through it
    ELEVATED_RUIN,  # raised platform; future line-of-sight advantage
}

@export var type: LandmarkType
@export var center_normalized: Vector2   # 0..1 relative to map size
@export var size_normalized: Vector2     # 0..1 relative to map size
@export var rotation_deg: float = 0.0
@export var required: bool = true        # if false, generator may skip if layout conflicts
@export var style_hint: StringName = &"" # e.g. "industrial", "organic" — drives tile choice
@export var notes: String = ""           # designer notes; not used by generator
```

---

## Hero Discovery System

Heroes 2 and 3 are placed on the map as `HeroDiscoveryPoint` nodes. When the squad reaches
one, the hero joins.

```gdscript
# res://scripts/resources/HeroDiscoveryData.gd
class_name HeroDiscoveryData extends Resource

@export var hero_id: StringName                   # "dick", "habib", etc.
@export var placement: Vector2                    # world-space position (set by generator within a zone)
@export var discovery_zone: Rect2i               # tile rect; generator places this anywhere inside
@export var initial_weapon: WeaponResource        # weapon they carry when found
@export var unlock_ability: bool = true           # if true, their ability is acquired on join
@export var discovery_cutscene: ObservationZone  # plays when found
@export var condition: StringName = &""           # if set, required trigger before discoverable
```

```gdscript
# res://scenes/systems/HeroDiscovery.gd
class_name HeroDiscovery extends Node

const HERO_SCENE := preload("res://scenes/heroes/Hero.tscn")

var _pending: Array[HeroDiscoveryData] = []

func _ready() -> void:
    var mission: MissionResource = GameState.current_mission
    _pending = mission.discoverable_heroes.duplicate()

func _process(_raw_delta: float) -> void:
    var dt := GameTime.delta
    if dt == 0.0 or _pending.is_empty():
        return
    for hero in GameState.heroes:
        if not hero.is_alive():
            continue
        for i in range(_pending.size() - 1, -1, -1):
            var data := _pending[i]
            if hero.global_position.distance_to(data.placement) < 120.0:
                _discover_hero(data)
                _pending.remove_at(i)

func _discover_hero(data: HeroDiscoveryData) -> void:
    var res: HeroResource = load("res://data/heroes/%s.tres" % data.hero_id)
    # If discovery has a weapon, give it; else use default
    if data.initial_weapon:
        res = res.duplicate(true)
        res.default_weapon = data.initial_weapon
    # If ability locked, clear it until discovery gives it
    if not data.unlock_ability:
        res = res.duplicate(true)
        res.ability = null

    var hero: Hero = HERO_SCENE.instantiate()
    get_tree().current_scene.find_child("Heroes").add_child(hero)
    hero.global_position = data.placement
    hero.configure(res)
    GameState.heroes.append(hero)
    EventBus.hero_discovered.emit(hero)

    if data.discovery_cutscene:
        CutsceneSystem.play(data.discovery_cutscene)
```

Add to EventBus:
```gdscript
signal hero_discovered(hero: Hero)
```

---

## Squad Shared Inventory

In Story Mode all items belong to the squad, not to individual heroes. A hero picks up an item
and it enters the squad pool. Any hero can then use or equip it.

```gdscript
# res://scripts/SquadInventory.gd
class_name SquadInventory extends RefCounted

## All items currently held by the squad.
var items: Array[SquadItem] = []

## Add an item when a hero picks it up.
func add(loot: LootResource) -> void:
    var existing := _find(loot.id)
    if existing:
        existing.quantity += 1
    else:
        var item := SquadItem.new()
        item.loot = loot
        item.quantity = 1
        items.append(item)
    EventBus.squad_inventory_changed.emit()

## Remove one instance of an item (returns false if not available).
func consume(loot_id: StringName) -> bool:
    var item := _find(loot_id)
    if item == null or item.quantity <= 0:
        return false
    item.quantity -= 1
    if item.quantity == 0:
        items.erase(item)
    EventBus.squad_inventory_changed.emit()
    return true

## Give a weapon from one hero to another.
func transfer_weapon(from_hero: Hero, to_hero: Hero) -> void:
    var weapon_a := from_hero.get_weapon()
    var weapon_b := to_hero.get_weapon()
    var timer_a := from_hero.get_temp_timer()
    var timer_b := to_hero.get_temp_timer()
    from_hero.equip_weapon_with_timer(weapon_b, timer_b)
    to_hero.equip_weapon_with_timer(weapon_a, timer_a)
    EventBus.squad_inventory_changed.emit()

## Apply a consumable from the squad pool to a specific hero.
func use_on_hero(loot_id: StringName, hero: Hero) -> bool:
    var loot := _get_loot_resource(loot_id)
    if loot == null:
        return false
    if not consume(loot_id):
        return false
    LootApplicator.apply(loot, hero)
    return true

func _find(id: StringName) -> SquadItem:
    for item in items:
        if item.loot.id == id:
            return item
    return null

func _get_loot_resource(id: StringName) -> LootResource:
    var item := _find(id)
    return item.loot if item else null
```

```gdscript
# res://scripts/resources/SquadItem.gd
class_name SquadItem extends RefCounted

var loot: LootResource
var quantity: int = 1
```

### LootSystem in Story Mode

Loot pickups no longer call `LootApplicator.apply()` directly. Instead:

```gdscript
# In LootPickup.gd — Story Mode override
func collected_by(hero: Hero) -> void:
    if _collected:
        return
    _collected = true
    if GameState.current_mode == GameState.GameMode.STORY:
        GameState.squad_inventory.add(_loot)
        EventBus.hero_picked_up_loot.emit(hero, _loot.id)
        # Consumable weapons auto-equip if hero has no temp weapon
        if _loot.effect_type == &"weapon" and not hero.get_weapon().is_temporary:
            hero.equip_weapon(_loot.weapon_grant)
    else:
        LootApplicator.apply(_loot, hero)
        EventBus.hero_picked_up_loot.emit(hero, _loot.id)
    queue_free()
```

Add to EventBus:
```gdscript
signal squad_inventory_changed()
```

---

## Patrol / Ambush Enemy Model

### Pod Architecture

An "enemy pod" is a group of 2–6 enemies that share awareness state. The designer (or generator)
places `PodTemplate` resources on the map. At mission start, `PatrolSystem` instantiates them.

```gdscript
# res://scripts/resources/PodTemplate.gd
class_name PodTemplate extends Resource

enum AlertBehavior { PATROL, STATIONARY, ROAMING, ALWAYS_ALERT }

@export var enemy_types: Array[EnemyResource]  # which enemies are in this pod
@export var count_range: Vector2i = Vector2i(2, 4)  # min/max pod size; generator picks
@export var placement_zone: Rect2i             # tile rect; generator places within this
@export var patrol_type: AlertBehavior = AlertBehavior.PATROL
@export var patrol_radius: float = 300.0       # how far from spawn point they patrol
@export var detection_radius: float = 200.0    # individual enemy line-of-sight radius
@export var alert_radius: float = 400.0        # sound propagation radius for alerts
@export var required_clear: bool = false       # must be eliminated to proceed
@export var reinforcement_pod: PodTemplate     # if set, spawns when this pod alerts
```

### Enemy AI States (Story Mode Extension of SDD-06)

Story Mode adds states to the Enemy AI state machine:

```
IDLE → PATROLLING → SUSPICIOUS → ALERTED → ATTACKING → SEARCHING → RETURNING → IDLE
```

| State | Behavior |
|-------|---------|
| `PATROLLING` | Follows waypoint list; loops at end |
| `SUSPICIOUS` | Moves toward last known sound/position; plays "?" indicator |
| `ALERTED` | Calls alert to pod, enters combat; plays "!" indicator |
| `ATTACKING` | Same as Arena Mode ATTACKING |
| `SEARCHING` | Lost sight; sweeps area in expanding arcs for `search_duration` |
| `RETURNING` | Walking back to patrol route |

```gdscript
# Enemy.gd Story Mode additions (extend the existing State enum)

enum State {
    IDLE, PURSUING, ATTACKING, STUNNED, DEAD,  # Arena states (keep)
    PATROLLING, SUSPICIOUS, ALERTED, SEARCHING, RETURNING  # Story additions
}

var _patrol_waypoints: Array[Vector2] = []
var _patrol_index: int = 0
var _patrol_return_pos: Vector2
var _last_known_hero_pos: Vector2
var _search_timer: float = 0.0
var _suspicious_timer: float = 0.0
var _pod: PatrolPod = null   # owning pod; null in Arena mode

const SUSPICIOUS_DURATION: float = 2.5
const SEARCH_DURATION: float = 8.0

func set_patrol_waypoints(waypoints: Array[Vector2]) -> void:
    _patrol_waypoints = waypoints
    _patrol_return_pos = waypoints[0] if not waypoints.is_empty() else global_position
    _transition(State.PATROLLING)

func _process_state(dt: float) -> void:
    match _state:
        # ... existing Arena states ...
        State.PATROLLING:   _process_patrol(dt)
        State.SUSPICIOUS:   _process_suspicious(dt)
        State.ALERTED:      _transition(State.ATTACKING)
        State.SEARCHING:    _process_searching(dt)
        State.RETURNING:    _process_returning(dt)

func _process_patrol(dt: float) -> void:
    if _patrol_waypoints.is_empty():
        return
    var target := _patrol_waypoints[_patrol_index]
    var dist := global_position.distance_to(target)
    if dist < 8.0:
        _patrol_index = (_patrol_index + 1) % _patrol_waypoints.size()
    else:
        var dir := (target - global_position).normalized()
        velocity = dir * _speed * 0.6   # slower while patrolling

func _check_detection(dt: float) -> void:
    # Called every frame regardless of state
    if _state in [State.ALERTED, State.ATTACKING, State.STUNNED, State.DEAD]:
        return
    var detected_hero := _find_hero_in_los()
    if detected_hero:
        _last_known_hero_pos = detected_hero.global_position
        if _state == State.SUSPICIOUS:
            _suspicious_timer += dt * 2.0   # faster alert when moving toward
        if _state != State.SUSPICIOUS:
            _suspicious_timer = 0.0
            _transition(State.SUSPICIOUS)
        if _suspicious_timer >= SUSPICIOUS_DURATION:
            _raise_alert()
    elif _state == State.SUSPICIOUS:
        _suspicious_timer -= dt
        if _suspicious_timer <= 0.0:
            _transition(State.RETURNING)

func _raise_alert() -> void:
    _transition(State.ALERTED)
    if _pod:
        _pod.receive_alert(self, _last_known_hero_pos)

func _find_hero_in_los() -> Hero:
    for hero in GameState.heroes:
        if not hero.is_alive():
            continue
        var dist := global_position.distance_to(hero.global_position)
        if dist > _pod.detection_radius if _pod else 200.0:
            continue
        # Line-of-sight raycast
        var space := get_world_2d().direct_space_state
        var query := PhysicsRayQueryParameters2D.create(
            global_position, hero.global_position, 0b10000)  # layer 5: terrain_solid
        var result := space.intersect_ray(query)
        if result.is_empty():
            return hero   # clear line of sight
    return null

func _process_suspicious(dt: float) -> void:
    # Move toward last known position while suspicious
    var dir := (_last_known_hero_pos - global_position).normalized()
    velocity = dir * _speed * 0.8

func _process_searching(dt: float) -> void:
    _search_timer -= dt
    # Sweep arcs — simplified: random walk near last known pos
    if randf() < 0.02:
        var offset := Vector2(randf_range(-150, 150), randf_range(-150, 150))
        _last_known_hero_pos = _patrol_return_pos + offset
    var dir := (_last_known_hero_pos - global_position).normalized()
    velocity = dir * _speed * 0.5
    if _search_timer <= 0.0:
        _transition(State.RETURNING)

func _process_returning(dt: float) -> void:
    var dist := global_position.distance_to(_patrol_return_pos)
    if dist < 8.0:
        _patrol_index = 0
        _transition(State.PATROLLING)
    else:
        var dir := (_patrol_return_pos - global_position).normalized()
        velocity = dir * _speed * 0.7

func _transition(new_state: State) -> void:
    _state = new_state
    match new_state:
        State.SEARCHING:
            _search_timer = SEARCH_DURATION
        State.ATTACKING:
            _attack_timer = 0.0
```

### PatrolPod

A pod is a Node that owns a group of enemies and coordinates their shared alert state.

```gdscript
# res://scenes/world/PatrolPod.gd
class_name PatrolPod extends Node2D

var enemies: Array[Enemy] = []
var detection_radius: float = 200.0
var alert_radius: float = 400.0
var template: PodTemplate

## Called by any enemy in this pod that has spotted a hero.
func receive_alert(alerting_enemy: Enemy, hero_pos: Vector2) -> void:
    for enemy in enemies:
        if not enemy.is_alive():
            continue
        var dist := alerting_enemy.global_position.distance_to(enemy.global_position)
        if dist <= alert_radius:
            enemy._last_known_hero_pos = hero_pos
            enemy._transition(Enemy.State.ALERTED)
    # Spawn reinforcements if template specifies
    if template.reinforcement_pod:
        PatrolSystem.spawn_reinforcement(template.reinforcement_pod, global_position)
    # Alert nearby pods (sound cascade)
    PatrolSystem.cascade_alert(self, hero_pos)

## Remove a dead enemy from the pod roster.
func on_enemy_died(enemy: Enemy) -> void:
    enemies.erase(enemy)
    if template.required_clear and enemies.is_empty():
        EventBus.required_pod_cleared.emit(self)
```

### PatrolSystem

```gdscript
# res://scenes/systems/PatrolSystem.gd
class_name PatrolSystem extends Node

const ENEMY_SCENE := preload("res://scenes/enemies/Enemy.tscn")
const POD_SCENE := preload("res://scenes/world/PatrolPod.tscn")

var _pods: Array[PatrolPod] = []

func initialise(mission: MissionResource) -> void:
    # Called by MissionLoader after map is generated
    # Generator has already set pod_template.placement to actual world positions
    for template in mission.pod_templates:
        _spawn_pod(template)

func _spawn_pod(template: PodTemplate) -> void:
    var pod: PatrolPod = POD_SCENE.instantiate()
    pod.template = template
    pod.detection_radius = template.detection_radius
    pod.alert_radius = template.alert_radius
    get_tree().current_scene.find_child("EnemyPods").add_child(pod)
    _pods.append(pod)

    var count := randi_range(template.count_range.x, template.count_range.y)
    var diff := DifficultyConfig.data
    for i in count:
        var res := template.enemy_types[randi() % template.enemy_types.size()]
        var enemy: Enemy = ENEMY_SCENE.instantiate()
        get_tree().current_scene.find_child("Enemies").add_child(enemy)
        enemy.configure(res, diff)
        enemy._pod = pod
        # Position enemies in a scatter around the pod center
        enemy.global_position = template.placement_zone_world_center() \
            + Vector2(randf_range(-60, 60), randf_range(-60, 60))
        # Generate patrol waypoints
        enemy.set_patrol_waypoints(_generate_waypoints(enemy.global_position, template))
        pod.enemies.append(enemy)
        enemy.died.connect(pod.on_enemy_died.bind(enemy))

func _generate_waypoints(origin: Vector2, template: PodTemplate) -> Array[Vector2]:
    if template.patrol_type == PodTemplate.AlertBehavior.STATIONARY:
        return [origin]
    var pts: Array[Vector2] = []
    var count := randi_range(2, 5)
    for i in count:
        var angle := TAU * float(i) / float(count)
        var radius := randf_range(template.patrol_radius * 0.4, template.patrol_radius)
        pts.append(origin + Vector2.from_angle(angle) * radius)
    return pts

func cascade_alert(source_pod: PatrolPod, hero_pos: Vector2) -> void:
    for pod in _pods:
        if pod == source_pod:
            continue
        if source_pod.global_position.distance_to(pod.global_position) \
           <= source_pod.alert_radius + pod.alert_radius:
            # Adjacent pod hears the alert
            for enemy in pod.enemies:
                if enemy.is_alive() and enemy._state not in \
                   [Enemy.State.ALERTED, Enemy.State.ATTACKING]:
                    enemy._last_known_hero_pos = hero_pos
                    enemy._transition(Enemy.State.SUSPICIOUS)

func spawn_reinforcement(template: PodTemplate, near: Vector2) -> void:
    var modified := template.duplicate()
    modified.placement_zone = Rect2i(
        Vector2i(near / 64) + Vector2i(-4, -4), Vector2i(8, 8))
    _spawn_pod(modified)
```

---

## Cutscene / Observation System

Time freezes, camera pans to a point of interest, text or dialogue plays, then control returns.

```gdscript
# res://scripts/resources/ObservationZone.gd
class_name ObservationZone extends Resource

enum TriggerBy { HERO_ENTERS, REQUIRED_POD_CLEARED, STORY_FLAG }

@export var id: StringName
@export var trigger: TriggerBy = TriggerBy.HERO_ENTERS
@export var trigger_zone: Rect2i          # tile rect; hero must enter this to trigger
@export var pan_target: Vector2           # world pos the camera moves to
@export var pan_duration: float = 1.5
@export var hold_duration: float = 3.0   # seconds camera stays at target
@export var dialogue_lines: Array[DialogueLine] = []
@export var story_flag_set: StringName = &""  # flag set after this plays
@export var one_shot: bool = true
```

```gdscript
# res://scripts/resources/DialogueLine.gd
class_name DialogueLine extends Resource

@export var speaker_id: StringName = &""   # empty = narration
@export var text: String = ""
@export var duration: float = 3.0          # auto-advance after this; 0 = wait for input
```

```gdscript
# res://scenes/systems/CutsceneSystem.gd
class_name CutsceneSystem extends Node

signal cutscene_finished(zone_id: StringName)

var _active: bool = false
var _camera: WorldCamera

func _ready() -> void:
    _camera = get_tree().current_scene.find_child("WorldCamera")

func play(zone: ObservationZone) -> void:
    if _active:
        return
    _active = true
    GameTime.manual_pause = true   # freeze game
    _run_cutscene(zone)

func _run_cutscene(zone: ObservationZone) -> void:
    # Pan camera
    var tween := create_tween()
    tween.tween_property(_camera, "global_position", zone.pan_target, zone.pan_duration)
    await tween.finished
    # Show dialogue
    for line in zone.dialogue_lines:
        HUD.show_dialogue(line)
        if line.duration > 0.0:
            await get_tree().create_timer(line.duration).timeout
        else:
            await HUD.dialogue_advanced
    # Hold
    await get_tree().create_timer(zone.hold_duration).timeout
    # Resume
    if zone.story_flag_set != &"":
        GameState.set_flag(zone.story_flag_set)
    GameTime.manual_pause = false
    _active = false
    cutscene_finished.emit(zone.id)
```

---

## Mission Progression

```gdscript
# res://scripts/resources/StoryTrigger.gd
class_name StoryTrigger extends Resource

enum TriggerType { ENTER_ZONE, FLAG_SET, ALL_PODS_CLEAR, HERO_FOUND }

@export var trigger_type: TriggerType
@export var trigger_zone: Rect2i
@export var required_flag: StringName
@export var outcome: StringName   # "mission_complete", "unlock_zone", "spawn_pod", etc.
@export var outcome_data: Dictionary = {}
```

```gdscript
# res://scenes/systems/MissionLoader.gd
class_name MissionLoader extends Node

var _flags: Dictionary = {}

func load_mission(mission: MissionResource) -> void:
    GameState.current_mission = mission
    # ProceduralMapGen generates the map from mission constraints (SDD-15)
    ProceduralMapGen.generate(mission)
    # Spawn starting hero
    _spawn_starting_hero(mission)
    # Initialise discovery system
    HeroDiscovery.initialise(mission)
    # Initialise patrol system
    PatrolSystem.initialise(mission)
    # Register observation zones
    CutsceneSystem.register_zones(mission.observation_zones)
    # Register story triggers
    _register_triggers(mission.story_triggers)
    # Show intro
    if mission.intro_text != "":
        HUD.show_narration(mission.intro_text)

func set_flag(flag: StringName) -> void:
    _flags[flag] = true
    _check_triggers()

func _check_triggers() -> void:
    pass  # iterates story triggers and fires outcomes
```

---

## Placeholder Story — Chapter Structure

The following is a narrative skeleton. Specific text and events will be authored later.
The structure is locked; the content is placeholder.

### Chapter 1 — "The Signal"
- **Start**: Elliot alone in a ruined outpost. Dawn.
- **Terrain rules**: single road heading north, two building clusters flanking, one lake to the
  west forcing the road east.
- **Pods**: 2 patrol pods on the road, 1 stationary at a chokepoint building.
- **Discovery**: Habib is found injured inside a building at the midpoint.
  His chain lightning is locked until Chapter 2.
- **Observation**: at a certain ridge, heroes observe a distant hive structure.
  (Camera pans, narration: "[placeholder: something ominous ahead]")
- **End zone**: reach the northern outpost wall.

### Chapter 2 — "The Crack Knight's Folly"
- **Start**: both heroes at outpost. Habib's chain lightning unlocks via story event.
- **Terrain rules**: open field with scattered craters, a wall line bisecting east-west,
  two breach points (chokepoints), dense rubble to the south.
- **Pods**: 4 pods, 1 always-alert at the wall breach, 1 roaming in the field.
- **Discovery**: Dick is found on the far side of the wall, pinned down.
- **Observation**: first view of the P-RAY field — glowing alien grass in a clearing.
  (Narration: "[placeholder: what is this substance and why does it matter]")
- **End zone**: reach the far tree line.

### Chapter 3 — "Into the Brood"
- **Start**: full squad of three.
- **Terrain rules**: dense urban ruins, two parallel roads, a river crossing with one bridge,
  elevated ruins on west flank.
- **Pods**: 5 pods including first miniboss pod (required clear to open gate).
- **Observation**: close-up of the alien worm hive entrance.
  (Narration: "[placeholder: what the squad discovers / decides]")
- **End zone**: enter the hive passage.

### Chapter 4 — "The Source"
- **Start**: inside the hive. Tight corridors.
- **Terrain rules**: no open fields, all enclosed passages, bioluminescent P-RAY veins on walls.
- **Pods**: 6 pods, final pod = bigboss + escort. Required clear.
- **Observation**: discovery of what P-RAY actually is.
  (Narration: "[placeholder: the revelation]")
- **End zone**: reach extraction beacon.
- **Outro**: helicopter extraction (same system as Arena Mode, reused).

---

## Dependencies

- `GameTime` — manual_pause for cutscene freeze
- `GameState` — hero roster, mode, flags
- `EventBus` — hero_discovered, squad_inventory_changed, required_pod_cleared
- `ProceduralMapGen` (SDD-15) — map generation
- `LootApplicator` — consumable use from inventory
- `WorldCamera` — cutscene pan
- `HUD` — narration, dialogue display

---

## LLM Prompt

```
You are implementing Story Mode for P-RAY, a Godot 4.4 GDScript game.

Story Mode is a patrol/ambush linear mission game. Heroes start alone and find squadmates
on the map. All items are shared in a squad inventory. Enemies patrol and react to detection.
Cutscenes play when heroes reach observation zones.

Task:
1. Implement MissionResource, TerrainRule, HeroDiscoveryData, PodTemplate, ObservationZone,
   DialogueLine, StoryTrigger, SquadItem as Resource classes.
2. Implement SquadInventory.gd (RefCounted, not a Node).
3. Implement HeroDiscovery.gd system node.
4. Extend Enemy.gd with Story Mode patrol states and _check_detection() (called in _process).
5. Implement PatrolPod.gd and PatrolSystem.gd.
6. Implement CutsceneSystem.gd with camera pan and dialogue flow.
7. Implement MissionLoader.gd.
8. Update LootPickup.collected_by() to branch on GameState.current_mode.
9. Create placeholder MissionResource .tres files for the four chapters in the story outline.
10. Add hero_discovered, squad_inventory_changed, required_pod_cleared signals to EventBus.

Rules:
- Patrol AI uses GameTime.delta — does not tick while game is frozen.
- CutsceneSystem sets GameTime.manual_pause = true to freeze during cutscenes.
- SquadInventory is created in GameState._ready() when mode == STORY, else null.
- PatrolPod does NOT own Enemy nodes (enemies are in the Enemies container);
  it only holds references.
- Enemy._pod is null in Arena mode — all Story patrol methods guard against null _pod.

[paste SDD-00, SDD-02, SDD-03, SDD-06, SDD-13, SDD-14 here]
```
