# Agents Guide

Wasteland Survivors is currently a single-file Canvas 2D survival tactics game. The working game lives in `wasteland_survivors-v4.html`; project memory lives in `docs/`.

This file is intentionally short. Start here, then read only the smallest doc that answers the task.

## Token-Saving Workflow

1. Read `docs/index.md`.
2. Pick one role and one target system.
3. Read the target system doc only.
4. Patch narrowly.
5. Update docs only when behavior, architecture, or roadmap changes.

Avoid reading every markdown file by default. Avoid broad refactors unless `docs/modularization_plan.md` says the current phase allows it.

## Role Map

- `implementation-agent`: small approved game-code changes.
- `systems-design-agent`: staged architecture and feature plans.
- `balance-agent`: waves, drop rates, damage, pacing.
- `combat-loot-agent`: attacks, abilities, pickups, temporary weapons.
- `rendering-agent`: Canvas clarity, telegraphs, HUD, performance.
- `map-world-agent`: terrain, spawning context, camera/world-space work.
- `docs-agent`: keep docs concise, indexed, and non-duplicative.

## Current Guardrails

- Preserve `wasteland_survivors-v4.html` as the playable golden file until a build pipeline exists.
- Keep new docs under `docs/` and link them from `docs/index.md`.
- Prefer data extraction and adapter layers before splitting runtime code into many files.
- For large work, create a plan markdown first, then implement in small phases.
