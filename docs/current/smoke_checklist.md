# Smoke Checklist

Use this after gameplay or rendering edits. Keep it manual until an automated browser harness exists.

## Launch

- Open `wasteland_survivors-v4.html` in a browser.
- Confirm the canvas fills most of the window.
- Resize the window and confirm terrain and HUD remain usable.

## Selection And Movement

- Left click each survivor.
- Drag-select all survivors.
- Shift-click toggles selection.
- Right click empty ground and confirm selected survivors move in formation.
- Press `S` and confirm selected survivors stop.

## Time Flow

- With all survivors stopped, confirm time pauses (HUD shows TIME x0 — MOVE UNITS).
- Move a survivor and confirm time resumes at x1.
- Press `+` twice and confirm HUD shows TIME x3.
- Press `-` and confirm speed steps down to x2, then x1. Confirm `-` does not go below x1.
- Stop survivors, press `SPACE` tap (quick release), confirm HUD shows TIME x0 — SPACE TO RESUME.
- Press `SPACE` tap again, confirm manual pause lifts and time flows when units move.
- Stop survivors, hold `SPACE` for more than 1 second, confirm HUD shows TIME x3 — HOLDING and world advances.
- Release `SPACE`, confirm time stops again (hold does not toggle pause).

## Abilities

- All hero name labels read "Eliott" (double-t).
- Habib auto-attacks with melee hockey club; no projectile spawned.
- Eliott auto-attacks with short hockey club; swing is visually smaller/faster than Dick's.
- Press `1` (no selection needed), confirm Eliott's Group Blink moves him and nearby allies; hero outside 120 px is unaffected. Cooldown shown.
- Press `2` (no selection needed) near enemies, confirm Dick's Boomerang travels oval arc targeting highest-HP enemy, hits on both legs, returns; Dick unarmed during flight. Does not fire if no target in range.
- Press `3` (no selection needed) near allies, confirm Habib's Backdoor Blockade shimmer on heroes within 150 px; those heroes take half damage for 6s; heroes outside radius unaffected.

## Active Skills

- Win an active upgrade (e.g. Green Pipe for Eliott) from the slot machine.
- Confirm it appears in the HUD active slot with key label and pip row.
- Activate with the bound hotkey; confirm effect fires and cooldown bar fills.
- Play 3+ waves; confirm durability pips decrement each wave; confirm slot empties at 0 pips.
- Confirm the expired upgrade reappears in the slot machine reel after expiry.

## Combat And Loot

- Confirm base attacks work for all three heroes.
- Pick up medkit and stimpack.
- Pick up bomb or banana bomb if available.
- Pick up spray gun and samurai sword if available.
- Confirm temporary weapon indicator and expiry.

## Waves And End States

- Confirm wave number increments.
- Confirm miniboss appears on wave 4.
- Confirm bigboss appears on wave 9.
- Confirm defeat overlay appears when all survivors die.
- Confirm victory overlay appears after wave 21.
