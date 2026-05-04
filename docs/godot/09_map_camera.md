# SDD-09: Map & Camera System

## Purpose

Defines the world-space map architecture and the squad-following camera. The map is non-static:
heroes travel through it while enemies attack from ahead and flanks. This SDD establishes
world-space conventions that every other system must follow.

---

## Core Principle

> All entity positions are world-space `Vector2` coordinates. No system may use screen fractions
> or viewport-relative positions for game logic.

The first playable build uses one large tile layout. Later versions stream map sections as heroes
advance (see Streaming section below). The architecture supports both — switching from static to
streamed requires only a change to `MapManager`, not to any entity system.

---

## Scene Structure

```
GameWorld (Node2D)
├── MapManager (Node)               ← script: MapManager.gd; owns map loading/streaming
│   └── MapLayer (TileMapLayer)     ← active tile layer
├── NavigationRegion2D              ← baked navmesh; rebaked when new section loads
├── SpawnZones (Node2D)             ← Marker2D children; world-space spawn positions
├── ExtractionZone (Area2D)         ← landing circle for helicopter
│   └── CollisionShape2D            ← circle radius ≈ 80
├── Containers (Node2D)
│   ├── Enemies (Node2D)
│   ├── Heroes (Node2D)
│   ├── Loot (Node2D)
│   └── Projectiles (Node2D)
└── WorldCamera (Camera2D)          ← script: WorldCamera.gd
```

---

## TileMapLayer Configuration

- Tile size: **64×64 px** (adjust to match provided tile assets).
- Map is pre-designed in the Godot TileMap editor; exported as a `.tscn` sub-scene loaded by
  `MapManager`.
- The initial playable area is **60×40 tiles** (3840×2560 px world-space).
- Tiles use a `PhysicsMaterial` with friction for ground; impassable tiles set a collision layer
  (layer 5: `terrain_solid`) that the `NavigationRegion2D` treats as obstacles.

---

## WorldCamera

The camera follows the **centroid** of all living heroes with smooth lag. It also enforces a
configurable boundary so it doesn't scroll outside the loaded map.

```gdscript
# res://scenes/world/WorldCamera.gd
class_name WorldCamera extends Camera2D

@export_group("Follow Settings")
@export var lag_speed: float = 4.0       # lower = more lag, higher = tighter follow
@export var dead_zone_radius: float = 40.0  # no movement if centroid within this radius of cam

@export_group("Bounds")
@export var bounds_margin: float = 200.0  # pixels inside map edge

var _heroes: Array[Hero] = []
var _map_rect: Rect2 = Rect2(Vector2.ZERO, Vector2(3840, 2560))

func set_hero_roster(heroes: Array[Hero]) -> void:
    _heroes = heroes

func set_map_bounds(rect: Rect2) -> void:
    _map_rect = rect
    limit_left = int(_map_rect.position.x + bounds_margin)
    limit_top = int(_map_rect.position.y + bounds_margin)
    limit_right = int(_map_rect.end.x - bounds_margin)
    limit_bottom = int(_map_rect.end.y - bounds_margin)

func _process(raw_delta: float) -> void:
    # Camera follows at engine speed (not game-time) so it feels responsive even when frozen.
    var target := _squad_centroid()
    if target == Vector2.INF:
        return
    var dist := global_position.distance_to(target)
    if dist < dead_zone_radius:
        return
    global_position = global_position.lerp(target, lag_speed * raw_delta)

func _squad_centroid() -> Vector2:
    var living: Array[Hero] = _heroes.filter(func(h): return h.is_alive())
    if living.is_empty():
        return Vector2.INF
    var sum := Vector2.ZERO
    for h in living:
        sum += h.global_position
    return sum / living.size()
```

> Camera uses `limit_left/top/right/bottom` (built-in Camera2D fields) to clamp the viewport.
> Set these after loading each map section.

---

## MapManager

Controls which map section is loaded. In the first build, it simply loads the single static
section. The streaming stub is included for future extension.

```gdscript
# res://scenes/world/MapManager.gd
class_name MapManager extends Node

signal section_loaded(rect: Rect2)

@export var initial_section: PackedScene  # the first (and currently only) map section

@onready var map_layer: TileMapLayer = $MapLayer
@onready var nav_region: NavigationRegion2D = get_parent().find_child("NavigationRegion2D")

func _ready() -> void:
    load_section(initial_section)

func load_section(section: PackedScene) -> void:
    # Clear existing tiles
    map_layer.clear()
    # Instantiate section and copy its TileMapLayer data
    var instance: Node = section.instantiate()
    var source_layer: TileMapLayer = instance.find_child("TileMapLayer")
    if source_layer:
        # Copy tile data — iterate used cells and set them on map_layer
        for cell in source_layer.get_used_cells():
            var src := source_layer.get_cell_source_id(cell)
            var atlas := source_layer.get_cell_atlas_coords(cell)
            var alt := source_layer.get_cell_alternative_tile(cell)
            map_layer.set_cell(cell, src, atlas, alt)
    instance.queue_free()

    # Bake navigation
    NavigationServer2D.bake_from_source_geometry_data(
        nav_region.navigation_polygon,
        NavigationMeshSourceGeometryData2D.new()
    )
    # Await bake (async in Godot 4.4)
    await NavigationServer2D.bake_finished

    var used_rect: Rect2i = map_layer.get_used_rect()
    var tile_size: Vector2 = map_layer.tile_set.tile_size if map_layer.tile_set else Vector2(64, 64)
    var world_rect := Rect2(
        Vector2(used_rect.position) * tile_size,
        Vector2(used_rect.size) * tile_size
    )
    section_loaded.emit(world_rect)

# --- Streaming stub (future use) ---
# func stream_next_section(direction: Vector2) -> void:
#     # Load adjacent section based on hero travel direction.
#     # Unload sections more than 2 sections behind.
#     pass
```

