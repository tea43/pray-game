# P-RAY Build And Steam Plan

> **This file is the immediate action plan** — phases with clear scope, implementation steps, and commit targets.
> For larger design questions, open-ended ideas, and long-horizon discussions see [`backlog.md`](backlog.md).
> Phases 0–5 complete. Phase 6 (Audio) in progress. Between-wave upgrades complete (executed separately, see `docs/executed/bwaves_feature_dev_plan.md`). Realistic abilities rework complete (see `docs/executed/realistic_abilities_plan.md`).

Ultimate goals:

- Keep a single-file HTML build available.
- Keep the game eligible for Steam packaging.
- Develop in small phases, separated by commits and manual testing.

## Time Flow Mechanics

The time system is a core design pillar and must be preserved across every phase.

**Speed multiplier** (`+` / `-` keys):
- Controls the rate at which game time runs: x1 (default), x2, or x3.
- Does not pause or unpause. Purely a speed dial.

**Manual pause** (`SPACE` tap, < 1 second hold):
- Toggles an explicit freeze on/off.
- While paused, the world is stopped even if survivors are moving.
- Pressing Space again resumes.

**Hold to advance** (`SPACE` hold, ≥ 1 second):
- While physically held, drives time forward at the current speed multiplier.
- Useful for advancing time from a paused state without fully unpausing.
- Releasing returns to the state before the hold (paused or idle).

**Activity-driven flow**:
- If no survivors are moving and no other driver is active, time stops.
- Movement drives time at the current speed multiplier.

**Priority order** (highest first):
1. Game over → always frozen.
2. Space held ≥ 1s → run at speed multiplier.
3. Manual pause active → frozen.
4. Any survivor moving → run at speed multiplier.
5. Otherwise → frozen.

**State fields**:
- `timeSpeed`: integer 1–3. Default 1.
- `manualPause`: bool. Toggled by Space tap.
- `spaceHeld`: bool. True while Space key is physically down.
- `spaceHoldDuration`: float. Seconds the current Space press has been held.
- `timeFlow`: float 0–3. Smoothly interpolated toward `targetFlow` each frame.

## Working Rules

- Every phase ends with one focused commit.
- Every gameplay/rendering phase gets a manual smoke test before the next phase starts.
- Documentation-only phases get syntax/link review, then commit.
- `wasteland_survivors-v4.html` remains the golden playable file until modular build parity exists.
- Modular source must be able to produce both normal and single-file builds.
- Assets must be optional: if an asset is missing, the current Canvas primitive drawing is used.

## Phase 0: Lore And Planning Baseline

Status: completed in commit `31da7c9`, with root-guide follow-up in `980d497`.

Goal:

- Align the prototype with the P-RAY name and worm setting.
- Capture the asset injection and single-HTML/Steam direction in docs.

Implementation:

- Rename player-facing title to `P-RAY: The Game`.
- Keep legacy enemy IDs internally, but document worm-facing display names.
- Correct hero identity mapping:
  - Dick/Richard: bruiser, Rage, dual clubs.
  - Habib: ranged/control, Chain Lightning, thrown club.
- Add `docs/asset_injection_plan.md`.
- Update modularization docs with normal and single-file build targets.

Manual test:

- Open `wasteland_survivors-v4.html`.
- Confirm title reads P-RAY.
- Confirm Dick uses `W` Rage.
- Confirm Habib uses `E` Chain Lightning.
- Confirm restart still works.

Commit:

- `Align P-RAY lore and asset planning`

## Phase 1: In-File Data Boundaries

Status: implemented. Browser boot/speed smoke passed; full gameplay smoke should run before Phase 2.

Goal:

- Prepare the single-file game for modular extraction without changing behavior.

Implementation:

- Add compact config objects near the top of the script:
  - `HERO_DEFS`
  - `ENEMY_DEFS`
  - `LOOT_DEFS`
  - `WAVE_DEFS`
  - `DISPLAY_NAME_DEFS`
- Keep classes and functions in the same HTML file.
- Constructors may read from config, but behavior must remain identical.
- Add asset/display fallback names, but do not load external assets yet.

Manual test:

- Run the smoke checklist in `docs/smoke_checklist.md`.
- Pay special attention to hero abilities, enemy spawning, drops, and victory/defeat overlays.

Commit:

- `Extract in-file game definitions`

## Phase 2: Lightweight Test Harness

Status: implemented with `node scripts/check-game-data.js`; browser boot test should still run after gameplay/rendering changes.

Goal:

- Validate data and spawn/drop behavior without needing a full playthrough.

Implementation:

- Add a minimal Node test script or small test runner.
- Test:
  - hero definitions
  - enemy wave availability
  - loot drop tables
  - boss reward bundles
  - single-file script parse

Command:

- `node scripts/check-game-data.js`

Manual test:

- Run automated checks.
- Open the game once and confirm it still boots.

Commit:

- `Add lightweight game data checks`

## Phase 3: Modular Source Skeleton

Goal:

