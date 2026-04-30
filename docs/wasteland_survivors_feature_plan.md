# P-RAY Feature Ledger

This file records notable feature decisions so future agents do not treat completed work as pending.

## Completed In Current v4

| Feature | Current State |
|---|---|
| 21-wave cap | Implemented. Victory triggers when wave 21 completes. |
| Full-window canvas | Implemented at roughly 97% of browser window. |
| Reduced regular bomb rate | Implemented. Regular drop split is 60% medkit, 35% stimpack, 5% bomb. |
| Higher hard-enemy drops | Implemented. Burrow brute legacy `mutant` is 100%; phase worm legacy `blinker` is 80%. |
| Special weapon drops | Implemented. Hard enemies can drop spray gun, samurai sword, or rare banana bomb. |
| Boss reward bundles | Implemented. Miniboss guarantees basic loot plus one special weapon. Bigboss guarantees basic loot, banana bomb, and one special weapon. |
| Temporary weapon behavior | Implemented. Spray gun and samurai sword alter attack behavior for a timed duration. |

## Open Small Features

| Feature | Owner | Risk | Notes |
|---|---|---|---|
| Manual smoke checklist | `docs-agent` | Low | Add a compact browser test list for every patch. |
| Pickup text parity | `combat-loot-agent` | Low | Medkit/stimpack have clear text; add text for bomb and special weapons consistently. |
| In-file data tables | `systems-design-agent` | Medium | Extract definitions without changing behavior. |
| Balance pass after specials | `balance-agent` | Medium | Check whether special drops trivialize waves 9-21. |
| Late-wave particle budget | `rendering-agent` | Medium | Ensure bosses, explosions, and spray gun do not obscure key telegraphs. |
| Worm display-name mapping | `systems-design-agent` | Low | Keep legacy IDs internally while exposing P-RAY worm names in data/display config. |

## Larger Feature Candidates

| Feature | Dependency |
|---|---|
| Between-wave upgrades | Needs stable balance tables. |
| Spitter worm enemy | Needs cleaner enemy behavior hooks. |
| Terrain with movement effects | Needs world/camera or at least terrain query abstraction. |
| Sprite or hybrid art pipeline | Needs asset structure and render abstraction. |
| Asset manifest loading | Follow `asset_injection_plan.md`. |
| Modular build | Follow `modularization_plan.md`. |

## Rule For New Feature Plans

Add new feature plans as short sections with:

- desired player-facing behavior
- target code area
- expected risk
- test/smoke check

Move completed features into the ledger above instead of leaving stale TODOs.
