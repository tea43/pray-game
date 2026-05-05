# SDD-12: Asset Pipeline

## Purpose

Defines how external sprites (heroes, enemies, weapons, loot, UI icons) are registered and
assigned to nodes at runtime. The game is always playable without any art assets — missing
textures render as colored placeholder rectangles. When assets arrive, dropping them in the
correct folder and running the manifest tool is all that is needed.

---

## AssetRegistry Autoload

The central lookup table. Maps `StringName` keys to loaded `Texture2D` references.

```gdscript
# res://autoloads/AssetRegistry.gd
class_name AssetRegistry extends Node

# key → Texture2D (or null if not found)
var _textures: Dictionary = {}

# key → Color (used for placeholder rectangles)
var _placeholder_colors: Dictionary = {
    &"elliot":         Color(0.2, 0.4, 0.8),
    &"dick":           Color(0.8, 0.2, 0.2),
    &"habib":          Color(0.2, 0.7, 0.3),
    &"raider":         Color(0.5, 0.3, 0.1),
    &"runner":         Color(0.8, 0.6, 0.1),
    &"ghoul":          Color(0.3, 0.6, 0.2),
    &"mutant":         Color(0.1, 0.4, 0.1),
    &"blinker":        Color(0.5, 0.1, 0.7),
    &"miniboss":       Color(0.7, 0.1, 0.1),
    &"bigboss":        Color(0.1, 0.5, 0.1),
    &"long_club":      Color(0.6, 0.4, 0.2),
    &"dual_clubs":     Color(0.6, 0.4, 0.2),
    &"thrown_club":    Color(0.6, 0.4, 0.2),
    &"spray_gun":      Color(0.4, 0.7, 0.7),
    &"samurai_sword":  Color(0.8, 0.8, 0.4),
    &"medkit":         Color(0.9, 0.2, 0.2),
    &"stimpack":       Color(0.9, 0.7, 0.1),
    &"bomb":           Color(0.2, 0.2, 0.2),
    &"banana_bomb":    Color(0.9, 0.8, 0.1),
    &"spray_gun_pickup": Color(0.4, 0.7, 0.7),
    &"samurai_sword_pickup": Color(0.8, 0.8, 0.4),
    &"blink":          Color(0.3, 0.3, 0.9),
    &"rage":           Color(0.9, 0.3, 0.1),
    &"chain_lightning": Color(0.8, 0.9, 0.2),
}

func _ready() -> void:
    _load_manifest()

func _load_manifest() -> void:
    const MANIFEST_PATH := "res://assets/sprites/manifest.json"
    if not FileAccess.file_exists(MANIFEST_PATH):
        push_warning("AssetRegistry: no manifest found at %s" % MANIFEST_PATH)
        return
    var text := FileAccess.get_file_as_string(MANIFEST_PATH)
    var data: Dictionary = JSON.parse_string(text)
    if data == null:
        push_warning("AssetRegistry: manifest parse failed")
        return
    for key in data:
        var path: String = data[key]
        if ResourceLoader.exists(path):
            _textures[StringName(key)] = load(path)

## Assign a texture to a Sprite2D. Shows placeholder ColorRect if texture is missing.
func assign_sprite(sprite: Sprite2D, key: StringName) -> void:
    var tex: Texture2D = _textures.get(key)
    sprite.texture = tex
    # Show or hide placeholder sibling
    var placeholder: ColorRect = _get_or_create_placeholder(sprite, key)
    placeholder.visible = (tex == null)

## Assign a texture to a TextureRect.
func assign_texture(rect: TextureRect, key: StringName) -> void:
    var tex: Texture2D = _textures.get(key)
    rect.texture = tex
    var placeholder: ColorRect = _get_or_create_placeholder(rect, key)
    placeholder.visible = (tex == null)

func _get_or_create_placeholder(parent: Node, key: StringName) -> ColorRect:
    var existing: ColorRect = parent.find_child("_Placeholder", false, false)
    if existing:
        return existing
    var rect := ColorRect.new()
    rect.name = "_Placeholder"
    rect.color = _placeholder_colors.get(key, Color(0.5, 0.5, 0.5))
    rect.set_anchors_preset(Control.PRESET_FULL_RECT)
    rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
    parent.add_child(rect)
    return rect
```

---

## Manifest Format

`res://assets/sprites/manifest.json` — maps string keys to resource paths:

```json
{
    "elliot":          "res://assets/sprites/heroes/elliot.png",
    "dick":            "res://assets/sprites/heroes/dick.png",
    "habib":           "res://assets/sprites/heroes/habib.png",
    "raider":          "res://assets/sprites/enemies/raider.png",
    "runner":          "res://assets/sprites/enemies/runner.png",
    "ghoul":           "res://assets/sprites/enemies/ghoul.png",
    "mutant":          "res://assets/sprites/enemies/mutant.png",
    "blinker":         "res://assets/sprites/enemies/blinker.png",
    "miniboss":        "res://assets/sprites/enemies/miniboss.png",
    "bigboss":         "res://assets/sprites/enemies/bigboss.png",
    "long_club":       "res://assets/sprites/weapons/long_club.png",
    "dual_clubs":      "res://assets/sprites/weapons/dual_clubs.png",
    "thrown_club":     "res://assets/sprites/weapons/thrown_club.png",
    "spray_gun":       "res://assets/sprites/weapons/spray_gun.png",
    "samurai_sword":   "res://assets/sprites/weapons/samurai_sword.png",
    "medkit":          "res://assets/sprites/loot/medkit.png",
    "stimpack":        "res://assets/sprites/loot/stimpack.png",
    "bomb":            "res://assets/sprites/loot/bomb.png",
    "banana_bomb":     "res://assets/sprites/loot/banana_bomb.png",
    "spray_gun_pickup":"res://assets/sprites/loot/spray_gun_pickup.png",
    "samurai_sword_pickup": "res://assets/sprites/loot/samurai_sword_pickup.png",
    "blink":           "res://assets/sprites/ui/ability_blink.png",
    "rage":            "res://assets/sprites/ui/ability_rage.png",
    "chain_lightning": "res://assets/sprites/ui/ability_chain_lightning.png"
}
```

