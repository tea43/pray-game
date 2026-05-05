# Agents Guide

P-RAY: The Game is a browser Canvas 2D survival tactics game. The modular source lives in `src/`; project memory lives in `docs/`.

This file is intentionally short. Start here, then read only the smallest doc that answers the task.

## Token-Saving Workflow

1. Read `docs/index.md`.
2. Pick one role and one target system.
3. Read the target system doc only.
4. Patch narrowly.
5. **Before committing:** review changed files and update the docs that describe those systems.
6. If no doc covers what changed, add a concise entry to `docs/current/current_game_state.md`.

**End-of-phase close-out (when user signals phase is done):**
- Update `docs/current/current_game_state.md` to reflect the game as it stands now.
- Move the fulfilled plan from `docs/planning/` to `docs/executed/`, marking completed items.
- Update `docs/planning/plan.md` for the new current phase.
- Commit doc updates in the same or immediately following commit.

The documentation trail is what lets the next agent work without reading all the source code. Treat it as a first-class deliverable, not an afterthought.

Avoid reading every markdown file by default. Avoid broad refactors unless `docs/planning/plan.md` says the current phase allows it.

## Role Map

- `implementation-agent`: small approved game-code changes.
- `systems-design-agent`: staged architecture and feature plans.
- `balance-agent`: waves, drop rates, damage, pacing.
- `combat-loot-agent`: attacks, abilities, pickups, temporary weapons.
- `rendering-agent`: Canvas clarity, telegraphs, HUD, performance.
- `map-world-agent`: terrain, spawning context, camera/world-space work.
- `docs-agent`: keep docs concise, indexed, and non-duplicative.

## Current Guardrails

- The primary playable build is served from `src/` via `npm run dev` (Vite). `index.html` is the entry point.
- Keep new docs under `docs/` and link them from `docs/index.md`.
- Prefer data extraction and adapter layers before splitting runtime code into many files.
- Keep future content asset-injectable; see `docs/planning/asset_injection_plan.md`.
- For large work, create a plan markdown in `docs/planning/` first, then implement in small phases.
- **Never commit without a documentation trace.** If the commit changes observable behaviour or internal structure, at least one doc must reflect it.
- **Human commits:** if the author is about to commit without Claude, they should tell Claude first so docs can be updated before the commit runs.
