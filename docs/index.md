# Docs Index

This index gives a quick brief for every markdown file currently in `/docs` so models can understand project context without reading all files first.

## File Summaries

- Name: `future_discussion.md`
  Brief description: Exploratory design discussion for future expansions, including character sprite migration, enemy architecture options, scrolling/world-space maps, terrain systems, and long-term enemy/loot evolution.

- Name: `implementation_notes.md`
  Brief description: Technical reference of current game behavior and code architecture in `wasteland_survivors-v4.html`, covering time-flow, character rendering, combat, enemy visuals/logic, and map generation/spawning internals.

- Name: `wasteland_survivors_feature_plan.md`
  Brief description: Implementation plan for prioritized features with suggested code touchpoints and risk levels, including wave cap/victory flow, canvas sizing, loot-drop tuning, and special weapon drop systems.

## Root Entry Points

- Name: `../claude.md`
  Brief description: Root-level project brief for models and agents with a quick pointer to this index.

- Name: `../agents.md`
  Brief description: Root-level role map for agent responsibilities and task-routing guidance.

## Scaling Rule for Large Topics

If a single topic grows too large to summarize clearly in one markdown file, create a dedicated subfolder under `/docs` for that topic and split content into focused markdown files.

Example:
- `/docs/combat/overview.md`
- `/docs/combat/loot.md`
- `/docs/combat/enemy_scaling.md`
