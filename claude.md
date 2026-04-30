# Claude Guide

P-RAY: The Game is a browser Canvas survival tactics prototype with three survivors, movement-driven time flow, alien worm waves, bosses, loot drops, and temporary weapon spikes.

Use `AGENTS.md` for role routing. Use `docs/index.md` as the navigation hub.

## Fast Context

- Playable source: `wasteland_survivors-v4.html`
- Documentation hub: `docs/index.md`
- Current game snapshot: `docs/current_game_state.md`
- Modularization path: `docs/modularization_plan.md`
- Asset injection path: `docs/asset_injection_plan.md`
- Future roadmap: `docs/future_development_plan.md`

## Working Principle

Spend tokens on the subsystem being changed, not the whole project. Read `docs/index.md`, choose the smallest relevant file, then inspect exact code ranges with search.

## Documentation Discipline

Every change must leave a documentation trace so the next agent starts with an accurate picture.

**Before every git commit:**
1. Review the files you changed.
2. Identify which docs in `docs/` describe the affected system (use `docs/index.md` as the map).
3. Update those docs to reflect the new behaviour, removed effects, or refactored structure.
4. If no existing doc covers what changed, add a short note to `docs/current_game_state.md`.

**End of a phase:**
When the user signals a phase is complete and work is moving to the next, the final action before closing out is a documentation pass:
1. Update `docs/current_game_state.md` with what the game does now.
2. Update any plan or roadmap doc (`docs/modularization_plan.md`, `docs/future_development_plan.md`) to mark completed items and adjust upcoming steps.
3. Commit the doc updates together with, or immediately after, the last code commit of the phase.

The goal is that any agent dropped into the project cold should be able to read `docs/index.md` and get an accurate, up-to-date picture without diffing the source.
