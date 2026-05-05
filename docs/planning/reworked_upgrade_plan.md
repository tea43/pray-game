# Reworked Upgrade System Plan

Replaces the existing between-wave upgrade screen with a slot machine UI. Upgrade content and effect hooks are out of scope — existing JSON pools and `applyWaveUpgrades()` are used as-is.

---

## Slot Machine Visual

Three vertical slot reels, one per hero column (Elliot | Dick | Habib). Each reel is a scrolling strip of that hero's upgrades. The centred card is selectable; one card above and one below are visible but dimmed and unclickable — standard slot machine framing.

```
┌──────────────┬──────────────┬──────────────┐
│    ELLIOT    │     DICK     │    HABIB     │
│──────────────│──────────────│──────────────│
│ ░░░░░░░░░░░░ │ ░░░░░░░░░░░░ │ ░░░░░░░░░░░░ │  ← dimmed, unclickable
│──────────────│──────────────│──────────────│
│ ▓▓ CENTRED ▓▓│ ▓▓ CENTRED ▓▓│ ▓▓ CENTRED ▓▓│  ← selectable
│──────────────│──────────────│──────────────│
│ ░░░░░░░░░░░░ │ ░░░░░░░░░░░░ │ ░░░░░░░░░░░░ │  ← dimmed, unclickable
└──────────────┴──────────────┴──────────────┘
         [ SPIN (N) ]      [ → NEXT WAVE ]
```

Each card shows: upgrade name, rarity-coloured border, description, and a category icon in the top-left corner. Renders as text-only if the icon file is absent.

---

## Reel Pool Rules

Each time a reel is built (on open or re-spin):

1. **Exclude previously selected upgrades** — any upgrade the player has chosen in a prior wave is removed from the pool for this run.
2. **Shuffle the remaining pool** — strip order is randomised so the result is unpredictable.

The reel scrolls through the full shuffled eligible strip and stops with one card centred.

---

## Spin Animation

**Initial spin** (on upgrade screen open): ~1 second, fast. All three reels spin simultaneously and snap to result.

**Re-spin** (player-triggered): 2–6 seconds, duration chosen randomly each time. Each column stops at a **different random moment** within that window — left column stops first, then the others at staggered intervals — mimicking real slot machine behaviour.

Both use the same visual: strip scrolls fast, decelerates, snaps with a brief settle.

---

## Spin Credit System

- Each wave-pause adds 1 credit. Maximum 3 banked.
- During a pause: spend 1 credit to re-spin all three reels. Only 1 re-spin allowed per pause.
- SPIN button shows the current count: `SPIN (N)`. Greyed out at 0.
- **Banking is not explained.** The player sees the number rise and discovers the carry-over mechanic through play.
- `upgradeSpinCredits` is a plain integer in state — future conditions can add to it with no UI changes.

---

## Selection & Progression

- Player clicks one centred card → that upgrade is selected, NEXT WAVE unlocks.
- On NEXT WAVE: chosen upgrade ID added to `selectedUpgradeHistory[hero]` (excluded from future reels this run).
- On wave end: active upgrade wiped, cycle repeats.

---

## Implementation Phases

### Phase 1: Slot Machine UI
- Replace existing card-grid screen with the three-column reel layout.
- Build reel strip: filter `selectedUpgradeHistory`, shuffle remainder.
- Render vertically scrolling strip clipped to 3 cards; centre fully visible, top/bottom dimmed and non-interactive.
- Initial spin animation (~1 s snap).
- Re-spin animation (2–6 s, staggered column stop times).
- Centred card: rarity border, hover highlight, click to select.
- NEXT WAVE button disabled until a card is selected.

### Phase 2: Spin Credit State
- Add `upgradeSpinCredits` (int, default 0) to game state; reset on new game.
- On upgrade screen open: `upgradeSpinCredits = Math.min(upgradeSpinCredits + 1, 3)`.
- SPIN button: visible always, shows `SPIN (N)`, disabled when N = 0.
- On SPIN: `upgradeSpinCredits -= 1`, rebuild pools, replay re-spin animation.
- On NEXT WAVE: record chosen upgrade ID in `selectedUpgradeHistory[hero]`.

---

## Icon Assets

**Format: SVG.** The canvas is dynamically sized (97vw), so SVGs scale to any resolution without needing @2x variants. Loaded via `new Image()` the same way as PNG — no pipeline difference.

Placeholder files go in `public/assets/ui/upgrade-icons/`. Each is a simple monochrome outline SVG sized at 64×64 viewBox.

| File | Category | Used by |
|---|---|---|
| `icon-alchemy.svg` | Alchemy brew / potion | Elliot upgrades |
| `icon-weapon.svg` | Crossed clubs | Dick upgrades |
| `icon-armor.svg` | Shield plate | Habib passive/armor upgrades |
| `icon-device.svg` | Gear / wrench | Habib device upgrades |
| `icon-active.svg` | Lightning bolt outline | Any one-time active upgrade |

Placeholder content for each: a labelled rectangle with the icon name as text — enough to confirm layout before real art exists.

---

## Sound Effects

Audio events go through the existing `playSfx(id)` system in `src/systems/audio.js`. Placeholder entries are added to `public/assets/audio/catalog.json` so the manifest generates correctly; actual files can be dropped in later with no code change.

| Event ID | Trigger | Placeholder file path |
|---|---|---|
| `upgrade_reel_spin_start` | Initial spin begins on screen open | `public/assets/audio/ui/upgrade_reel_spin_start.wav` |
| `upgrade_reel_column_stop` | Each column snaps to result (fires 3× per spin, staggered) | `public/assets/audio/ui/upgrade_reel_column_stop.wav` |
| `upgrade_card_select` | Player clicks a centred card | `public/assets/audio/ui/upgrade_card_select.wav` |
| `upgrade_spin_trigger` | Player clicks the SPIN button | `public/assets/audio/ui/upgrade_spin_trigger.wav` |
| `upgrade_next_wave` | Player confirms and exits upgrade screen | `public/assets/audio/ui/upgrade_next_wave.wav` |

All five fall back to silence if the file is absent — consistent with the existing missing-asset policy.

---

## Out of Scope

- Upgrade content rework (lore alignment, new effect types) — deferred.
- Real icon art and sound files — placeholders ship with the slot machine; assets drop in without code changes.
