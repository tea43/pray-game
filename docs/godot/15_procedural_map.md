# SDD-15: Procedural Map Generation

## Purpose

Generates detailed mission maps from a designer-authored `MissionResource`. The designer
specifies constraints (landmarks, path count, biome, pod zones); the generator fills everything
else. The output is a fully navigable `TileMapLayer` with enemy pod positions, loot scatter
zones, and observation zone placements baked in.

---

## Design Contract

**What the designer controls:**
- Biome (tile palette, prop density, color mood)
- Mandatory landmarks: lake, river, wall line, building cluster, road, crater, choke point
- Path count A→B (how many viable routes heroes can take)
- Approximate landmark positions (normalized 0–1 coordinates on the map)
- Pod placement zones (tile rect where each pod must be placed)
- Start zone and end zone

**What the generator controls:**
- Exact shapes, sizes, and interior detail of landmarks
- Patrol waypoint paths within pod radius
- Loot scatter position within loot zones
- Tile variation and visual noise
- Connector roads/paths between landmarks
- Navigation-valid tile placement (no landlocked areas, no sealed exits)

---

## Generation Pipeline

The pipeline runs once per mission load. Steps execute in order; each step reads the output
of the previous.

```
Step 1: Base Noise Layer
    → Fill map with biome-specific base tiles using layered noise

Step 2: Apply Landmark Rules
    → For each TerrainRule in mission.terrain_rules:
        → Carve or raise the appropriate tile region
        → Mark cells as navigable or impassable in a separate bool grid

Step 3: Ensure Path Connectivity
    → Run A* from start_zone to end_zone
    → If no path found (landmark blocked all routes):
        → Widen the narrowest chokepoint until path exists
        → Repeat up to 3 times, then warn designer

Step 4: Carve Paths
    → For each of mission.path_count routes (A* variants with perturbation):
        → Widen navigable corridor along path to minimum width (6 tiles)
        → Place road tiles if route crosses a ROAD landmark zone

Step 5: Place Enemy Pods
    → For each PodTemplate in mission.pod_templates:
        → Find a navigable position within placement_zone
        → Confirm patrol radius is reachable
        → Write world-space center back into template (used by PatrolSystem)

Step 6: Scatter Loot
    → For each LootZoneData in mission.guaranteed_loot_zones:
        → Place LootPickup nodes in navigable cells within zone

Step 7: Place Observation Zones and Discovery Points
    → Validate each ObservationZone trigger_zone is reachable from start
    → Place HeroDiscovery markers at their discovery_zone center

Step 8: Bake Navigation
    → Build NavigationPolygon from navigable cell grid
    → Await bake

Step 9: Apply Visual Detail Layer
    → Add prop/rubble/decal tiles on navigable cells at density = biome.prop_density
    → Add visual-only edge tiles along impassable borders
```

---

## Core Data Structures

```gdscript
# res://scripts/procedural/MapGrid.gd
class_name MapGrid

var width: int
var height: int
var _cells: PackedByteArray   # 0 = navigable, 1 = impassable, 2 = water, 3 = road

func _init(w: int, h: int) -> void:
    width = w
    height = h
    _cells = PackedByteArray()
    _cells.resize(w * h)

func get_cell(x: int, y: int) -> int:
    if x < 0 or y < 0 or x >= width or y >= height:
        return 1   # out of bounds = impassable
    return _cells[y * width + x]

func set_cell(x: int, y: int, value: int) -> void:
    if x < 0 or y < 0 or x >= width or y >= height:
        return
    _cells[y * width + x] = value

func is_navigable(x: int, y: int) -> bool:
    return get_cell(x, y) == 0

func to_world(tile: Vector2i, tile_size: int = 64) -> Vector2:
    return Vector2(tile) * tile_size + Vector2(tile_size, tile_size) * 0.5
```

---

## ProceduralMapGen Autoload / System

