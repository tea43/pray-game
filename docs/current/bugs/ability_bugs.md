 - [FIXED] During white powder of dominance the time stops and canont proceed further unless space pressed. By design the time should proceed until white powder of dominance ends.
 - [FIXED] flamethrower is not visible, i see no flame
 - [FIXED] the hockey club for boomerang should be larger, at least the size of the clubs hero holsing in hand. The damage of the boomerang should be enough to kill initial enemy ~50 damage
 - [FIXED] mill 360 and vortex: I see the radius but Dick does not move, he should move while the ability is active. Time does not stop itself while the ability is active.
 - [FIXED] Smokescreen ability of eliott does not work, enemies does no change the lock on the heroes and continue attacking the heroes they have planned. Enemy targeting now skips heroes inside active smoke zones (smoke life is ticked each frame). Stoned hero still takes priority. All-smoked fallback ensures enemies still have a target.
 - [FIXED] Endoserpents turn around instantly. All enemies now have a configurable turnSpeed (rad/s): runners 8, hatchlings 6, phase worms 4.5, husk crawlers 4, brute 3, miniboss 2, bigboss 1.5. A half-turn for bigboss takes ~2 s.
 - [FIXED] If one hero dies: the score divided by 2, if 2 hero died: by 4. applyDeathPenalties() divides score by 2^heroesDied at game-over and victory.
 - [FIXED] The corpse of the hero should stay at the place of death. deathX/deathY stored on death; _drawHeroCorpse() renders a flattened silhouette and blood pool at that position.
 - [FIXED] The ability selection block for dead hero should be non selectable on the death of hero. Dead hero cards already skip button rendering and block input; now also show a crosshatch overlay over the button area.
 - [FIXED] For the highest level, death of the hero means the end of the game. On rear-admiral difficulty, any hero death immediately triggers game over with message "HERO FALLEN".
 - [FIXED] Smokescreen ability is not added to the ability list whenever selected. Passive upgrades now appear as a second upgrade slot button in the HUD (disabled, hoverable for tooltip). The separate passive strip was replaced by the unified 2-slot system (see below).
 - [FIXED] During the spin of the abilities in between the waves, the abilities of the dead hero should be unselectable. Dead hero columns in UpgradeScene now show a "† FALLEN" label and push a null reel so they cannot be clicked; the hero name label in the header is also grayed out.
 - [FIXED] White powder of hit stops time before the back-teleport executes. Added `u._wpHitReturn !== null` to the `anyAbilityActive` guard in GameScene._updateTimeFlow() so time keeps flowing for the full 0.3s return window. Dominance was already covered by the existing `_dominanceTargets` check.
- ingame menu should ask "are you sure?" when customer press "main menu"
- whenever user wants to close the tab: there should be a notification before the tab is closed

## Enhancement Queue (from docs/planning/enchancements.md)
- [DONE] All-survivors-dead: 2s time-flow before game-over overlay, random flavor message, EASIER DIFFICULTY button, controls blocked.
- [DONE] Hockey club cursor in main menu.
- [DONE] Active pickups visible in HUD: weapon timer pill, rage pill, medkit-heal pill. Medkit now heals over 4s; rare (blue) medkit over 5s for 1.8× heal.
- Flamethrower and acid gun issues: 
    - Flamethrower does not expose flame, we need an animation of flame for the flamethrower and acid gun
    - Acid gun does not work at all, no animation
    - Extend the cooldown for the flamethrower and extend the active state
    - Flamethrower and Acid gun should be pointed at the closest enemy and switch if enemy died due to damage
    - Lightning does not activates if there is no enemy around
- Powder of dominance does not return heroes back together after hits. They Should get back to the original point if they started to hit enemies around them
- During stoned green pipe effect, eliott cannot move even if user clicks it to move. Once effect is ended he is blinking to his closest bro.
- decrease number of medkits 10 times, number of bombs 5 times, number of stimpacks 10 times
- add the list for all passive abilities as well as active to the ability_icons.json


