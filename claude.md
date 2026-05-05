# Claude Guide

P-RAY: The Game is a browser Canvas survival tactics game. Three survivors, movement-driven time flow, alien worm waves, bosses, loot drops, temporary weapon spikes, and between-wave upgrades.

Use `agents.md` for role routing. Use `docs/index.md` as the navigation hub.

## Fast Context

- Playable entry point: `index.html` (served via `npm run dev`; modular source in `src/`)
- Documentation hub: `docs/index.md`
- Current game snapshot: `docs/current/current_game_state.md`
- Active build phases: `docs/planning/plan.md`
- Asset injection spec: `docs/planning/asset_injection_plan.md`
- Future roadmap: `docs/planning/future_development_plan.md`

## Working Principle

Spend tokens on the subsystem being changed, not the whole project. Read `docs/index.md`, choose the smallest relevant file, then inspect exact code ranges with search.

## Documentation Discipline

Every change must leave a documentation trace so the next agent starts with an accurate picture.

### When Claude is committing

Before every `git commit`, Claude must:
1. Review every file changed in the commit.
2. Identify which docs in `docs/` describe the affected systems (use `docs/index.md` as the map).
3. Update those docs to reflect the new behaviour, removed effects, or refactored structure.
4. If no existing doc covers what changed, add a short note to `docs/current/current_game_state.md`.
5. Include doc changes in the same commit (or a doc-only follow-up commit immediately after).

### When the author is committing without Claude

**Tell Claude before you run `git commit`.**

Say something like: "I'm about to commit [description of what changed]." Claude will:
1. Review the diff.
2. Update the relevant docs.
3. Stage the doc changes so they are included in your commit.

Never commit code that changes observable behaviour or internal structure without a documentation trace.

### End of a phase

When the user signals a phase is complete and work is moving to the next, the final action is a documentation pass:
1. Update `docs/current/current_game_state.md` with what the game does now.
2. Move any fulfilled plan doc from `docs/planning/` to `docs/executed/` and mark items complete.
3. Update `docs/planning/plan.md` to reflect the new current phase.
4. Commit the doc updates together with, or immediately after, the last code commit of the phase.

The goal is that any agent dropped into the project cold should be able to read `docs/index.md` and get an accurate, up-to-date picture without diffing the source.
