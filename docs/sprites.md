# Sprite Registry

All visual assets are registered in `src/config/manifest.json`. Every renderer checks the registry first and falls back to its Canvas 2D primitive if no sprite is loaded. **Swapping art = drop a PNG + update manifest.json.**

## Manifest structure

```json
{
  "category": {
    "key": "./assets/sprites/category/key.png"
  }
}
```

Loaded at boot via `loadAssets(manifest)` in `src/main.js`. Each image is fetched, decoded, and stored in `ASSET_REGISTRY[category][key]`. Failed loads are silently ignored (fallback renderer activates).

## Categories

| Category | Keys | Fallback |
|---|---|---|
| `enemies` | raider, runner, ghoul, mutant, blinker, miniboss, bigboss | Canvas 2D segmented worm |
| `heroes` | elliot, dick, habib | Canvas 2D primitive character |
| `loot` | medkit, stimpack, bomb, banana_bomb, spray_gun, samurai_sword | Canvas 2D iconic shape |
| `world` | block_house_a, block_house_b, garage, fence_section, dumpster, car_wreck | (not rendered yet — reserved for world sprites feature) |
| `comicPanels` | intro_raiders, intro_snakes, intro_metal_plate, flashback_hui, dick_decision, garage_exterior | (not rendered — used by CutsceneScene) |

## Adding a sprite

1. Drop the PNG at the manifest path (e.g. `public/assets/sprites/heroes/dick.png`)
2. Confirm the key exists in `manifest.json` under the right category
3. The renderer picks it up on next boot automatically

## Fallback chain

```
loaded sprite  →  draw sprite, return
no sprite      →  primitive renderer (Canvas 2D shapes, always present)
```

Hero sprites are drawn at `r × 3` square centered on the unit, rotated to face direction. Hurt flash is preserved: `filter: brightness(2)` while `hurtFlash > 0`.

Enemy sprites are drawn at `r × 2` square, rotated to face direction. Boss aura, slam telegraph, stun sparks, and HP bar are drawn on top regardless of sprite.

Loot sprites are drawn at `r × 2` square inside the pop-in scale transform — the bobbing and glow halo happen in the surrounding code.

## World sprites (future)

The `world` category is reserved for the Eastern European environment art (block houses, garages, fences, car wrecks). These require the Canvas 2D → WebGL migration first so entities can occlude buildings. See `docs/future_world_sprites.md`.

## Comic panels (story mode)

`comicPanels` keys map to full-panel artwork displayed by `CutsceneScene`. The scene reads the key, calls `resolveAsset('comicPanels', key)`, and renders the image full-screen with letterboxing if the aspect ratio doesn't match.
