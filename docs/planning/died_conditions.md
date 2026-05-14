# Died Conditions — Current State Assessment & Suggestions

## What the Feature Asked For

When all survivors die:
- Time flows at normal 1× speed, no player controls.
- Screen dims slightly.
- A menu appears after 2 seconds showing a random message and options: Retry, Main Menu, Easier Difficulty.
- Messages should be configurable, randomly selected, well-written.

---

## Current Implementation Status

### What is already working

| Requirement | Status | Location |
|---|---|---|
| 2-second delay before game-over screen | ✅ Done | `GameScene._checkEndConditions()` — `delayedCall(2000, ...)` |
| Time forced to 1× during the 2s window | ✅ Done | `_updateTimeFlow()` — `allDeadPending ? 1 : …` |
| All player controls blocked during `allDeadPending` | ✅ Done | `InputSystem` — all handlers guard on `state.allDeadPending` |
| Random message from a configurable list | ✅ Done | `GameOverScene.js` — `GAME_OVER_MESSAGES` array, 20 entries |
| "ALL SURVIVORS DEAD" headline | ✅ Done | `GameOverScene.create()` |
| Fallen hero names listed | ✅ Done | `GameOverScene.create()` — filters `state.units` for dead heroes |
| Kill / time / wave stats | ✅ Done | `GameOverScene.create()` |
| Score with death-penalty breakdown | ✅ Done | `GameOverScene.create()` |
| RETRY button | ✅ Done | Same difficulty restart |
| MAIN MENU button | ✅ Done | Goes to `MenuScene` |
| EASIER DIFFICULTY button | ✅ Done | Steps down `DIFFICULTY_ORDER`; disabled if already at easiest |
| Panel slides left after a pause | ✅ Done | `GameOverScene` — `delayedCall(4000, slide)` |

### What is missing

| Requirement | Status | Notes |
|---|---|---|
| Visual dim on the **game canvas** during the 2-second `allDeadPending` window | ❌ Missing | `GameScene._draw()` has no special dim for this state. Players see the game in full colour while waiting. |

---

## Suggestion: Add Dim Overlay During `allDeadPending`

The `_draw()` method in `GameScene.js` already has a time-freeze tint system (purple overlay when `timeFlow < 1`). The `allDeadPending` window is special: time _flows_ at 1×, so `timeFlow` approaches 1 and the tint is absent. A separate dim should be drawn.

### Proposed change — `GameScene._draw()` (after the existing time-freeze tint block)

```js
// After the time-freeze tint block (~line 529–549 in GameScene.js)
if (state.allDeadPending) {
  // Darken the canvas progressively during the 2-second window.
  // (state.allDeadTimer would need to be added to track elapsed time)
  const dimAlpha = Math.min(0.45, (state.allDeadTimer / 2.0) * 0.45);
  ctx.fillStyle = `rgba(5, 2, 1, ${dimAlpha})`;
  ctx.fillRect(0, 0, W, PLAY_BOTTOM + 8);
}
```

**`state.allDeadTimer`** would be a new field incremented each frame while `allDeadPending` is true:

```js
// In _updateWorld(), near the top:
if (state.allDeadPending) {
  state.allDeadTimer = (state.allDeadTimer || 0) + realDt;
}
```

Reset it in `_startNewGame()`:
```js
allDeadTimer: 0,
```

### Result

- During the first 0–2 seconds after all heroes die, the screen gradually darkens to ~45% opacity.
- Controls remain blocked (already implemented).
- Time still flows at 1× (enemies, particles animate).
- After 2 seconds, `GameOverScene` takes over.

---

## Message List Review

Current 20 messages in `GameOverScene.js` (`GAME_OVER_MESSAGES`):

1. The Endoserpents won this round.
2. Your squad fell, but humanity fights on.
3. They gave everything — it was not enough this time.
4. The worms devoured the last of your crew.
5. P-RAY could not save them now.
6. Humanity lost this battle. Do you have strength for another?
7. They paid the ultimate price. Your move.
8. Silence fell over the wastes. For now.
9. The swarm consumed them whole.
10. No survivors. No mercy. Try harder.
11. The Endoserpents are relentless. Are you?
12. Your squad's courage was not enough this time.
13. The wasteland claims another crew.
14. Darkness won this round. Dawn awaits the brave.
15. The worms burrow deeper. Will you stop them?
16. Their sacrifice will not be forgotten.
17. Every defeat makes the next victory sweeter.
18. The horde overwhelmed them. Regroup and return.
19. P-RAY is still out there. Fight for it again.
20. The wasteland is unforgiving. So are you.

These match the spirit and grammar requested. The original phrasing suggestions from the design doc were:
- "A**L Snakes won this time" → adapted to "The Endoserpents won this round."
- "Survivors is dead, but not your fight" → "Your squad fell, but humanity fights on."
- "Humanity lost this round, but do you have a power for another one?" → "Humanity lost this battle. Do you have strength for another?"
- "They payed biggest price for humanity, now your action" → "They paid the ultimate price. Your move."

**No changes needed to messages unless HOD wants different tone or additions.**

---

## Summary

The only work remaining is the **dim effect during the 2-second window**. Everything else is implemented and working. The implementation is straightforward — 3 small changes to `GameScene.js`.
