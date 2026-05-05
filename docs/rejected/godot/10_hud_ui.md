# SDD-10: HUD & UI

## Purpose

Defines the heads-up display: hero portraits with HP bars, ability cooldown indicators, wave
counter, speed display, and game-state overlays (pause menu, game over, victory). The HUD is a
`CanvasLayer` — it stays fixed on screen regardless of camera movement.

---

## Scene Structure

```
HUD (CanvasLayer)                   ← layer = 1; script: HUD.gd
├── HeroPanel (HBoxContainer)       ← bottom-left; one HeroCard per hero
│   ├── HeroCard_Elliot (Control)
│   ├── HeroCard_Dick (Control)
│   └── HeroCard_Habib (Control)
├── AbilityBar (HBoxContainer)      ← bottom-center; ability icons with cooldown overlay
│   ├── AbilitySlot_1 (Control)
│   ├── AbilitySlot_2 (Control)
│   └── AbilitySlot_3 (Control)
├── WaveDisplay (VBoxContainer)     ← top-right
│   ├── WaveLabel (Label)           ← "Wave 3 / 21"
│   └── SpeedLabel (Label)          ← "Speed: x2"
├── PauseOverlay (Control)          ← fullscreen dim + menu; hidden by default
│   ├── ResumeButton (Button)
│   ├── VolumeSlider (HSlider)
│   └── QuitButton (Button)
├── GameOverOverlay (Control)       ← hidden by default
│   ├── GameOverLabel (Label)
│   └── RestartButton (Button)
└── VictoryOverlay (Control)        ← hidden by default
    ├── VictoryLabel (Label)
    └── RestartButton (Button)
```

---

## HeroCard

One per hero. Displays portrait, HP bar, weapon icon, and ability cooldown ring.

```
HeroCard (Control)                  ← 120×160 px; script: HeroCard.gd
├── Portrait (TextureRect)          ← hero portrait sprite
├── HPBar (ProgressBar)             ← value 0–100; fills left-to-right
├── WeaponIcon (TextureRect)        ← current weapon icon
├── AbilityCooldownRing (TextureProgressBar) ← radial fill, 0=ready 1=full_cooldown
├── SelectionHighlight (Panel)      ← visible when hero is selected
└── DeadOverlay (Panel)             ← semi-transparent dark cover when hero is dead
```

```gdscript
# res://scenes/hud/HeroCard.gd
class_name HeroCard extends Control

var _hero: Hero

@onready var portrait: TextureRect = $Portrait
@onready var hp_bar: ProgressBar = $HPBar
@onready var weapon_icon: TextureRect = $WeaponIcon
@onready var cooldown_ring: TextureProgressBar = $AbilityCooldownRing
@onready var selection_highlight: Panel = $SelectionHighlight
@onready var dead_overlay: Panel = $DeadOverlay

func configure(hero: Hero) -> void:
    _hero = hero
    AssetRegistry.assign_texture(portrait, hero.data.portrait_key)
    _update_weapon(hero.get_weapon())

    hero.hp_changed.connect(_on_hp_changed)
    hero.weapon_changed.connect(_update_weapon)
    hero.died.connect(_on_hero_died)
    hero.selected_changed.connect(_on_selected_changed)

func _process(_delta: float) -> void:
    if _hero == null:
        return
    cooldown_ring.value = _hero.get_ability_cooldown_fraction()

func _on_hp_changed(current: float, maximum: float) -> void:
    hp_bar.value = (current / maximum) * 100.0

func _update_weapon(weapon: WeaponResource) -> void:
    AssetRegistry.assign_texture(weapon_icon, weapon.sprite_key)

func _on_hero_died() -> void:
    dead_overlay.visible = true

func _on_selected_changed(selected: bool) -> void:
    selection_highlight.visible = selected
```

---

## AbilitySlot

Shows the ability icon and key hint. Mirrors HeroCard cooldown ring for the active selection.

```gdscript
# res://scenes/hud/AbilitySlot.gd
class_name AbilitySlot extends Control

var _hero: Hero

@onready var icon: TextureRect = $Icon
@onready var key_label: Label = $KeyLabel
@onready var cooldown_cover: Panel = $CooldownCover   # alpha controlled by fraction

const KEY_LABELS: Array[String] = ["Q", "W", "E"]

func configure(hero: Hero, slot_index: int) -> void:
    _hero = hero
    key_label.text = KEY_LABELS[slot_index]
    if hero.data.ability != null:
        AssetRegistry.assign_texture(icon, hero.data.ability.icon_key)

func _process(_delta: float) -> void:
    if _hero == null:
        return
    var frac := _hero.get_ability_cooldown_fraction()
    cooldown_cover.modulate.a = frac * 0.7   # max 70% opacity when on cooldown
```

---

## WaveDisplay

Updates on wave events via EventBus:

