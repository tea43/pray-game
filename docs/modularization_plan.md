# Modularization Plan

Goal: make Wasteland Survivors manageable for humans and agents without corrupting the current playable file.

The current game should remain shippable as `wasteland_survivors-v4.html` until a build system can reproduce the same behavior from modules.

## Principles

- Preserve the current HTML as a golden reference.
- Extract in phases, starting with data and pure helpers.
- Keep each phase playable.
- Prefer small compatibility adapters over a dramatic rewrite.
- Create code ownership boundaries that match agent roles.
- Avoid module churn until tests or smoke checks exist.

## Proposed Final Shape

```text
pray_game/
  wasteland_survivors-v4.html        # current golden prototype
  dist/
    index.html                       # generated playable build later
  src/
    main.js                          # bootstraps canvas, state, loop
    state.js                         # createInitialState, reset helpers
    config/
      heroes.js
      enemies.js
      loot.js
      waves.js
    systems/
      input.js
      time.js
      combat.js
      abilities.js
      loot.js
      spawning.js
      world.js
    entities/
      Unit.js
      Enemy.js
      Projectile.js
      SprayBullet.js
      Loot.js
    render/
      background.js
      units.js
      enemies.js
      loot.js
      hud.js
      effects.js
    utils/
      math.js
      canvas.js
  tests/
    balance.test.js
    wave_spawns.test.js
    loot_tables.test.js
  docs/
```

This shape keeps gameplay systems visible and gives agents narrow files to inspect.

## Phase 0: Documentation And Golden File

Status: in progress.

Actions:

- Keep `wasteland_survivors-v4.html` unchanged unless implementing gameplay.
- Maintain `docs/current_game_state.md` as a fast state summary.
- Maintain this plan before any large refactor.
- Add a tiny smoke checklist for manual testing after code changes.

Exit criteria:

- Agents can understand current game state from docs before opening the HTML.

## Phase 1: In-File Boundaries

No module split yet. Improve the current file by making sections easier to extract later.

Actions:

- Add section comments only where missing.
- Move constants and definition objects near the top:
  - hero definitions
  - enemy definitions
  - loot definitions
  - wave definitions
- Convert repeated magic numbers into named config values.
- Keep constructors reading from config, but do not change runtime behavior.

Why this phase matters:

Agents can patch balance by editing small tables instead of scanning constructor branches.

Exit criteria:

- Hero, enemy, loot, and wave tuning can be changed from compact definitions.
- Current HTML still opens directly in a browser.

## Phase 2: Test Harness Before Split

Add validation without changing the runtime.

Actions:

- Create a minimal Node-based test harness for pure config functions.
- Test enemy spawn pool by wave.
- Test loot tables and boss drop bundles.
- Test ability and weapon constants.
- Add a manual browser smoke checklist in docs.

Exit criteria:

- Balance/config edits can be checked without playing a full run.

## Phase 3: Build Pipeline

Introduce modules while still producing a simple browser build.

Recommended stack:

- Vite for local development and bundling.
- Plain JavaScript modules first; TypeScript can wait until systems stabilize.
- Keep Canvas 2D rendering; no engine migration unless gameplay demands it.

Actions:

- Create `src/` with copied code slices.
- Build `dist/index.html`.
- Keep `wasteland_survivors-v4.html` as legacy golden reference.
- Compare behavior manually after each extracted system.

Exit criteria:

- `npm run dev` serves the modular game.
- `npm run build` creates a static `dist/` version.
- The legacy file is still available for comparison.

## Phase 4: System Extraction Order

Extract low-risk pieces first.

1. `utils/math.js`: `rand`, `randInt`, `dist2`, `clamp`.
2. `config/*.js`: data tables.
3. `state.js`: initial state and reset helpers.
4. `entities/Projectile.js`, `SprayBullet.js`, `Loot.js`.
5. `systems/loot.js`, `spawning.js`, `time.js`.
6. `entities/Unit.js`, then split abilities/combat helpers.
7. `entities/Enemy.js`, then split enemy behaviors.
8. `render/*`: drawing only after entity behavior is stable.
9. `input.js` and `main.js`.

Avoid extracting rendering first. It is tightly coupled to entity state and easiest to break visually.

## Phase 5: World-Space Upgrade

Only after modular build works.

Actions:

- Add `camera` and world coordinates.
- Wrap world rendering in camera transform.
- Keep HUD in screen space.
- Convert terrain generation from screen-sized decoration to world chunks.
- Spawn enemies around camera bounds, not canvas bounds.

Exit criteria:

- Static arena and scrolling world can be toggled or compared during development.

## Phase 6: Steam-Oriented Packaging

Steam readiness does not require changing the core game loop immediately.

Likely path:

- Package the web build with Electron or Tauri.
- Add fullscreen/window settings, save files, controller/key rebinding, audio settings, pause menu, and crash-safe local storage.
- Evaluate Steamworks integration only after the desktop wrapper is stable.

Steam-facing architecture needs:

- Deterministic build output in `dist/`.
- Asset folder with clear licenses.
- Versioned save format.
- Input abstraction for keyboard/mouse and later controller support.
- Performance budget and resolution scaling.

## What Not To Do Yet

- Do not replace the Canvas game with a new engine just to modularize.
- Do not split every draw helper into tiny files before tests exist.
- Do not introduce multiplayer, persistence, or procedural world streaming before the core loop is stable.
- Do not delete the golden single-file build until modular build parity is proven.
