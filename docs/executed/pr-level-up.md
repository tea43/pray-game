# PR: Essence Drops, XP, and Player Level

Vampire-Survivors-style progression layer on top of existing wave/loot systems. Enemies drop **essence** when they die; survivors collect essence to fill an XP bar; filling the bar levels the player up.

Scope of this PR is intentionally narrow: drops, pickup, XP/level state, and the top-right HUD. **No** new upgrade rewards on level-up — the existing between-wave slot machine still drives upgrades. Level-up just plays a celebratory FX and bumps the meter. Upgrade hooks come in a follow-up PR.

---

## 1. Goals (what "done" looks like)

- Every enemy death has a chance to drop one or more **essence** pickups at the enemy's position (boss bundles include extras).
- Essence pickups float/bob like existing loot, draw the `essence_drop.png` icon, and disappear when any living survivor walks over them.
- Each essence collected grants **1 XP** to a shared run-wide pool (`state.xp`).
- At **100 XP** the pool resets to `0` (carryover preserved), `state.level` increments, and a HUD level-up flash + sfx plays.
- The HUD shows `LV N` and a horizontal XP progress bar in the **top-right corner** of the screen. Visible at all times during gameplay. Updates every frame.
- New-game resets level and XP. Game-over preserves them on the final screen but they reset on the next run.

---

## 2. Non-goals (explicitly excluded)

- No new upgrade picker on level-up (slot machine stays wave-driven).
- No per-hero levels — one shared level per run.
- No "XP from damage dealt", boss kill multipliers, or magnet pickups (deferred).
- No persistence across runs (no localStorage for level/XP).
- No balance tuning of existing loot drop chances.

---

## 3. Files touched

| File | Change |
|---|---|
| `src/state.js` | Add `xp`, `level`, `xpToNext` fields. Reset them in the new-game state reset in `GameScene._startNewGame`. |
| `src/config/loot.js` | Add `essence` to `LOOT_DEFS` (XP amount per pickup, level threshold constant). |
| `src/entities/Loot.js` | Add `'essence'` branch — render with `essence_drop.png` via `resolveAsset('loot', 'essence')`, plus a fallback canvas glyph if the sprite is missing. Slightly smaller `r` (≈7) and a green-tinted halo. |
| `src/entities/Enemy.js` | `_spawnLootDrops()` — drop essence on every regular enemy (always, count 1). Miniboss drops 8; bigboss drops 25, scattered in a small ring. Essence drops are **additive** to existing loot drops. |
| `src/systems/loot.js` | `applyLoot()` — handle `'essence'`: increment `state.xp`, play sfx, push a small green `+1` floating marker; if `state.xp >= state.xpToNext` call new `_levelUp()` helper (handle multiple level-ups in a single frame via `while`). |
| `src/phaser/scenes/HUDScene.js` | Add top-right `LV N` text + XP bar (graphics) anchored to `(W - 14, 14)`. Rebuilt on resize. Tween XP fill toward target on each `update()`. Brief flash tween on level-up via an event flag. |
| `src/config/assets.js` (manifest loader) | Register `loot.essence` so `resolveAsset('loot','essence')` returns the sprite. See §6. |
| `public/assets/sprites/manifest.json` *(or whichever manifest file the project actually has — see §6)* | Add entry: `"essence": "tbd/icons/essence_drop.png"` under `loot`. |
| `docs/current/current_game_state.md` | New "Player Level & Essence" subsection under the Loot section. |
| `docs/index.md` | Add this planning file to the planning/ list; remove on phase completion. |

---

## 4. Data shapes

### `state` additions (in `src/state.js` and reset in `GameScene._startNewGame`)

```js
xp: 0,            // current essence collected toward next level
level: 1,         // starts at 1, never decreases
xpToNext: 100,    // constant for now; future tuning may scale per level
_levelUpFlash: 0, // realtime seconds remaining on the HUD flash effect
```

### `LOOT_DEFS.essence` (in `src/config/loot.js`)

```js
essence: {
  xpPerPickup: 1,
  xpPerLevel: 100,
  dropCount: { regular: 1, miniboss: 8, bigboss: 25 },
}
```

Source the level threshold and pickup amount from this single definition so balance tuning is one edit.

---

## 5. Behaviour details

### Drop placement (`Enemy._spawnLootDrops`)