```gdscript
# res://scenes/systems/ProceduralMapGen.gd
class_name ProceduralMapGen extends Node

const TILE_SIZE: int = 64

var _grid: MapGrid
var _map_layer: TileMapLayer
var _mission: MissionResource
var _biome: BiomeResource

func generate(mission: MissionResource) -> void:
    _mission = mission
    _biome = load("res://data/biomes/%s.tres" % mission.biome)
    _map_layer = get_tree().current_scene.find_child("MapLayer")
    _map_layer.clear()

    _grid = MapGrid.new(mission.map_width_tiles, mission.map_height_tiles)

    _step_base_noise()
    _step_landmarks()
    _step_paths()
    _step_pods()
    _step_loot()
    _step_observation_zones()
    _step_commit_tiles()
    await _step_bake_nav()
    _step_visual_detail()

# --- Step 1: Base Noise ---

func _step_base_noise() -> void:
    var noise := FastNoiseLite.new()
    noise.seed = randi()
    noise.frequency = 0.04
    for y in _grid.height:
        for x in _grid.width:
            var v: float = noise.get_noise_2d(x, y)
            # High noise value = impassable (rock, rubble wall)
            _grid.set_cell(x, y, 1 if v > _biome.impassable_threshold else 0)

# --- Step 2: Landmarks ---

func _step_landmarks() -> void:
    for rule in _mission.terrain_rules:
        if not rule.required and randf() < 0.15:
            continue  # optional landmark; occasionally skip
        _apply_landmark(rule)

func _apply_landmark(rule: TerrainRule) -> void:
    var cx := int(rule.center_normalized.x * _grid.width)
    var cy := int(rule.center_normalized.y * _grid.height)
    var hw := int(rule.size_normalized.x * _grid.width / 2.0)
    var hh := int(rule.size_normalized.y * _grid.height / 2.0)

    match rule.type:
        TerrainRule.LandmarkType.LAKE:
            _carve_lake(cx, cy, hw, hh)
        TerrainRule.LandmarkType.RIVER:
            _carve_river(cx, cy, rule)
        TerrainRule.LandmarkType.WALL_LINE:
            _place_wall(cx, cy, hw, hh, rule.rotation_deg)
        TerrainRule.LandmarkType.BUILDING_CLUSTER:
            _place_buildings(cx, cy, hw, hh, rule.style_hint)
        TerrainRule.LandmarkType.ROAD:
            _place_road(cx, cy, hw, hh, rule.rotation_deg)
        TerrainRule.LandmarkType.CRATER:
            _carve_crater(cx, cy, max(hw, hh))
        TerrainRule.LandmarkType.OPEN_FIELD:
            _clear_field(cx, cy, hw, hh)
        TerrainRule.LandmarkType.CHOKE_POINT:
            _place_choke(cx, cy, hw, hh)

func _carve_lake(cx: int, cy: int, hw: int, hh: int) -> void:
    var noise := FastNoiseLite.new()
    noise.seed = randi()
    noise.frequency = 0.1
    for y in range(cy - hh, cy + hh):
        for x in range(cx - hw, cx + hw):
            var nx := float(x - cx) / float(hw)
            var ny := float(y - cy) / float(hh)
            var ellipse := nx * nx + ny * ny
            if ellipse < 1.0 + noise.get_noise_2d(x, y) * 0.3:
                _grid.set_cell(x, y, 2)   # water

func _place_wall(cx: int, cy: int, hw: int, hh: int, rot_deg: float) -> void:
    # Wall is a thick line; gaps every ~12 tiles
    var angle := deg_to_rad(rot_deg)
    var right := Vector2.from_angle(angle)
    var len := hw * 2
    var gap_interval := 12
    for i in len:
        if i % gap_interval in range(2, 4):
            continue   # gap in the wall
        var pos := Vector2(cx, cy) + right * float(i - hw)
        for thickness in range(-1, 2):
            var perp := Vector2.from_angle(angle + PI / 2.0) * thickness
            var tp := pos + perp
            _grid.set_cell(int(tp.x), int(tp.y), 1)

func _place_buildings(cx: int, cy: int, hw: int, hh: int, style: StringName) -> void:
    var count := randi_range(3, 8)
    for _i in count:
        var bx := cx + randi_range(-hw, hw)
        var by := cy + randi_range(-hh, hh)
        var bw := randi_range(3, 6)
        var bh := randi_range(3, 6)
        # Outer walls impassable, interior navigable (ruins = open interior)
        for y in range(by, by + bh):
            for x in range(bx, bx + bw):
                var on_wall := (x == bx or x == bx + bw - 1 or
                                y == by or y == by + bh - 1)
                _grid.set_cell(x, y, 1 if on_wall else 0)
        # One gap in each wall face
        _grid.set_cell(bx + bw / 2, by, 0)
        _grid.set_cell(bx + bw / 2, by + bh - 1, 0)

func _place_road(cx: int, cy: int, hw: int, _hh: int, rot_deg: float) -> void:
    var angle := deg_to_rad(rot_deg)
    var right := Vector2.from_angle(angle)
    for i in hw * 2:
        var pos := Vector2(cx, cy) + right * float(i - hw)
        for lane in range(-2, 3):
            var perp := Vector2.from_angle(angle + PI / 2.0) * lane
            var tp := pos + perp
            _grid.set_cell(int(tp.x), int(tp.y), 3)   # road

func _carve_crater(cx: int, cy: int, r: int) -> void:
    for y in range(cy - r, cy + r):
        for x in range(cx - r, cx + r):
            var d := Vector2(x - cx, y - cy).length()
            if d < r * 0.6:
                _grid.set_cell(x, y, 0)   # navigable pit floor
            elif d < r:
                _grid.set_cell(x, y, 0)   # crater rim — navigable but visual

func _clear_field(cx: int, cy: int, hw: int, hh: int) -> void:
    for y in range(cy - hh, cy + hh):
        for x in range(cx - hw, cx + hw):
            _grid.set_cell(x, y, 0)

func _carve_river(cx: int, cy: int, rule: TerrainRule) -> void:
    # Simple vertical river with one bridge crossing
    var noise := FastNoiseLite.new()
    noise.seed = randi()
    noise.frequency = 0.05
    for y in _grid.height:
        var offset := int(noise.get_noise_1d(y) * 4)
        for w in range(-2, 3):
            _grid.set_cell(cx + w + offset, y, 2)
    # Bridge
    var bridge_y := int(_grid.height * 0.5)
    for w in range(-2, 3):
        _grid.set_cell(cx + w, bridge_y, 3)   # road over water

func _place_choke(cx: int, cy: int, hw: int, hh: int) -> void:
    # Fill with impassable walls except for one 3-wide corridor
    for y in range(cy - hh, cy + hh):
        for x in range(cx - hw, cx + hw):
            _grid.set_cell(x, y, 1)
    # Corridor at center
    for y in range(cy - hh, cy + hh):
        for w in range(-1, 2):
            _grid.set_cell(cx + w, y, 0)

# --- Step 3 & 4: Path Connectivity ---

func _step_paths() -> void:
    var start := _rect_center(_mission.start_zone)
    var end_c := _rect_center(_mission.end_zone)
    for i in _mission.path_count:
        var perturb := Vector2i(randi_range(-8, 8), randi_range(-8, 8))
        var waypoint := Vector2i(
            (start.x + end_c.x) / 2 + perturb.x,
            (start.y + end_c.y) / 2 + perturb.y)
        _carve_corridor(start, waypoint, 4)
        _carve_corridor(waypoint, end_c, 4)

func _carve_corridor(a: Vector2i, b: Vector2i, width: int) -> void:
    # Bresenham walk with width
    var dx := abs(b.x - a.x)
    var dy := abs(b.y - a.y)
    var sx := 1 if a.x < b.x else -1
    var sy := 1 if a.y < b.y else -1
    var x := a.x; var y := a.y
    var err := dx - dy
    while true:
        for wx in range(-width / 2, width / 2 + 1):
            for wy in range(-width / 2, width / 2 + 1):
                if _grid.get_cell(x + wx, y + wy) != 2:  # don't carve through water
                    _grid.set_cell(x + wx, y + wy, 0)
        if x == b.x and y == b.y:
            break
        var e2 := err * 2
        if e2 > -dy:
            err -= dy; x += sx
        if e2 < dx:
            err += dx; y += sy

# --- Step 5: Pods ---

func _step_pods() -> void:
    for template in _mission.pod_templates:
        var zone := template.placement_zone
        var pos := _find_navigable_in_rect(zone)
        template.placement_zone_center_cache = pos   # store for PatrolSystem

func _find_navigable_in_rect(zone: Rect2i) -> Vector2i:
    for _attempt in 20:
        var x := randi_range(zone.position.x, zone.position.x + zone.size.x)
        var y := randi_range(zone.position.y, zone.position.y + zone.size.y)
        if _grid.is_navigable(x, y):
            return Vector2i(x, y)
    return zone.get_center()  # fallback

# --- Step 6: Loot Scatter ---

func _step_loot() -> void:
    for loot_zone in _mission.guaranteed_loot_zones:
        var pos := _find_navigable_in_rect(loot_zone.zone)
        LootSystem.spawn_at(_grid.to_world(pos), loot_zone.loot)

# --- Step 7: Observation Zones ---

func _step_observation_zones() -> void:
    pass  # zones are trigger areas checked by CutsceneSystem at runtime; no placement needed

# --- Step 8: Commit Tiles ---

func _step_commit_tiles() -> void:
    for y in _grid.height:
        for x in _grid.width:
            var cell := _grid.get_cell(x, y)
            var tile_id := _biome.tile_id_for_cell(cell)
            _map_layer.set_cell(Vector2i(x, y), tile_id.source, tile_id.coords, tile_id.alt)

# --- Step 9: Bake Navigation ---

func _step_bake_nav() -> void:
    var nav: NavigationRegion2D = get_tree().current_scene.find_child("NavigationRegion2D")
    NavigationServer2D.bake_from_source_geometry_data(
        nav.navigation_polygon, NavigationMeshSourceGeometryData2D.new())
    await NavigationServer2D.bake_finished

# --- Step 10: Visual Detail ---

func _step_visual_detail() -> void:
    # Scatter prop tiles (visual only, no collision)
    var noise := FastNoiseLite.new()
    noise.seed = randi()
    noise.frequency = 0.08
    for y in _grid.height:
        for x in _grid.width:
            if _grid.is_navigable(x, y) and noise.get_noise_2d(x, y) > _biome.prop_threshold:
                var prop := _biome.random_prop_tile()
                if prop.source >= 0:
                    _map_layer.set_cell(Vector2i(x, y), prop.source, prop.coords, prop.alt)

# --- Helpers ---

func _rect_center(r: Rect2i) -> Vector2i:
    return r.position + r.size / 2
```

