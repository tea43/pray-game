# P-RAY Build And Steam Plan

Ultimate goals:

- Keep a single-file HTML build available.
- Keep the game eligible for Steam packaging.
- Develop in small phases, separated by commits and manual testing.

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

## Phase 5: Single-HTML Build

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

## Phase 6: Asset Registry And Fallbacks

Goal:

- Support injectable heroes, worm enemies, weapons, loot, and comic panels.

Implementation:

- Add an asset registry.
- Read definitions from manifest/config.
- Renderer order:
  1. loaded asset
  2. configured primitive fallback
  3. legacy primitive fallback
  4. debug placeholder
- Missing assets must never block gameplay.

Manual test:

- Run once with no external assets.
- Run once with one test asset injected.
- Confirm both paths render.

Commit:

- `Add asset registry with primitive fallbacks`

## Phase 7: Steam Wrapper

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

## Phase 8: Steamworks Integration

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