- **Regular enemies:** always push exactly one `essence` Loot at `(this.x + rand(-6,6), this.y + rand(-6,6))`, clamped to world bounds. This happens **in addition to** the existing `dropChance`-rolled loot table — so essence is guaranteed.
- **Miniboss:** push 8 essences distributed on a 22 px ring around the corpse (use the same `for (i; i<n; i++) ang = (i/n)*2π` pattern already used in `_spawnLootDrops`).
- **Bigboss:** push 25 essences on a 36 px ring with `rand(-4, 4)` jitter so they don't perfectly overlap.
- Do not award essence for self-inflicted environmental damage (out of scope — no such mechanic exists today).

### Pickup (`applyLoot`)

- Plays `playSfx('loot.essence', { synthetic: 'loot' })` — sfx file optional, synthetic fallback kicks in if absent.
- `state.xp += LOOT_DEFS.essence.xpPerPickup` (1 for now; lets us bump value per-essence later without touching call sites).
- Push a small floating text marker (`state.moveMarkers.push({ ..., type: 'xp', text: '+1' })`) — render path in `GameScene._drawMoveMarkers` gets a new `'xp'` colour (`rgba(120,220,255,…)` to keep it visually distinct from heal/stim).
- While `state.xp >= state.xpToNext`, call `_levelUp()`:
  ```js
  state.xp -= state.xpToNext;
  state.level += 1;
  state._levelUpFlash = 0.9;
  playSfx('ui.levelup', { synthetic: 'loot' });
  ```
  Loop handles the edge case where a boss drop catapults the player past two thresholds at once.

### HUD (top-right panel in `HUDScene`)

Layout (anchored to `(W - 14, 14)`, right-justified):

```
                              LV 3
                ┌──────────────────────────┐
                │█████████░░░░░░░░░░░░░░░░░│  47 / 100
                └──────────────────────────┘
```

- Width: 180 px, height: 8 px bar + 14 px text above + 4 px gap.
- Frame: 1 px `#5a4a30` stroke, dark `#1a120a` fill, gold/amber `#d8a040` fill for current XP. (Matches existing HUD palette in `HUDScene._build`.)
- `update()` reads `state.level`, `state.xp`, `LOOT_DEFS.essence.xpPerLevel`. Updates the text label and redraws the bar Graphics each frame (cheap — fixed geometry).
- Level-up flash: while `state._levelUpFlash > 0`, draw a brighter overlay tint over the bar and decay it by `realDt` (HUD scene receives `delta` in `update`).
- Place to the **left of** the existing "kills/score" header text — that text is currently anchored at `(W - 14, 14)`. Move the kill/score text down by ~36 px (below the XP bar) so they don't overlap. Confirm in browser.

### Reset semantics

`GameScene._startNewGame` already wipes most of `state`. Add `xp: 0, level: 1, xpToNext: 100, _levelUpFlash: 0` to that `Object.assign` block. No restart, no carry between runs.

---

## 6. Asset wiring

The icon already exists at `public/assets/tbd/icons/essence_drop.png`. The project has a sprite registry (`src/config/assets.js` → `loadAssets(manifest)`); loot entries flow through `resolveAsset('loot', type)` and `Loot.draw` automatically calls `sprite.draw(...)` if found.

**Action required:** the project does **not** currently have a `public/assets/sprites/manifest.json` file (verified — only `public/assets/data/` exists). Before merging:

1. Find where `loadAssets` is actually called at boot (grep `loadAssets(` — likely in `SplashScene.create` or `BootScene`; wire it there if it isn't yet).
2. Either add the manifest file or pass an inline manifest object containing:
   ```json
   { "loot": { "essence": "assets/tbd/icons/essence_drop.png" } }
   ```
3. The `Loot.draw` sprite path will then activate automatically.

**Fallback:** `Loot.draw`'s `else if` chain gets a new branch for `'essence'` that draws a small green-yellow gradient orb with a darker glyph (so the loot is visible even before the manifest wiring lands). This keeps the PR ship-ready even if asset registry wiring is split into a follow-up.

---

## 7. Audio

- `loot.essence`: short coin/sparkle. If `public/assets/audio/loot/essence/` is empty, `playSfx` with `synthetic: 'loot'` already falls back to a synthetic chirp — no crash, just lower quality.
- `ui.levelup`: short rising arpeggio. Same fallback.
- Adding real files later is just dropping wavs in the right folder and running `npm run audio:manifest` (per `docs/current/adding_assets.md`).

---

## 8. Implementation order (commits)

Each commit should leave the game runnable and update docs per the documentation discipline rule in `CLAUDE.md`.

1. **`feat(xp): add essence loot type, drop on enemy death`**
   - `LOOT_DEFS.essence` + `Loot.draw` essence branch (with canvas fallback).
   - `Enemy._spawnLootDrops` adds essence drops.
   - Test: kill enemies in dev-mode, confirm green orbs spawn and persist.

2. **`feat(xp): XP accumulation, level state, pickup wiring`**
   - State fields + `_startNewGame` reset.
   - `applyLoot` essence branch with `_levelUp()` loop.
   - `+1` floating marker (`type: 'xp'` in `_drawMoveMarkers`).
   - Test: walk over essence, confirm `console.log(state.xp)` increments and resets at 100.

3. **`feat(hud): top-right level + XP bar`**
   - `HUDScene` additions; reposition existing kill/score text.
   - Level-up flash tween.
   - Test: resize window; confirm anchor stays correct.

4. **`chore(assets): wire essence icon into sprite registry`**
   - Manifest entry + `loadAssets` call if missing.
   - Remove or keep the canvas fallback as a safety net.
   - Test: confirm sprite renders, not the fallback.

5. **`docs(xp): update current_game_state and move plan to executed`**
   - Add "Player Level & Essence" subsection.
   - Move this file → `docs/executed/pr-level-up.md`; update `docs/index.md`.

---

## 9. Test plan (manual)

Run `npm run dev`, pick `dev-mode` difficulty for fastest validation:

- [ ] Each regular kill drops one green orb at the corpse.
- [ ] Miniboss death drops 8 orbs in a ring; bigboss 25.
- [ ] Walking over an orb removes it, plays sfx (or synthetic fallback), shows `+1` text.
- [ ] HUD top-right shows `LV 1` and bar fills as XP accumulates.
- [ ] At 100 XP: bar empties, `LV` increments, brief flash plays. Test a boss drop that crosses two thresholds at once (kill a bigboss while XP ≥ 75 in dev-mode) — confirm level increments twice.
- [ ] Restarting via `R` after game-over resets `LV 1` and empty bar.
- [ ] Resize the window — XP bar stays anchored to top-right; doesn't overlap with kill/score text.
- [ ] Pause (`SPACE` tap) — XP bar stays visible and stops updating because no pickups happen while frozen. Resume — works again.
- [ ] No console errors in any of the above.

Run `node scripts/check-game-data.js` after `LOOT_DEFS` edits.

---

## 10. Risk & open questions

- **HUD layout collision:** moving the kill/score text could overlap the pause text mid-screen on narrow viewports. Test at the smallest expected window size (≈ 1024×768).
- **Drop count vs. particle budget:** bigboss dropping 25 orbs *plus* the existing guaranteed loot bundle may visually clutter the corpse. If it looks bad in playtest, drop ring radius can be increased to 50 px or split across two rings — defer the decision until we see it.
- **Future:** level-up should eventually trigger an upgrade pick (Vampire Survivors style). This PR deliberately separates that — the existing wave slot machine already serves that role, and conflating them in one PR risks regressing the polished upgrade flow. File a follow-up titled "Level-up upgrade picker" once this lands.
- **Sprite registry wiring is the one piece of uncertainty.** Verify in commit 4 that `loadAssets` is actually invoked at boot. If not, the registry is dormant and the canvas fallback is doing all the work — flag that to the user before claiming the PR is done.

---

## 11. Post-merge fix — enemies stuck at world margin

**Symptom:** after this PR landed, enemies spawned at the off-screen `-margin` (see `spawnEnemy` in `src/systems/spawning.js`) and never entered the world. They piled up at the map boundary instead of approaching heroes.

**Root cause:** pre-existing regression introduced by the obstacles commit (`2b61c2f`). `terrainAt()` returns `2` (mountain) for any tile outside `0..COLS, 0..ROWS`, which means `isWalkable()` is `false` for every position an off-screen enemy could try to step to — direct step, flow-field step, and the axis-slide fallbacks all land on out-of-bounds tiles. The level-up PR didn't introduce the bug, but adding visible essence drops made the pile-up obvious.

**Fix (commit 6, `src/entities/Enemy.js`):** in `Enemy.update()`, compute `oob = this.x < 0 || this.x >= G.WORLD_W || this.y < 0 || this.y >= G.WORLD_H` once per frame. When `oob` is true:
- Skip the direct-step walkability probe (so the flow-field branch isn't taken unnecessarily).
- Accept the new `(ex, ey)` position unconditionally instead of running it through `isWalkable`.

This is one-way: enemies already inside the world still get the full terrain check, so they can't walk back out and obstacles still block them.

**Acceptance check:** in `brood-hunter` difficulty, enemies should appear from off-screen, traverse the 192-px edge buffer (`EDGE = 3` tiles cleared in `generateTerrain`), and converge on the hero centroid. Verify in dev-mode at wave 21 as well, since boss spawns use the same off-screen margin via `spawnBoss`.