---

## BiomeResource

```gdscript
# res://scripts/resources/BiomeResource.gd
class_name BiomeResource extends Resource

@export var id: StringName

@export_group("Generation Parameters")
@export var impassable_threshold: float = 0.35   # noise value above which = solid
@export var prop_threshold: float = 0.55
@export var prop_density: float = 0.3

@export_group("Tile Mapping")
# Each entry maps cell type (0=navigable,1=solid,2=water,3=road) to tile atlas coordinates
@export var navigable_tiles: Array[TileRef] = []
@export var impassable_tiles: Array[TileRef] = []
@export var water_tiles: Array[TileRef] = []
@export var road_tiles: Array[TileRef] = []
@export var prop_tiles: Array[TileRef] = []

func tile_id_for_cell(cell_type: int) -> TileRef:
    var pool: Array[TileRef]
    match cell_type:
        0: pool = navigable_tiles
        1: pool = impassable_tiles
        2: pool = water_tiles
        3: pool = road_tiles
        _: pool = navigable_tiles
    if pool.is_empty():
        return TileRef.new()
    return pool[randi() % pool.size()]

func random_prop_tile() -> TileRef:
    if prop_tiles.is_empty():
        return TileRef.invalid()
    return prop_tiles[randi() % prop_tiles.size()]
```

