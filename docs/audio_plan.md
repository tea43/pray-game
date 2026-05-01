# Audio Plan

Phase 6 should turn audio into an event-driven layer that can grow from synthetic placeholders to real assets without breaking the game when files are missing.

## Current Baseline

- Modular source already has `src/systems/audio.js`.
- `initAudio()` starts from a user gesture and silently skips missing files.
- The pause menu has master volume and mute controls.
- Current hooks cover basic hit, shoot, explosion, ability, loot, wave, boss spawn, death, and combat/menu music.
- `assets/` is not present yet, so the current build relies on synthetic SFX or silence.
- The golden `wasteland_survivors-v4.html` does not yet have parity with the modular audio layer.

## Goals

- Keep audio optional: missing files never crash or block play.
- Trigger sounds from gameplay events, not per-frame state.
- Support multiple variants per event so repeated deaths and attacks do not sound identical.
- Split master, music, SFX, and UI volume internally, even if the first UI exposes only master volume.
- Make boss sounds distinct from regular enemies.
- Preserve browser autoplay rules by initializing audio only after player interaction.

## Asset Manifest Shape

Use a data-driven manifest instead of hard-coding every file in `audio.js`. The manifest is the only place that should know asset filenames; game code should only emit semantic event IDs such as `alien.hit.default` or `boss.attack.default`.

Recommended file layout:

```text
public/
  assets/
    audio/
      manifest.json
      catalog.json
      music/
        menu/
          any-menu-track-name.mp3
        game/
          any-game-track-name.mp3
      characters/
        damaged/
          default/
            any-damage-sound.mp3
            another-damage-sound.mp3
        death/
          default/
            any-character-death.mp3
          elliot/
            any-elliot-death.mp3
          dick/
            any-dick-death.mp3
          habib/
            any-habib-death.mp3
      aliens/
        attack/
          default/
            any-alien-attack.mp3
        hit/
          default/
            any-alien-hit.mp3
      weapons/
        attack/
          default/
            any-weapon-attack.mp3
          long-club/
            any-long-club-hit.mp3
          dual-clubs/
            any-dual-clubs-hit.mp3
        throw/
          default/
            any-weapon-throw.mp3
          thrown-club/
            any-thrown-club-throw.mp3
        impact/
          default/
            any-weapon-impact.mp3
          thrown-club/
            any-thrown-club-impact.mp3
      boss/
        walk/
          default/
            any-boss-walk.mp3
        ability/
          default/
            any-boss-ability.mp3
        attack/
          default/
            any-boss-attack.mp3
        hit/
          default/
            any-boss-hit.mp3
        death/
          default/
            any-boss-death.mp3
```

Initial Phase 6 folders already exist at `public/assets/audio/` with `.gitkeep` placeholders. `catalog.json` maps event IDs to folders; `npm run audio:manifest` scans those folders and rewrites `manifest.json`.

For Vite, assets that are fetched by URL should live under `public/assets/audio/...` so they are served at `/assets/audio/...`. The later single-file build phase can decide whether to inline small audio files or leave audio external.

Generated manifest entries look like this after `npm run audio:manifest`:

```json
{
  "version": 1,
  "generatedFrom": "/assets/audio/catalog.json",
  "music": {
    "menu": {
      "variants": ["/assets/audio/music/menu/any-menu-track-name.mp3"],
      "loop": true,
      "volume": 0.4
    }
  },
  "sfx": {
    "alien.hit.default": {
      "variants": [
        "/assets/audio/aliens/hit/default/anything.mp3",
        "/assets/audio/aliens/hit/default/another-take.ogg"
      ],
      "fallback": "synthetic.hit",
      "volume": 0.45,
      "pitchJitter": 0.1,
      "cooldown": 0.05
    }
  }
}
```

## Storage And Lookup Strategy

Audio is stored as many small named files, grouped by purpose, and referenced through semantic event IDs. This gives us three important behaviors:

1. Multiple effects for the same action: one event ID points to a `variants` array. `alien.hit.default` can have two files today and ten files later.
2. Additional effects later: add a new event ID to `manifest.json`, then call `playSfx("new.event.id")` from the gameplay boundary where it belongs.
3. Missing effect safety: every event either falls back to another event or to a synthetic fallback. If no file loads, gameplay continues and the current simple oscillator sound plays.

The runtime loader should build two maps:

- `loadedSfx[eventId] = AudioBuffer[]`
- `missingAudio[eventId] = string[]`

`playSfx(id, options)` should resolve in this order:

1. If `loadedSfx[id]` has buffers, choose a random buffer and play it.
2. Otherwise, if the manifest entry has `fallback`, call `playSfx(fallback, options)` with a small visited-ID guard to avoid fallback loops.
3. Otherwise, if the event can map to a synthetic fallback, play the existing oscillator sound.
4. Otherwise, do nothing.

For entity-specific events, game code should build the most specific ID first:

```js
playSfx("alien.hit.default", { synthetic: "hit" });

playSfx(`character.death.${unit.id}`, {
  fallback: "character.death.default",
  synthetic: "death"
});
```