---

## Folder Layout for Assets

```
res://assets/sprites/
├── manifest.json
├── heroes/
│   ├── elliot.png          # spritesheet or single frame
│   ├── elliot_idle.png     # optional: separate animation sheets
│   ├── elliot_walk.png
│   ├── elliot_attack.png
│   ├── dick.png
│   └── habib.png
├── enemies/
│   ├── raider.png
│   ├── runner.png
│   ├── ghoul.png
│   ├── mutant.png
│   ├── blinker.png
│   ├── miniboss.png
│   └── bigboss.png
├── weapons/
│   ├── long_club.png
│   ├── dual_clubs.png
│   ├── thrown_club.png
│   ├── spray_gun.png
│   └── samurai_sword.png
├── loot/
│   ├── medkit.png
│   ├── stimpack.png
│   ├── bomb.png
│   ├── banana_bomb.png
│   ├── spray_gun_pickup.png
│   └── samurai_sword_pickup.png
└── ui/
    ├── ability_blink.png
    ├── ability_rage.png
    └── ability_chain_lightning.png
```

---

## Spritesheet Contract

When providing spritesheets, follow this convention so `AnimationPlayer` can reference frames
without manifest changes:

| Property | Value |
|----------|-------|
| Frame size | 128×128 px (heroes), 96×96 px (enemies), 64×64 px (loot/weapons) |
| Frame order | left-to-right, top-to-bottom |
| Animation rows | Row 0: idle (4 frames), Row 1: walk (8 frames), Row 2: attack (6 frames), Row 3: death (6 frames) |
| Background | transparent |
| Format | PNG, RGBA |

If a character only has a single-frame PNG (no animation), the `AnimationPlayer` plays a
single-frame animation for all states — the game still runs. Animation richness is additive.

---

## Registering New Assets

1. Drop the PNG file in the correct subfolder.
2. Add the key-path pair to `manifest.json`.
3. Reload the project (or call `AssetRegistry._load_manifest()` via script in development).

No code changes required. The manifest is the only touch point.

---

## Generating the Manifest Tool

A small GDScript tool automates manifest generation:

```gdscript
# res://tools/GenerateManifest.gd
@tool
extends EditorScript

const OUTPUT_PATH := "res://assets/sprites/manifest.json"
const SPRITE_ROOT := "res://assets/sprites/"
const EXTENSIONS := ["png", "webp", "svg"]

# Key derivation: strip folder prefix and extension, use filename as key.
# e.g. "heroes/elliot.png" → "elliot"
# Override with a manual entry in the manifest if key collision occurs.

func _run() -> void:
    var manifest: Dictionary = {}
    _scan_dir(SPRITE_ROOT, manifest)
    var json := JSON.stringify(manifest, "\t")
    var file := FileAccess.open(OUTPUT_PATH, FileAccess.WRITE)
    file.store_string(json)
    file.close()
    print("Manifest written: %d entries" % manifest.size())

func _scan_dir(path: String, out: Dictionary) -> void:
    var dir := DirAccess.open(path)
    if dir == null:
        return
    dir.list_dir_begin()
    var name := dir.get_next()
    while name != "":
        if dir.current_is_dir() and not name.begins_with("."):
            _scan_dir(path + name + "/", out)
        else:
            var ext := name.get_extension()
            if ext in EXTENSIONS:
                var key := name.get_basename()
                var full_path := path + name
                out[key] = full_path
        name = dir.get_next()
```

Run via `Project > Tools > Run EditorScript`.

---

## Animation Integration

When spritesheets arrive, connect them to `AnimationPlayer` via `SpriteFrames` in the Godot
editor. The `AnimationPlayer` node in each entity scene references the spritesheet's atlas.

The enemy `_die()` function already `await`s `anim.animation_finished` — no code change needed
when death animations are added.

Hero attack animations should be triggered in `Hero._execute_attack()` before damage is applied:
```gdscript
func _execute_attack() -> void:
    anim.play("attack")   # add this line when anim exists
    # ... existing attack logic ...
```

---

## Dependencies

- None. `AssetRegistry` is the lowest-level resource layer after autoload initialization.

---

## LLM Prompt

```
You are implementing the Asset Pipeline for P-RAY, a Godot 4.4 GDScript game.

Sprites are provided externally. The game must run without any art — missing textures render
as colored placeholder rectangles. When art arrives, adding it requires no code changes.

Task:
1. Implement AssetRegistry.gd autoload as shown in SDD-12.
2. Create the manifest.json file with all keys listed (paths will resolve to null initially — OK).
3. Create the folder structure under res://assets/sprites/.
4. Implement GenerateManifest.gd as an @tool EditorScript.
5. Update all Sprite2D and TextureRect assignments throughout the codebase to use
   AssetRegistry.assign_sprite() and AssetRegistry.assign_texture() respectively.
6. Verify: running the game with empty sprite folders shows colored rectangles, not errors.

Rules:
- AssetRegistry._load_manifest() must not crash if manifest.json is absent.
- Placeholder ColorRect is a sibling to the Sprite2D, not a child.
- Placeholder color per key is defined in _placeholder_colors — add any missing keys.
- GenerateManifest.gd uses @tool and extends EditorScript (not Node).

[paste SDD-00, SDD-12 here]
```
