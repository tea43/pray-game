# Adding Assets

Reference for adding any new asset type to the game. Each section covers where files go, what to configure, and what to update.

---

## Audio (SFX + Music)

### Step 1 — Drop the file

Place `.mp3`, `.ogg`, `.wav`, or `.m4a` files into the matching folder under `public/assets/audio/`:

```
public/assets/audio/
  characters/abilities/<ability-name>/   ← ability activation sounds
  characters/damaged/default/            ← hero hurt sounds
  characters/death/<hero-name>/          ← per-hero death sounds
  weapons/attack/<weapon-name>/          ← melee/ranged attack sounds
  weapons/throw/<weapon-name>/           ← thrown weapon launch
  weapons/impact/<weapon-name>/          ← thrown weapon hit
  loot/<loot-type>/                      ← pickup sounds
  explosions/<bomb-type>/                ← explosion sounds
  boss/<event>/                          ← boss walk/attack/death
  aliens/<event>/                        ← alien hurt/attack/death
  music/menu/                            ← menu loop tracks
  music/game/                            ← in-game loop tracks
```

Multiple files in the same folder = random variant selection automatically.

### Step 2 — Regenerate the manifest

```bash
npm run audio:manifest
```

This scans all audio folders and writes `public/assets/audio/manifest.json`. No code change needed for existing events — the engine picks up new variants automatically.

### Step 3 — Register a new event (only for brand-new event keys)

If you're adding a completely new event key (e.g. `ability.my_new_ability` or `weapon.whip.crack`), add an entry to `public/assets/audio/catalog.json`:

```json
"weapon.whip.crack": {
  "dir": "weapons/attack/whip",
  "fallback": "weapon.attack.default",
  "volume": 0.55,
  "pitchJitter": 0.08
}
```

Then run `npm run audio:manifest` again.

### Step 4 — Wire it to an ability

In `src/config/abilities.js`, set the `sound` field on the ability definition:

```js
my_new_ability: {
  icon: 'assets/icons/abilities/my_new_ability.svg',
  color: '#ff8040',
  sound: 'ability.my_new_ability',   // ← matches catalog.json key exactly
  maxCd: 12,
  activate(unit) { /* ... */ },
},
```

The dispatcher in `Unit.cast()` / `Unit.activateSkill()` calls `playSfx(def.sound)` automatically. **Do not add `playSfx` calls inside `activate()` for the activation sound** — one declaration in the `sound` field is enough.

---

## Ability Icons

Place a **48 × 48 px SVG or PNG** in:

```
public/assets/icons/abilities/<ability_id>.<ext>
```

Reference it in `src/config/abilities.js`:

```js
icon: 'assets/icons/abilities/my_ability.svg',
```

The HUD and upgrade screen read this path directly — no manifest or registration needed.

---

## Hero Sprites

Sprite sheets go in:

```
public/assets/sprites/heroes/<hero_type>.png
```

**Recommended sheet size for the current Phaser runtime: 64 × 64 px per frame.** The figure should fill roughly a 34 × 40 px inner area, centred, and drawn facing right so the renderer can rotate it toward movement/attack direction. See `src/entities/Unit.js` — the sprite is drawn via:

```js
sprite.draw(ctx, anim, -this.r * 1.5, -this.r * 1.5, this.r * 3, this.r * 3);
```

This maps the sheet into a 33 × 33 px region (`r = 11`). Leaving transparent padding around the silhouette prevents clipping when the whole frame is rotated.

Register the sprite in `src/config/manifest.json`. `src/phaser/scenes/BootScene.js` loads the hero entries from that manifest, and the `draw()` call in `Unit.draw()` picks the sheet up automatically once it exists.

---

## Enemy Sprites

Same pipeline as heroes. Enemy radius varies by type (see `ENEMY_DEFS` in `src/config/enemies.js`). The draw call is:

```js
sprite.draw(ctx, anim, -e.r * 1.5, -e.r * 1.5, e.r * 3, e.r * 3);
```

Sheet size should be `(e.r * 3) × (e.r * 3)` rounded up to the nearest power of 2, or 64 × 64 px as a safe default.

---

## Background / Menu Video

Drop `.mp4` files into:

```
public/assets/video/
  menu/                ← main menu background (referenced in MenuScene)
  victory/             ← victory screen (heli_escape.mp4)
```

Reference via `<video id="...">` element in `index.html` and set `.src` in the scene's `create()`.

---

## Loot Icons

No separate icon sheet needed — loot items are drawn procedurally in `src/render/loot.js`. To change appearance, edit the draw function for that loot type.

---

## Quick Reference

| Asset type | Drop here | Register in | Auto-picked up |
|---|---|---|---|
| SFX variant | `public/assets/audio/<dir>/` | run `audio:manifest` | yes |
| New SFX event | same + `catalog.json` entry | `catalog.json` + `audio:manifest` | yes |
| Ability icon | `public/assets/icons/abilities/` | `ABILITY_DEFS[id].icon` | yes |
| Hero sprite | `public/assets/sprites/heroes/` | asset manifest + SplashScene | yes |
| Menu video | `public/assets/video/menu/` | `MenuScene.js` `.src` | no |
