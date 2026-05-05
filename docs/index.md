# Docs Index

Navigation hub for agents. Read this first, then open only the file that matches the task.

## Folder Layout

| Folder | Purpose |
|---|---|
| `current/` | Snapshot of what the game does and how it works right now |
| `planning/` | Active plans, upcoming phases, open design questions |
| `executed/` | Completed feature specs and fulfilled plans (read-only reference) |
| `rejected/` | Abandoned approaches — kept for archaeology only |
| `lore/` | World lore, character backgrounds, story tone |

---

## current/ — Game State & Reference

- `current/current_game_state.md`: Concise snapshot of the playable game: heroes, weapons, abilities, enemies, loot, waves, controls, and current architecture.
- `current/implementation_notes.md`: Deeper technical reference for current modular `src/` behavior and code locations.
- `current/sprites.md`: Sprite registry — manifest structure, categories, fallback chain, and how to add new art.
- `current/bugs.md`: Active bug tracker. Statuses: TBD → IPG → VAL → DON. Take the first TBD bug, mark IPG, fix it, mark VAL, commit, remove entry.
- `current/smoke_checklist.md`: Manual verification checklist for gameplay/rendering patches.

## planning/ — Active Plans

- `planning/plan.md`: Immediate build plan — phased steps, commit targets, and status. Phases 0–5 complete; Phase 6 (Audio) in progress.
- `planning/future_development_plan.md`: Suggested development roadmap for gameplay, content, tooling, and eventual Steam readiness.
- `planning/audio_plan.md`: Phase 6 implementation plan for music, sound effects, event naming, variant pools, and missing-asset fallbacks.
- `planning/asset_injection_plan.md`: Proposed manifest/data structure for injectable heroes, enemies, weapons, loot, and comic assets.
- `planning/future_world_sprites.md`: Eastern European environment sprites — design spec and occlusion system.
- `planning/backlog.md`: Long-horizon design questions and open-ended discussions (sprites, scrolling maps, terrain, enemies, loot). Not immediate work.

## executed/ — Completed Specs

- `executed/modularization_plan.md`: Completed plan for extracting from one large HTML file to the current modular `src/` codebase.
- `executed/bwaves_feature.md`: Between-wave upgrade system spec (implemented).
- `executed/bwaves_feature_dev_plan.md`: Between-wave upgrade system implementation plan (all phases complete).
- `executed/wasteland_survivors_feature_plan.md`: Historical feature ledger for the v4 single-file prototype.

## rejected/ — Abandoned Approaches

- `rejected/phaser_port_plan.md`: Phaser 4.1 port plan — abandoned; game stayed on vanilla Canvas 2D + Vite.
- `rejected/godot/`: Godot port design docs — abandoned before implementation.

## lore/

- `lore/PRAY_ the game.md`: User-authored lore source for the P-RAY setting, alien worms, heroes, and story tone.

---

## Read Matrix

| Task | Read |
|---|---|
| Quick gameplay summary | `current/current_game_state.md` |
| Bug fix | `current/implementation_notes.md` + targeted code search |
| Balance change | `current/current_game_state.md`, then relevant code ranges |
| Add ability, weapon, enemy, or loot | `current/current_game_state.md` + `current/implementation_notes.md` |
| Asset/content pipeline | `planning/asset_injection_plan.md` + `lore/PRAY_ the game.md` |
| Audio, music, or sound effects | `planning/audio_plan.md` + targeted event code |
| Roadmap or feature sequencing | `planning/future_development_plan.md` |
| Immediate build phase status | `planning/plan.md` |
| Verify a patch | `current/smoke_checklist.md` |
| Between-wave upgrade system | `executed/bwaves_feature.md` |

---

## Documentation Rule

Keep docs short and non-duplicative. New topics go in the appropriate folder. If a topic grows, create a subfolder within it (e.g. `current/combat/loot.md`). Always update this index when adding a file.
