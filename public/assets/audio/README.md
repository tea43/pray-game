# Audio Assets

Drop audio files into the event folder that matches the action, then run:

```sh
npm run audio:manifest
```

The script scans folders listed in `catalog.json` and rewrites `manifest.json`. Filenames do not decide the event. The folder does.

Recommended formats:

- Short sound effects: `.mp3`, `.ogg`, or `.wav`.
- Music loops: `.mp3` or `.ogg`.

Event folders:

- `music/menu/`: menu music.
- `music/game/`: game music.
- `characters/damaged/default/`: character got damaged.
- `characters/death/default/`: generic character death.
- `characters/death/elliot/`, `characters/death/dick/`, `characters/death/habib/`: character-specific death.
- `aliens/attack/default/`: alien executing attack.
- `aliens/hit/default/`: alien got hit.
- `weapons/attack/default/`: character hit with a weapon.
- `weapons/attack/long-club/`, `weapons/attack/dual-clubs/`: weapon-specific attacks.
- `weapons/throw/default/`: character throws a weapon.
- `weapons/throw/thrown-club/`: thrown club launch.
- `weapons/impact/default/`: weapon hits target.
- `weapons/impact/thrown-club/`: thrown club hits target.
- `boss/walk/default/`: boss walking.
- `boss/ability/default/`: boss executing ability.
- `boss/attack/default/`: boss attack.
- `boss/hit/default/`: boss got hit.
- `boss/death/default/`: boss death.

Multiple options for the same action are just multiple files in the same folder. For example, every supported audio file in `aliens/hit/default/` becomes a random variant for `alien.hit.default`.

Filenames can be anything readable, but the generator warns on names that are awkward for web builds. Prefer lowercase names without spaces, such as `wet-hit-1.mp3` or `take-two.ogg`.

If a folder is empty or a file is missing, the event falls back to a generic event, then to the existing synthetic sound, then to silence. Gameplay should never stop because of audio.
