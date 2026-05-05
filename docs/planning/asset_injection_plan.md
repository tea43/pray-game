# Asset Injection Plan

Goal: make heroes, worm enemies, weapons, loot, UI icons, and comic/lore panels easy to replace or add without hunting through game logic.

This is a planning target for modularization. The current game still draws most things with Canvas primitives.

## Asset Philosophy

- Gameplay IDs should stay stable even if visuals change.
- Display names, sprites, sounds, and lore should live in data manifests.
- Missing assets should fall back to current primitive Canvas drawing.
- New content should be injected by adding files and manifest entries, not editing large switch statements.

## Proposed Asset Layout

```text
assets/
  manifest.json
  heroes/
    elliot/
      hero.json
      sprite.png
      portrait.png
    dick/
      hero.json
      sprite.png
      portrait.png
    habib/
      hero.json
      sprite.png
      portrait.png
  enemies/
    worm_hatchling/
      enemy.json
      sprite.png
    worm_runner/
      enemy.json
      sprite.png
    phase_worm/
      enemy.json
      sprite.png
    brood_warden/
      enemy.json
      sprite.png
  weapons/
    hockey_club/
      weapon.json
      icon.png
    spray_gun/
      weapon.json
      icon.png
  loot/
    medkit/
      loot.json
      icon.png
  comics/
    prologue/
      panel_001.png
      panel_002.png
      scene.json
```

## Manifest Shape

```json
{
  "version": 1,
  "heroes": ["heroes/elliot/hero.json", "heroes/dick/hero.json", "heroes/habib/hero.json"],
  "enemies": ["enemies/worm_hatchling/enemy.json", "enemies/brood_warden/enemy.json"],
  "weapons": ["weapons/hockey_club/weapon.json"],
  "loot": ["loot/medkit/loot.json"],
  "comicScenes": ["comics/prologue/scene.json"]
}
```

## Content Definition Pattern

Each content file should include:

- `id`: stable gameplay ID.
- `displayName`: player-facing name.
- `loreKey`: optional link into lore/dialogue.
- `stats`: numeric values when relevant.
- `assets`: sprite, portrait, icon, sound paths.
- `fallbackRenderer`: current primitive renderer name, used when image assets are missing.

Example enemy:

```json
{
  "id": "worm_hatchling",
  "legacyKind": "raider",
  "displayName": "Worm Hatchling",
  "stats": { "hp": 30, "damage": 10, "speed": 48, "radius": 9 },
  "assets": { "sprite": "sprite.png" },
  "fallbackRenderer": "raider"
}
```

## Fallback Rules

The asset system should be optional. The game must run with zero external art files.

Renderer priority:

1. If a valid sprite or icon is loaded, draw it.
2. If the asset path is missing, empty, or fails to load, call the configured `fallbackRenderer`.
3. If the content entry is missing entirely, use the legacy gameplay ID and its current primitive renderer.
4. If both content data and fallback renderer are missing, draw a simple debug placeholder and log one warning.

Example render adapter:

```js
function drawContent(ctx, entity, registry, fallbackRenderers) {
  const def = registry.get(entity.contentId || entity.type || entity.kind);
  const asset = def && registry.getImage(def.assets && def.assets.sprite);
  if (asset && asset.complete) {
    drawSprite(ctx, asset, entity);
    return;
  }

  const fallbackName = (def && def.fallbackRenderer) || entity.type || entity.kind;
  const fallback = fallbackRenderers[fallbackName];
  if (fallback) {
    fallback(ctx, entity);
    return;
  }

  drawMissingAssetPlaceholder(ctx, entity);
}
```

This keeps asset injection safe: missing art cannot break gameplay.

## Migration Strategy

1. Add in-file config tables first.
2. Add an asset registry that can read a static manifest object.
3. Keep primitive Canvas renderers as fallbacks.
4. Move stats and display names from constructors into data.
5. Move visual references into asset definitions.
6. Add runtime asset loading once the modular build exists.

## Why This Matters For Agents

Agents can add content by editing one manifest entry and one focused definition file. They should not need to understand `Unit.draw()`, `Enemy.draw()`, loot drawing, and balance logic just to add one new worm or weapon.

## Near-Term Recommendation

During the first modularization phase, create data tables with both legacy IDs and future display IDs:

| Legacy ID | Future Display Direction |
|---|---|
| `raider` | Worm Hatchling |
| `runner` | Dart Worm |
| `ghoul` | Husk Crawler |
| `mutant` | Burrow Brute |
| `blinker` | Phase Worm |
| `miniboss` | Brood Warden |
| `bigboss` | Elder Worm |

This lets the current game stay stable while lore, assets, and future modules move toward the P-RAY worm setting.