- Introduce `src/` without replacing the golden HTML yet.

Implementation:

- Add Vite or a similarly small bundler.
- Create module folders:
  - `src/config`
  - `src/utils`
  - `src/systems`
  - `src/entities`
  - `src/render`
- Copy or mirror config first.
- Keep `wasteland_survivors-v4.html` as the playable reference.

Manual test:

- Existing HTML still works.
- `npm run dev` boots the modular shell if present.

Commit:

- `Add modular source skeleton`

## Phase 4: Modular Build Parity

Status: completed. `npm run dev` serves the modular game. All systems extracted and confirmed playable.

Goal:

- Make modular source reproduce the current game.

Implementation order:

1. Utilities.
2. Config.
3. State/reset.
4. Projectiles and loot.
5. Time, spawning, combat, abilities.
6. Units and enemies.
7. Rendering.
8. Input and main loop.

Manual test:

- Run `docs/smoke_checklist.md` against both:
  - golden HTML
  - modular dev build

Commit:

- One commit per extracted system, for example `Extract time and spawning systems`.

## Phase 5: Menu And Score

Status: completed.

Goal:

- Give the player a proper entry point and visible progress tracking.

Implementation:

- Main menu screen before the game starts:
  - Title card: P-RAY: The Game.
  - Start button.
  - Settings button.
  - Credits placeholder.
- Pause menu (ESC key):
  - Resume, Restart, Main Menu options.
  - Volume slider placeholder (wired up in Phase 6).
  - Difficulty selector — four tiers:
    - Cavity Cadet (easy)
    - Brood Hunter (default)
    - The Crack Knight (hard)
    - Rear Admiral (brutal)
- Score / point counter:
  - Points awarded for kills (scaled by enemy tier).
  - Minus points for each death of a character.
  - Bonus points for wave clears.
  - Displayed in the HUD during play.
  - Final score shown on the game-over and victory screens.
- High score persisted to localStorage.

Manual test:

- Main menu appears on load.
- ESC pauses and shows menu.
- Score increments on kills and wave clears.
- High score survives a page refresh.

Commit:

- `Add main menu, pause menu, and score system`

## Phase 6: Audio System

Status: partially started in modular source. `src/systems/audio.js` exists with a first-pass Web Audio wrapper, synthetic fallbacks, basic event hooks, and pause-menu volume controls. Phase 6 is not complete until real/missing-asset manifest behavior, richer event coverage, boss-specific cues, and documentation-backed smoke tests are in place.

Goal:

- Add music and sound effects that respond to game events.
- Support multiple interchangeable sound variants for repeated events such as enemy deaths, attacks, menu clicks, and boss cues.

Implementation:

- `src/systems/audio.js` wrapping Web Audio API or `<audio>` elements.
- Audio manifest/config with event IDs and variant arrays; see [`audio_plan.md`](audio_plan.md).
- Store fetched audio under `public/assets/audio/`; `catalog.json` maps event IDs to folders and `npm run audio:manifest` generates `manifest.json`.
- Music tracks:
  - Menu / ambient track.
  - Combat loop that intensifies on later waves.
  - Boss encounter track.
  - Victory and defeat stings.
- Sound effects (event-driven, not per-frame):
  - Hit / kill.
  - Ability activation.
  - (Optional) Loot pickup.
  - Wave start announcement.
  - Boss spawn.
- Expanded sound events:
  - Menu/UI: hover, click, back, start, pause, resume.
  - Enemy deaths by kind, each with multiple variants and a generic fallback.
  - Hero hurt/death by character.
  - Boss movement, slam charge, slam impact, spawn, and death by boss kind.
  - Weapon and loot-specific cues where they add clarity.
- `playSfx(id, options)` should support random variants, small pitch/gain variation, cooldown/throttle keys, and fallback IDs.
- Missing specific events must fall back in order: specific event → generic event → current synthetic oscillator sound → silence.
- Volume controlled via settings; defaults to 50%.
- Internally separate master/music/SFX/UI volumes even if only master volume is exposed initially.
- Audio must be optional: missing files are silently skipped, no crash.
- Pause menu (Phase 5) exposes master volume slider.
- Add a small debug/log summary for loaded versus missing audio assets.

Manual test:

- Game runs silently if no audio files are present.
- With placeholder tracks, music switches at boss spawn.
- Volume slider takes effect immediately.
- Repeated enemy deaths choose varied death sounds.
- Boss movement, slam charge, slam impact, and death sounds fire once at their event boundaries.
- Menu/settings buttons produce UI sounds after audio is unlocked by user interaction.

Commit:

- `Add audio system with event-driven music and sfx`

## Phase 7: Lore And Cutscenes

Goal:

- Engage players with the P-RAY story without interrupting gameplay flow.

Implementation:

- Comic panel viewer (`src/systems/cutscene.js`):
  - Displays a sequence of panels with optional caption text.
  - Player advances with click or Space.
  - Panels are defined in `assets/comics/prologue/scene.json`.
