# Docs Index

This is the navigation hub for agents. Read this first, then open only the file that matches the task.

## Current State

- `current_game_state.md`: Concise snapshot of the playable game: heroes, weapons, abilities, enemies, loot, waves, controls, and current architecture.
- `implementation_notes.md`: Deeper technical reference for current `wasteland_survivors-v4.html` behavior and code locations.
- `lore/PRAY_ the game.md`: User-authored lore source for the P-RAY setting, alien worms, heroes, and story tone.

## Planning

- `phaser_port_plan.md`: Phased plan to port the game from vanilla Canvas 2D to Phaser 3, with scene layout, system mapping, and risk log.
- `modularization_plan.md`: Safe path from one large HTML file to a maintainable modular codebase without breaking the current playable file.
- `asset_injection_plan.md`: Proposed manifest/data structure for injectable heroes, worm enemies, weapons, loot, and comic assets.
- `audio_plan.md`: Phase 6 implementation plan for music, sound effects, event naming, variant pools, and missing-asset fallbacks.
- `future_development_plan.md`: Suggested development roadmap for gameplay, content, tooling, packaging, and eventual Steam readiness.
- `bugs.md`: Active bug tracker. Statuses: TBD → IPG → VAL → DON. Take the first TBD bug, mark IPG, fix it, mark VAL, commit, remove entry.
- `smoke_checklist.md`: Manual verification checklist for gameplay/rendering patches.
- `backlog.md`: Long-horizon design questions and open-ended discussions (sprites, scrolling maps, terrain, enemies, loot). This is the backlog — not immediate work.
- `wasteland_survivors_feature_plan.md`: Historical/completed feature ledger plus near-term backlog.

## Root Entry Points

- `plan.md`: Immediate action plan — phased implementation steps, commit targets, and status. Phases 0–4 complete; Phase 5 complete; Phase 6 is partially started and next to finish.
- `../AGENTS.md`: Agent roles, token-saving workflow, and guardrails.
- `../CLAUDE.md`: Short Claude-specific entry point that forwards to this index.

## Read Matrix

| Task | Read |
|---|---|
| Quick gameplay summary | `current_game_state.md` |
| Bug fix in current game | `implementation_notes.md` + targeted code search |
| Balance change | `current_game_state.md`, then relevant code ranges |
| Add ability, weapon, enemy, or loot | `current_game_state.md` + `implementation_notes.md` |
| Architecture split | `modularization_plan.md` |
| Asset/content pipeline | `asset_injection_plan.md` + `lore/PRAY_ the game.md` |
| Audio, music, or sound effects | `audio_plan.md` + targeted event code |
| Roadmap or feature sequencing | `future_development_plan.md` |
| Verify a patch | `smoke_checklist.md` |

## Documentation Rule

Keep docs short and non-duplicative. If a topic grows large, create a focused subfolder, for example:

- `docs/combat/overview.md`
- `docs/combat/loot.md`
- `docs/world/camera.md`
