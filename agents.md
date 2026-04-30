# Agents Guide

Wasteland Survivors is a single-file canvas survival game with three survivors, wave progression, enemy variety, and loot-based power spikes.

Primary navigation hub:
- docs/index.md

This file is the root-level quick role map for agents.

## Agent Roles

- implementation-agent: implement approved features in game code with minimal, testable edits.
- systems-design-agent: turn future ideas into staged technical plans with trade-off analysis.
- balance-agent: tune pacing, drop rates, damage curves, and reward consistency.
- combat-loot-agent: own attack branching, temporary weapon behavior, and pickup effects.
- rendering-agent: maintain draw clarity, telegraphs, and canvas performance.
- map-world-agent: handle terrain, spawning context, camera, and world-space transitions.

## Recommended Agent Workflow

1. Read docs/index.md first.
2. Choose one primary agent role for the task.
3. Keep changes scoped to one system family per patch.
4. Escalate to systems-design-agent before large refactors.
