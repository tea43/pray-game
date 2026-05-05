# Agents Guide

Read `docs/index.md` first. It is the navigation hub for all project docs.

## Documentation Discipline

Every change must leave a documentation trace so the next agent starts with an accurate picture.

### Before committing

1. Review every file changed in the commit.
2. Identify which docs in `docs/` describe the affected systems (use `docs/index.md` as the map).
3. Update those docs to reflect the new behaviour, removed effects, or refactored structure.
4. If no existing doc covers what changed, add a concise entry to `docs/current/current_game_state.md`.
5. Include doc changes in the same commit (or a doc-only follow-up commit immediately after).

### End of a phase

When the user signals a phase is complete:
1. Update `docs/current/current_game_state.md` to reflect the game as it stands now.
2. Move the fulfilled plan from `docs/planning/` to `docs/executed/`, marking completed items.
3. Update `docs/planning/plan.md` for the new current phase.
4. Commit doc updates in the same or immediately following commit.

### Human commits

If the author is about to commit without Claude, they should say so first. Claude will review the diff, update the relevant docs, and stage the changes before the commit runs.