```gdscript
# res://scripts/resources/TileRef.gd
class_name TileRef extends Resource

@export var source: int = -1
@export var coords: Vector2i = Vector2i.ZERO
@export var alt: int = 0

static func invalid() -> TileRef:
    return TileRef.new()   # source = -1 means skip
```

---

## Biome Definitions (Initial Set)

Three starter biomes. Designer selects via `MissionResource.biome`.

| Biome ID | Visual Character | Impassable threshold | Prop density |
|----------|-----------------|----------------------|-------------|
| `wasteland` | Cracked earth, sparse rubble | 0.35 | 0.25 |
| `urban_ruins` | Dense broken concrete, narrow alleys | 0.45 | 0.40 |
| `swamp_field` | Murky ground, P-RAY glow patches | 0.30 | 0.35 |

Biome `.tres` files live in `res://data/biomes/`. Tile source IDs and atlas coords are filled
in when the tile atlas is available.

---

## Designer Workflow

1. Open `MissionResource` for the target mission in the Godot inspector.
2. Set `map_width_tiles`, `map_height_tiles`, `start_zone`, `end_zone`.
3. Add `TerrainRule` entries — each one is a landmark with normalized position and size.
4. Set `path_count` (2 = two routes through the map).
5. Add `PodTemplate` entries with enemy types and placement zones.
6. Run the game — the generator builds the map from these rules.
7. If a landmark is in the wrong spot, adjust `center_normalized` and re-run.
8. No code changes needed between iterations.