- Trigger points:
  - Prologue on first game start (or from main menu).
  - Short "chapter card" (title + quote) at wave milestones: wave 5, 10, 15.
  - Boss intro card before the first miniboss and bigboss.
  - Epilogue on victory.
- Lore can display even if comic image assets are missing (text-only fallback).
- Lore content source: `docs/lore/PRAY_ the game.md`.

Manual test:

- Prologue plays on first start.
- Chapter cards appear at the right waves.
- Skipping works at every trigger point.
- Game continues normally after each cutscene.

Commit:

- `Add cutscene system and lore trigger points`

## Phase 8: Asset Registry And Enemy Visual Overhaul

Goal:

- Support injectable sprites and give enemies visuals that match the worm setting.

Implementation:

- Asset registry (`src/config/assets.js` + `assets/manifest.json`):
  - Renderer order: loaded sprite → configured primitive fallback → legacy primitive → debug placeholder.
  - Missing assets never block gameplay.
- Enemy visual model:
  - Regular worms (Hatchling, Dart, Husk, Brute): segmented worm/snake body, drawn as a short chain of circles scaling with HP tier.
  - Phase Worm: same worm body with blink ghost trail.
  - Miniboss (Brood Warden): larger multi-segment worm, distinct color.
  - Bigboss (Elder Worm): giant worm. Undecided whether to keep it as a pure worm or add humanoid mutant torso on the front segment — leave as a config flag for now so both can be compared in-game.
- Hero sprites: placeholder portraits first; full sprites deferred.
- Weapon and loot icons: small sprites or keep Canvas primitives until art is ready.

Manual test:

- Run with no assets — primitives still render.
- Swap in one worm sprite sheet and confirm it loads and falls back cleanly.
- Miniboss and bigboss are visually distinct from regular enemies.

Commit:

- `Add asset registry and worm visual models`

## Phase 9: World Exploration And Environment

Goal:

- Move from a static screen-space arena to a scrollable world with physical obstacles.

Implementation:

- Camera and world coordinates:
  - Add a `camera` object with world-space position.
  - All entity positions stored in world space; camera transform applied at render time.
  - HUD stays in screen space.
  - Static arena mode remains available as a dev toggle.
  - Camera frames all living survivors; centroid of the squad is the anchor point.
  - When a survivor dies the camera re-centers on the remaining survivors.
- Non-penetrable environment blocks:
  - Walls, ruined structures, and debris that block movement for survivors and enemies.
  - Defined as axis-aligned rectangles in world config.
  - Line of sight does not pass through walls: enemies behind a wall are hidden until a survivor has line of sight to them. A survivor behind a wall reveals what is on their side only.
  - Blink (Elliot's ability) does not pass through walls. If the target point is inside or beyond a wall, the blink stops at the nearest clear position before the wall — Elliot cannot get stuck.
  - Collision resolution pushes units to the nearest clear position; does not teleport them.
  - Enemies use simple pathfinding (waypoint or steering) to navigate around obstacles toward survivors.
  - Renders as distinct terrain tiles with dark/solid visual treatment.
- Terrain chunks:
  - World is larger than the screen; procedural chunks generated around camera bounds.
  - Spawn enemies relative to camera bounds, not canvas bounds.
- Slow terrain zones and hazard pools (optional first pass; can defer to a sub-phase).

Manual test:

- Camera follows the squad centroid.
- Survivors cannot walk through wall blocks.
- Enemies pathfind around or are blocked by walls.
- Loot and corpses remain in world space while camera moves.

Commit:

- `Add camera, world coordinates, and impassable environment blocks`

## Phase 10: Single-HTML Build

Goal:

- Generate a self-contained HTML file from modular source.

Implementation:

- Add `npm run build`.
- Add `npm run build:single`.
- Output:
  - `dist/index.html`
  - `dist/pray-game.single.html`
- Inline JavaScript and CSS.
- Inline only small assets by default.
- Keep large assets external unless single-file mode explicitly inlines them.

Manual test:

- Open `dist/pray-game.single.html` directly.
- Confirm the same smoke checklist passes.

Commit:

- `Add single HTML build target`

## Phase 11: Steam Wrapper


Goal:

- Package the built game for Steam while preserving browser/single-file builds.

Implementation:

- Choose Tauri or Electron.
- Load either `dist/index.html` or `dist/pray-game.single.html`.
- Add:
  - fullscreen/windowed mode
  - settings storage
  - volume controls
  - key remapping
  - pause/options menu
  - platform build scripts

Manual test:

- Launch desktop wrapper.
- Run smoke checklist.
- Confirm settings persist after restart.

Commit:

- `Add desktop wrapper prototype`

## Phase 12: Steamworks Integration

Goal:

- Add Steam features only after the desktop wrapper is stable.

Implementation:

- Achievements.
- Cloud saves.
- Optional stats.
- Store build/depot preparation.

Manual test:

- Test with Steam sandbox tooling.
- Confirm non-Steam local build still runs.

Commit:

- `Add Steamworks integration baseline`
