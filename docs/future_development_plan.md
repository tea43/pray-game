# Future Development Plan

This roadmap keeps the project agent-friendly: each milestone has a narrow owner, a clear outcome, and minimal cross-system churn.

## Near-Term Priorities

### 1. Stabilize The Prototype

Owner: `implementation-agent`

- Add a manual smoke checklist.
- Confirm restart, victory, defeat, resizing, selection, abilities, loot, and boss shockwaves.
- Fix obvious edge cases before adding major content.

Outcome: current single-file prototype is reliable enough to use as a golden reference.

### 2. Extract Data Tables In Place

Owner: `systems-design-agent`

- Create compact in-file definitions for heroes, enemies, loot, waves, and special weapons.
- Keep behavior unchanged.
- Update `current_game_state.md` after extraction.

Outcome: balance agents can tune tables without scanning large constructors.

### 3. Balance Pass

Owner: `balance-agent`

- Validate 21-wave pacing.
- Tune spawn growth, hard enemy frequency, and boss timing.
- Review drop rates after special weapons and banana bomb were added.
- Decide whether loot should expire or persist.

Outcome: one complete run feels tense but fair.

### 4. Combat-Loot Polish

Owner: `combat-loot-agent`

- Add floating pickup text for bomb, banana bomb, spray gun, and samurai sword.
- Clarify temporary weapon timers in the HUD or above survivors.
- Decide whether `stimpack` should be a generic rage effect or a unique buff.

Outcome: power spikes are readable and satisfying.

### 5. Rendering Readability

Owner: `rendering-agent`

- Check telegraph clarity for blinkers and bigboss slam.
- Keep enemies distinguishable at full-window scale.
- Audit particle density during late waves.

Outcome: players can read threats during chaos.

## Mid-Term Milestones

### Modular Build

Owner: `systems-design-agent` plus `implementation-agent`

- Follow `modularization_plan.md`.
- Introduce Vite only after in-file boundaries and smoke checks exist.
- Preserve the golden HTML file during migration.

Outcome: future agents work on focused files instead of one large script.

### Enemy Expansion

Owner: `combat-loot-agent`

Candidates:

- Ranged thrower: fires a slow projectile with a clear telegraph.
- Shielder: resists frontal damage, rewards flanking.
- Spitter: creates temporary hazard zones.
- Support enemy: buffs nearby enemies, low direct damage.

First requirement: enemy stats and behavior hooks must be table-driven or modular enough to avoid making `Enemy.update()` harder to read.

### Hero Progression

Owner: `balance-agent`

Options:

- Between-wave upgrade choices.
- Per-hero passive upgrades.
- Shared squad perks.
- Temporary weapon mastery bonuses.

Keep the first version small: one upgrade choice every few waves is enough to test the loop.

### World Expansion

Owner: `map-world-agent`

- Add world/camera separation.
- Keep static arena mode available while testing.
- Add terrain zones only after camera transform is stable.

First terrain mechanics:

- Slow terrain.
- Impassable ruins.
- Hazard pools.

## Long-Term Steam Path

### Desktop Packaging

Owner: `systems-design-agent`

- Produce deterministic `dist/` builds.
- Package with Electron or Tauri.
- Add fullscreen, windowed mode, volume controls, remapping, and local settings.

### Content Pipeline

Owner: `rendering-agent`

- Decide whether to keep primitive Canvas art, move to sprites, or use a hybrid.
- If sprites are introduced, define a strict asset layout before creating many assets.
- Track licenses for every shipped asset.

### Steam Readiness

Owner: `systems-design-agent`

- Stable save/settings format.
- Steam capsule/key art plan.
- Controller support decision.
- Performance target on low-end Windows hardware.
- Optional Steamworks features after the game loop is stable: achievements, cloud saves, stats.

## Suggested Next Patch

Do a non-behavioral in-file data extraction:

- `HERO_DEFS`
- `ENEMY_DEFS`
- `LOOT_DEFS`
- `WAVE_DEFS`
- `SPECIAL_WEAPON_DEFS`

This is the highest leverage setup step for efficient token use because it gives future agents small tables to inspect before touching gameplay code.