```gdscript
# res://scenes/hud/WaveDisplay.gd
class_name WaveDisplay extends VBoxContainer

@onready var wave_label: Label = $WaveLabel
@onready var speed_label: Label = $SpeedLabel

func _ready() -> void:
    EventBus.wave_started.connect(_on_wave_started)
    GameTime.flow_changed.connect(_on_flow_changed)
    _refresh_speed()

func _on_wave_started(wave: int) -> void:
    wave_label.text = "Wave %d / %d" % [wave, DifficultyConfig.data.total_waves]

func _on_flow_changed(_flowing: bool) -> void:
    _refresh_speed()

func _process(_delta: float) -> void:
    _refresh_speed()

func _refresh_speed() -> void:
    var flowing: bool = GameTime.is_flowing()
    var label: String = GameTime.speed_label()
    if not flowing:
        speed_label.text = "PAUSED" if GameTime.manual_pause else "IDLE"
    else:
        speed_label.text = "Speed: %s" % label
```

---

## HUD Root

```gdscript
# res://scenes/hud/HUD.gd
class_name HUD extends CanvasLayer

@onready var hero_panel: HBoxContainer = $HeroPanel
@onready var ability_bar: HBoxContainer = $AbilityBar
@onready var pause_overlay: Control = $PauseOverlay
@onready var game_over_overlay: Control = $GameOverOverlay
@onready var victory_overlay: Control = $VictoryOverlay

const HERO_CARD_SCENE := preload("res://scenes/hud/HeroCard.tscn")
const ABILITY_SLOT_SCENE := preload("res://scenes/hud/AbilitySlot.tscn")

func _ready() -> void:
    EventBus.game_over.connect(show_game_over)
    EventBus.victory.connect(show_victory)
    pause_overlay.visible = false
    game_over_overlay.visible = false
    victory_overlay.visible = false

func initialize(heroes: Array[Hero]) -> void:
    for i in heroes.size():
        var card: HeroCard = HERO_CARD_SCENE.instantiate()
        hero_panel.add_child(card)
        card.configure(heroes[i])

        var slot: AbilitySlot = ABILITY_SLOT_SCENE.instantiate()
        ability_bar.add_child(slot)
        slot.configure(heroes[i], i)

func show_game_over() -> void:
    game_over_overlay.visible = true

func show_victory() -> void:
    victory_overlay.visible = true

func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed(&"game_pause") and GameTime._space_hold_time < 0.2:
        _toggle_pause_menu()

func _toggle_pause_menu() -> void:
    pause_overlay.visible = !pause_overlay.visible

func _on_resume_pressed() -> void:
    pause_overlay.visible = false

func _on_quit_pressed() -> void:
    get_tree().quit()
```

---

## Layout Guidelines

All sizes in pixels at 1920×1080 base resolution. Use anchors and `Control.size_flags` for
scaling.

| Element | Anchor | Size | Position |
|---------|--------|------|----------|
| HeroPanel | bottom-left | auto | (20, -20) from bottom-left |
| AbilityBar | bottom-center | auto | centred at bottom |
| WaveDisplay | top-right | 240×80 | (−20, 20) from top-right |
| Overlays | fullscreen | fill | (0, 0) |

HeroCard: minimum size 120×160 px. AbilitySlot: 72×72 px with icon 48×48 px inside.

---

## Difficulty Selection Screen

Before the game starts, show a simple difficulty picker. This is a separate scene
`res://scenes/menu/DifficultyMenu.tscn` with five buttons, one per difficulty. On selection:

```gdscript
func _on_difficulty_selected(id: StringName) -> void:
    DifficultyConfig.load_difficulty(id)
    get_tree().change_scene_to_file("res://scenes/main/Main.tscn")
```

---

## Dependencies

- `GameTime` — speed label, flow_changed signal
- `EventBus` — `wave_started`, `game_over`, `victory`
- `DifficultyConfig` — total wave count for display
- `AssetRegistry` — portrait and icon textures
- Each `Hero` — hp_changed, weapon_changed, died, selected_changed signals

---

## LLM Prompt

```
You are implementing the HUD and UI for P-RAY, a Godot 4.4 GDScript game.

The HUD is a CanvasLayer. It shows hero portraits with HP, ability cooldowns, wave info,
and game-state overlays. It reads from heroes via signals — it does not poll game state directly.

Task:
1. Create HUD.tscn with the full scene tree from SDD-10.
2. Create HeroCard.tscn and HeroCard.gd.
3. Create AbilitySlot.tscn and AbilitySlot.gd.
4. Create WaveDisplay.tscn and WaveDisplay.gd.
5. Implement HUD.gd with initialize(heroes), show_game_over(), show_victory().
6. Create DifficultyMenu.tscn with five buttons wired to DifficultyConfig.load_difficulty().
7. Wire HUD.initialize() call from GameWorld after heroes are spawned.

Rules:
- HUD never reads GameState directly — it receives data via Hero signals and EventBus.
- PauseOverlay toggle must not conflict with GameTime.toggle_pause (Space tap is handled
  by GameTime; HUD pause menu should use Escape or a separate button).
- Cooldown ring value is updated every frame in _process, not on signal.
- All TextureRect textures are assigned via AssetRegistry, never hardcoded.

[paste SDD-00, SDD-03, SDD-10 here]
```