For boss events:

```js
playSfx("boss.ability.default", { synthetic: "boss_spawn" });
```

This keeps the game code expressive while letting the manifest decide how rich the sound library is.

## Adding Sounds

To add more damaged or death variants:

1. Put the new files in the matching folder, for example `public/assets/audio/characters/death/character_death_03.mp3`.
2. Add the path to the existing `character.death.default.variants` array.
3. No gameplay-code change is needed.

To add a new event:

1. Pick a semantic event ID using dot notation: `enemy.blink.teleport`, `ui.confirm`, `loot.banana_bomb`.
2. Add a manifest entry with `variants`, `volume`, and a `fallback`.
3. Call `playSfx(eventId)` only at the event boundary, for example when teleport completes or when loot is actually picked up.
4. Add a smoke-check note if the sound communicates important gameplay feedback.

Preferred file guidance:

- Use `.wav` or `.ogg` for short SFX.
- Use `.mp3` or `.ogg` for music loops.
- Keep SFX short and trimmed; avoid leading silence.
- Normalize levels before importing, then fine-tune with manifest `volume`.
- Keep filenames descriptive and numbered: `character_death_01.mp3`, `alien_hit_02.mp3`.

Selection rules:

- Pick randomly from the event's loaded variants.
- If a specific event is missing, fall back to a broader event:
  - `character.death.elliot` → `character.death.default` → synthetic `death`.
  - `boss.hit.default` → `alien.hit.default` → synthetic `hit`.
- Add small pitch and gain variation per SFX play.
- Add cooldown/throttling for spammy events like hit and footstep/movement loops.

## Event Map

Menu/UI:

- `ui.hover`
- `ui.click`
- `ui.back`
- `ui.start`
- `ui.pause`
- `ui.resume`
- `ui.error`

Music:

- `music.menu` on main menu, settings, credits, victory/defeat overlay after stings.
- `music.combat` on normal gameplay.
- `music.boss` while any boss is alive.
- `music.victory_sting` when winning.
- `music.defeat_sting` when all survivors die.

Heroes:

- `hero.attack.elliot`
- `hero.attack.dick`
- `hero.attack.habib`
- `hero.hurt.default`
- `hero.death.elliot`
- `hero.death.dick`
- `hero.death.habib`
- `ability.blink`
- `ability.rage`
- `ability.lightning`

Enemies:

- `enemy.hit.default`
- `enemy.attack.raider`
- `enemy.attack.runner`
- `enemy.attack.ghoul`
- `enemy.attack.mutant`
- `enemy.attack.blinker`
- `enemy.blink.charge`
- `enemy.blink.teleport`
- `enemy.death.raider`
- `enemy.death.runner`
- `enemy.death.ghoul`
- `enemy.death.mutant`
- `enemy.death.blinker`
- `enemy.death.default`

Bosses:

- `boss.spawn.miniboss`
- `boss.spawn.bigboss`
- `boss.miniboss.move`
- `boss.bigboss.move`
- `boss.bigboss.attack.slam_charge`
- `boss.bigboss.attack.slam_impact`
- `boss.miniboss.death`
- `boss.bigboss.death`

World and rewards:

- `wave.start`
- `loot.pickup`
- `loot.medkit`
- `loot.stimpack`
- `weapon.spray_gun.fire`
- `weapon.samurai_sword.swing`
- `explosion.bomb`
- `explosion.banana_bomb`

## Implementation Phases

1. Replace hard-coded `AUDIO_FILES` with an audio manifest/config and loader that accepts arrays of variants.
2. Extend `playSfx(id, options)` with random variant selection, pitch jitter, gain, cooldown keys, and fallback IDs.
3. Add `playMusic(id)` transitions for menu, combat, boss, victory, and defeat, with gentle crossfades.
4. Wire menu button sounds and start/pause/resume cues.
5. Replace generic `death` calls with entity-aware events such as `enemy.death.${kind}` and boss-specific deaths.
6. Add boss movement and attack cues at event boundaries:
   - movement loop or throttled movement groan while boss is alive and advancing.
   - slam charge once when charge begins.
   - slam impact once when the shockwave is created.
7. Add hero death and hurt cues.
8. Add a small debug overlay or console summary showing loaded and missing audio IDs.
9. Add smoke checks for silent/missing-asset mode, volume changes, boss music switching, and SFX variant selection.
10. Decide whether golden HTML receives a direct audio patch or waits for the single-file build phase to generate parity.

## Manual Test Additions

- Boot with no `assets/audio/` folder: no console error spam, gameplay still works.
- Start from the main menu: menu click and combat music trigger after user interaction.
- Kill several enemies of the same type: death sounds vary.
- Spawn a miniboss and bigboss: boss spawn sound plays and boss music takes over.
- Bigboss slam: charge sound plays once, impact sound plays once.
- Kill a boss: boss-specific death sound plays and combat/menu music resumes appropriately after no bosses remain.
- Move volume slider during music and SFX playback: changes apply immediately.