---

## SpawnZone Placement

`SpawnZones/` contains `Marker2D` nodes placed in the Godot editor at the edges of the map.
The `WaveSystem` picks a random marker each spawn. For streaming maps, each map section prefab
includes its own spawn zone markers that are added to the `SpawnZones` container on load.

Spawn zone naming convention: `SpawnZone_N_01`, `SpawnZone_E_01`, etc. (N/S/E/W for direction).
This allows future logic to prefer spawning enemies ahead of the heroes' direction of travel.

---

## ExtractionZone

When all waves clear, the helicopter lands at the `ExtractionZone`. Heroes must walk into it to
board.

```gdscript
# res://scenes/world/ExtractionZone.gd
class_name ExtractionZone extends Area2D

signal hero_boarded(hero: Hero)

var _boarding: Array[Hero] = []
var _active: bool = false

func activate(landing_position: Vector2) -> void:
    global_position = landing_position
    _active = true
    visible = true
    body_entered.connect(_on_body_entered)
    body_exited.connect(_on_body_exited)

func _on_body_entered(body: Node2D) -> void:
    if not _active or not body is Hero:
        return
    var hero := body as Hero
    if not _boarding.has(hero):
        _boarding.append(hero)
        hero_boarded.emit(hero)
        EventBus.hero_boarded_helicopter.emit(hero)

func _on_body_exited(body: Node2D) -> void:
    if body is Hero:
        _boarding.erase(body)
```

The `GameWorld` listens to `EventBus.all_waves_cleared` to activate the extraction zone at the
map centre (or at a pre-placed `Marker2D` named `HelipadMarker`).

---

## NavigationRegion2D Setup

- Add `NavigationRegion2D` to `GameWorld`.
- Create a `NavigationPolygon` in the inspector covering the walkable area.
- Set the polygon to use `TileMapLayer` as the source geometry (Godot 4.4 supports this directly
  via `NavigationMeshSourceGeometryData2D` parsing).
- Enemies use `NavigationAgent2D` to path to heroes; blink teleport validates destination via
  `NavigationServer2D.map_get_closest_point()`.

---

## World-Space Coordinate Conventions

| Unit | Value |
|------|-------|
| 1 tile | 64×64 px |
| Typical arena | 60×40 tiles = 3840×2560 px |
| Hero move speed | 120–160 px/s |
| Detection radius | 800 px ≈ 12.5 tiles |
| Maximum ranged attack | 320 px ≈ 5 tiles |

All distances in SDD documents are in world-space pixels at this scale.

---

## Future: Scrolling Map

When the map becomes larger than a single screen section:

1. `MapManager.stream_next_section()` loads the adjacent `PackedScene` based on hero centroid
   moving within 5 tiles of a section boundary.
2. `SpawnZone` markers from the new section are added to the container.
3. `NavigationRegion2D` is expanded or a new `NavigationRegion2D` is added for the new section.
4. `WorldCamera.set_map_bounds()` is updated to the new total extent.
5. Enemies from the old section that fall outside a despawn radius (e.g. 2000 px behind squad)
   are freed to save memory.

No other system changes — all systems already use world-space positions.

---

## Dependencies

- `GameState.heroes` — camera follows living heroes
- `EventBus.all_waves_cleared` — triggers extraction zone activation
- `EventBus.hero_boarded_helicopter` — WaveSystem/GameState listens to determine victory

---

## LLM Prompt

```
You are implementing the Map and Camera System for P-RAY, a Godot 4.4 GDScript game.

The map is non-static: heroes travel through a world-space tile map while enemies attack.
The camera follows the squad centroid with lag. All entity positions are world-space Vector2.

Task:
1. Create GameWorld.tscn with the full node tree from SDD-09.
2. Implement WorldCamera.gd with squad centroid following, dead zone, and Camera2D limits.
3. Implement MapManager.gd including the nav bake after section load.
4. Implement ExtractionZone.gd — activated when all_waves_cleared fires.
5. Create an initial static map section as a sub-scene (TileMapLayer with placeholder tiles).
6. Place 8 SpawnZone Marker2D nodes at map edges (2 per cardinal direction).
7. Wire EventBus.all_waves_cleared → ExtractionZone.activate() in GameWorld._ready().

Rules:
- Camera uses raw delta for smooth following independent of game-time freeze.
- NavigationRegion2D must be baked before enemies spawn (await bake_finished).
- TileMapLayer tile size: 64x64. Map size: 60x40 tiles minimum.
- ExtractionZone activates at HelipadMarker position if present, else map centre.

[paste SDD-00, SDD-09 here]
```
