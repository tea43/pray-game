# Docs Index

Navigation hub for agents. Read this first, then open only the file that matches the task.

---

## ⚠️ CRITICAL — Entry Point

**The game runs via Phaser 3.** `index.html` loads `src/phaser/game.js` — NOT `src/main.js`.

- **Active entry point:** `src/phaser/game.js` → `src/phaser/scenes/GameScene.js`
- **`src/main.js` is deleted** — it was an abandoned vanilla Canvas 2D prototype. Never edit or recreate it.
- All game logic edits go in `src/phaser/` or in the shared files (`src/config/`, `src/entities/`, `src/state.js`, `src/render/`, `src/systems/` except the deleted vanilla-only files).
- The Phaser scene uses a **Canvas 2D texture bridge**: `G.ctx` is a `CanvasTexture` 2D context. All existing draw code in `src/render/` writes to `G.ctx` unchanged; `refresh()` uploads to GPU each frame.

See `docs/current/implementation_notes.md` → Architecture section for the full runtime picture.

---

## Folder Layout

| Folder | Purpose |
|---|---|
| `current/` | Snapshot of what the game does and how it works right now |
| `planning/` | Active plans, upcoming phases, open design questions |
| `planned/` | Early brainstorms and candidate designs not yet accepted as active plans |
| `executed/` | Completed feature specs and fulfilled plans (read-only reference) |
| `rejected/` | Abandoned approaches — kept for archaeology only |
| `lore/` | World lore, character backgrounds, story tone |

---

## current/ — Game State & Reference

- `current/current_game_state.md`: Concise snapshot of the playable game: heroes, weapons, abilities, enemies, loot, waves, controls, and current architecture.
- `current/implementation_notes.md`: Deeper technical reference for current modular `src/` behavior and code locations.
- `current/sprites.md`: Sprite registry — manifest structure, categories, fallback chain, and how to add new art.
- `current/bugs.md`: Active bug tracker. Statuses: TBD → IPG → VAL → DON. Take the first TBD bug, mark IPG, fix it, mark VAL, commit, remove entry.
- `current/bugs/performance_improvements.md`: Log of completed performance optimisations (background cache, shadowBlur removal, DPR cap, particle throttle).
- `current/smoke_checklist.md`: Manual verification checklist for gameplay/rendering patches.
- `current/adding_assets.md`: How to add audio, ability icons, sprites, and video assets — file locations, manifest commands, and wiring steps.

## planning/ — Active Plans

- `planning/plan.md`: Immediate build plan — phased steps, commit targets, and status. Phases 0–5 complete; Phase 6 (Audio) in progress.
- `planning/future_development_plan.md`: Suggested development roadmap for gameplay, content, tooling, and eventual Steam readiness.
- `planning/audio_plan.md`: Phase 6 implementation plan for music, sound effects, event naming, variant pools, and missing-asset fallbacks.
- `planning/asset_injection_plan.md`: Proposed manifest/data structure for injectable heroes, enemies, weapons, loot, and comic assets.
- `planning/future_world_sprites.md`: Eastern European environment sprites — design spec and occlusion system.
- `planning/reworked_upgrade_plan.md`: Reworked slot-machine upgrade selector — lore-correct upgrade pools (Dick→weapons, Habib→armor, Eliott→alchemy), hidden spin-credit banking mechanic, and `UpgradeTestScene` dev harness.
- `planning/realistic_abilities_plan.md`: Lore-accurate ability rework — weapon reassignment, 3 new base abilities, passive/active upgrade pools with per-wave durability.
- `planning/died_conditions.md`: Assessment of the all-survivors-dead screen; what's implemented vs. missing (dim overlay during 2s window).
- `planning/abilities_structure_rework.md`: Design doc for unifying base abilities and upgrade skills into a single modular ABILITY_DEFS system.
- `planning/backlog.md`: Long-horizon design questions and open-ended discussions (sprites, scrolling maps, terrain, enemies, loot). Not immediate work.
- `planning/large_map_plan.md`: 3×3 world (9× screen area) with centroid-locked camera — phased implementation plan (Phases A–J).
- `planning/pr-pickup-range.md`: Per-hero essence pickup radius — adds `pickupR` to `HERO_DEFS`, expands the essence pickup check, optional ground-ring visual.
- `planning/abilities_rework_progress.md`: Implementation tracker for the abilities rework (two XP tracks, ability trees, slot machine rework, combo system, revive minigame). Phases 1–3 complete.

## planned/ — Brainstorms

- `planned/ability_progression_brainstorm.md`: Session notes on sustainable ability progression, several system options, and draft per-hero upgrade ladders.

## executed/ — Completed Specs

- `executed/pr-level-up.md`: Essence drops, XP accumulation, `state.level`, and top-right HUD bar — complete.
- `executed/pr-weapons.md`: 3 weapon slots per hero with per-slot auto-fire; level-up modal (`WeaponLevelUpScene`) offers 3 cards (new weapon or upgrade) — complete.
- `executed/modularization_plan.md`: Completed plan for extracting from one large HTML file to the current modular `src/` codebase.
- `executed/phaser_port_plan.md`: Phaser 3 port plan — **complete and active runtime**. All phases done.
- `executed/bwaves_feature.md`: Between-wave upgrade system spec (implemented).
- `executed/bwaves_feature_dev_plan.md`: Between-wave upgrade system implementation plan (all phases complete).
- `executed/group_abilities.md`: Friendship-power superboost system — all 4 combos implemented (Chocho Train, High Five My Bro, Vietnam Memories, You Should Stay In The Ground).
- `executed/wasteland_survivors_feature_plan.md`: Historical feature ledger for the v4 single-file prototype.

## rejected/ — Abandoned Approaches

- `rejected/godot/`: Godot port design docs — abandoned before implementation.

## lore/

- `lore/PRAY_the game.md`: User-authored lore source for the P-RAY setting, alien worms, heroes, and story tone.

---

## Read Matrix

| Task | Read |
|---|---|
| Quick gameplay summary | `current/current_game_state.md` |
| Bug fix | `current/implementation_notes.md` + targeted code search |
| Balance change | `current/current_game_state.md`, then relevant code ranges |
| Add ability, weapon, enemy, or loot | `current/current_game_state.md` + `current/implementation_notes.md` |
| Asset/content pipeline | `planning/asset_injection_plan.md` + `lore/PRAY_the game.md` |
| Audio, music, or sound effects | `planning/audio_plan.md` + targeted event code |
| Roadmap or feature sequencing | `planning/future_development_plan.md` |
| Immediate build phase status | `planning/plan.md` |
| Verify a patch | `current/smoke_checklist.md` |
| Between-wave upgrade system | `executed/bwaves_feature.md` |

---

## Documentation Rule

Keep docs short and non-duplicative. New topics go in the appropriate folder. If a topic grows, create a subfolder within it (e.g. `current/combat/loot.md`). Always update this index when adding a file.
