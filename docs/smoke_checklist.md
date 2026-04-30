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

- With all survivors stopped, confirm time pauses.
- Move a survivor and confirm time resumes.
- Press `+` with survivors stopped and confirm time runs at x1.
- Press `+` two more times and confirm the HUD reaches x3.
- Press `-` and confirm speed steps down.
- Press `SPACE` and confirm time goes to x0.

## Abilities

- Select Elliot, press `Q`, confirm blink toward cursor and cooldown.
- Select Dick, press `W`, confirm rage aura, faster attacks, and cooldown.
- Select Habib, press `E` near enemies, confirm chain lightning, stun, and cooldown.

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
