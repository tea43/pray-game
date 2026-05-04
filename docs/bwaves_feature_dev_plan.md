# Between-Wave Upgrade System: Implementation Plan

This document outlines the development plan for the Between-Wave Upgrade System described in `bwaves_feature.md`.

## 1. Data Architecture
### JSON Schema
Create three JSON files representing the character upgrade pools. These should be loaded dynamically to keep the system data-driven.
- `assets/data/upgrades/elliot_upgrades.json`
- `assets/data/upgrades/dick_upgrades.json`
- `assets/data/upgrades/habib_upgrades.json`

**Sample Schema:**
```json
[
  {
    "id": "elliot_minor_healing",
    "name": "Minor Healing Brew",
    "rarity": "Common",
    "effectType": "heal_start",
    "effectValue": 0.1,
    "description": "Restores 10% HP at the start of the wave"
  }
]
```

### Loading System
- Implement a data loader (e.g., `UpgradeDataLoader`) to fetch these files asynchronously during the game's initial load sequence.
- Store loaded upgrades in a global or state-managed registry: `Game.upgradesData`.

## 2. Selection & RNG Logic
- **Rarity Weights**: Assign percentage weights to rarities for the draw pool to ensure higher-tier items are scarce (e.g., Common: 60%, Rare: 25%, Epic: 10%, Legendary: 5%).
- **Drafting System**:
  - When a wave ends, invoke a `generateUpgradeOptions()` function.
  - Draw a random subset of upgrades (e.g., 3 choices) for each character from their respective pools, factoring in rarity weights.

## 3. UI Implementation (Upgrade Screen)
- **Game State**: Add a new discrete state `GAME_STATE_UPGRADE` that pauses gameplay.
- **Rendering**:
  - Draw a darkened overlay over the game canvas.
  - Render 3 distinct columns or panels (one for Elliot, Dick, and Habib).
  - Inside each column, render the drawn upgrade cards. Color-code the borders or backgrounds based on the rarity (Grey, Blue, Purple, Gold).
- **Interaction**:
  - Mouse click/touch to select one card per column.
  - Visually highlight the selected cards.
  - A "Next Wave" button that is disabled until exactly 3 upgrades (one per character) are selected.

## 4. Temporary Buff & Modifier System
- **State Tracking**: Create an `ActiveUpgrades` object to store the currently selected upgrades for the active wave.
- **Application Hooks**:
  - `applyWaveUpgrades()`: Invoked when the player presses "Next Wave". Parses the `effectType` of selected upgrades and applies stat multipliers or flags to the active heroes/weapons.
  - `removeWaveUpgrades()`: Invoked immediately when a wave is completed, completely wiping the temporary buffs before transitioning to `GAME_STATE_UPGRADE`.
- **Stat Immutability Rule**: To prevent permanent stat bloat or calculation errors, upgrades should apply their modifiers to a `currentStats` or `effectiveStats` layer, while leaving the heroes' `baseStats` untouched.

## 5. Handling Complex Effects
While flat stat boosts (e.g., +10% speed) are simple multipliers, many upgrades require specific event hooks:
- **Triggers/Hooks**: Insert specific checks in existing systems:
  - *Damage Calculation*: Hook for Thorn Mail, Reflective Plating, Aegis of the Unyielding.
  - *Death Handling*: Hook for Elixir of Immortality (revive once).
  - *Projectile/Attack Logic*: Hook for Chain Lightning, Incendiary Rounds.
- **Active Abilities**: For items like "Timestop Vial", add an active ability keybind/UI button that checks if the item is currently in `ActiveUpgrades`.

## 6. Execution Phases
- **Phase 1: Data & State Foundation** ✅
  - Create JSON files, loader, and the `ActiveUpgrades` tracking object. Establish the wave start/end clearing hooks.
- **Phase 2: Screen & UI** ✅
  - Build the canvas overlay state (`GAME_STATE_UPGRADE`), card rendering, RNG draw logic, and selection input handling.
- **Phase 3: Basic Stat Modifiers** ✅
  - Implement the effect parsing system for straightforward passive stat changes (max HP, movement speed, base damage, reload speed).
- **Phase 4: Special Triggers & Abilities** ✅
  - Plumb in the complex combat hooks (healing over time, revive, damage reflection, chain lightning, timestop).