---

## Generation Limitations (Known)

- Lakes that span the full map width will block all paths. The corridor carver will force a
  gap, but it will look unnatural. Avoid full-width lakes.
- Building cluster interiors are not guaranteed to be connected to the exterior — add an
  `OPEN_FIELD` rule near clusters if heroes need interior access.
- Path carver does not currently avoid lake cells; it carves over them. Use `RIVER` (which
  has a bridge) instead of `LAKE` when blocking a direct path.
- Navigation bake may take 1–3 seconds on large maps. A loading screen between missions
  should cover this.

---

## Dependencies

- `MissionResource` (SDD-14) — input to the generator
- `BiomeResource`, `TileRef` — tile mapping
- `MapGrid` — internal cell state
- `LootSystem.spawn_at()` — loot zone placement
- `NavigationRegion2D` — nav bake target

---

## LLM Prompt

```
You are implementing the Procedural Map Generator for P-RAY, a Godot 4.4 GDScript game.

The generator reads a MissionResource (designer-authored constraints) and produces a
navigable TileMapLayer for Story Mode missions. The designer places landmarks; the generator
fills in details.

Task:
1. Implement MapGrid.gd (not a Node; pure data class).
2. Implement ProceduralMapGen.gd as a system Node in StoryWorld.tscn.
3. Implement BiomeResource.gd and TileRef.gd as Resource classes.
4. Create three BiomeResource .tres files (wasteland, urban_ruins, swamp_field) with
   placeholder tile source IDs (-1 for all until real tilesets exist).
5. Implement all _step_* methods as shown.
6. Add a LootSystem.spawn_at(world_pos, loot_resource) static method called in _step_loot().
7. Wire ProceduralMapGen.generate(mission) call from MissionLoader.load_mission().

Rules:
- Generator must not crash when BiomeResource tile arrays are empty (use fallback source=0).
- _step_bake_nav() must use await — caller must also await generate().
- Water cells (type 2) are never navigable and block corridor carving.
- Lakes near start_zone or end_zone that could block entry must be checked;
  if the start or end rect is within the lake, move the lake center away.
- Generation runs once per mission load, never during gameplay.

[paste SDD-00, SDD-09, SDD-13, SDD-14, SDD-15 here]
```
