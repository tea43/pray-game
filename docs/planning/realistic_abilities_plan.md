# Realistic Abilities Rework Plan

> Branch: `realistic_abilities`
> Scope: Replace current placeholder abilities with lore-accurate ones, fix name spelling, reassign weapons per character roles, and redesign the upgrade pool into passive/active tiers.

---

## Overview

The current ability set is a placeholder from the earliest prototype. This plan brings abilities and weapon assignments into alignment with the lore in `docs/lore/PRAY_the game.md`. The hockey club stays as the signature weapon shared across all three heroes (in different sizes). Abilities are fully replaced and the upgrade pool is split into passive buffs and active skills that bind to number/letter hotkeys.

**Key principle:** abilities are spells, potions, and tactical skills — not passive stat bumps. The slot-machine upgrade system continues, but now it can award additional active skills as new keybindings rather than always being a passive number change.

---

## 1. Name Spelling Fix: "Elliot" → "Eliott"

The canonical spelling in the lore character section is **Eliott** (double-t at the end). The codebase currently uses `Elliot` (single t) everywhere. This must be corrected project-wide before or alongside the ability work so new code starts clean.

### Scope of changes

| Location | What to rename |
|---|---|
| `src/config/heroes.js` | Hero ID key, `name` field |
| `src/systems/abilities.js` | Any string `'elliot'` / `'Elliot'` references |
| `src/entities/Unit.js` | Any per-hero branches keyed by name |
| `src/render/units.js` | Eliott's draw label |
| `src/render/hud.js` | Portrait label |
| `public/assets/data/upgrades/elliot.json` | Rename file to `eliott.json`, update loader path |
| `docs/` (all files) | Text references to "Elliot" corrected to "Eliott" |
| Key binding labels | `Q` tooltip |

**Commit target:** `fix: rename Elliot → Eliott throughout codebase`

---

## 2. Weapon Assignment

All three heroes wield a variant of the hockey club.

| Hero | Weapon | Notes |
|---|---|---|
| Dick | `hockeyClub` — full-size, melee | Signature weapon, high damage, high knockback. Rename from `dualClubs`; keep swing animation. |
| Habib | `hockeyClub` — standard, melee | Same weapon as Dick; no special size distinction. Short-range melee hits. |
| Eliott | `shortHockeyClub` — melee | Shorter reach, lower damage, faster swing rate to reflect his low-damage role. |

Habib's old `thrownClub` projectile class is removed from his auto-attack. The boomerang mechanic moves to Dick's ability (see section 3.2).

---

## 3. Base Abilities (keyed to `Q / W / E`)

These are each hero's core active skill — always available regardless of upgrades.

### 3.1 Eliott — Group Blink (`Q`)

**Lore source:** *"Blink — Can blink and summon all allies to self."*

**Behaviour:**
- Eliott teleports up to 240 px toward the cursor.
- After landing, every allied hero within **120 px of Eliott's starting position** is also teleported to within ~40 px of Eliott's destination (slightly spread so heroes don't stack).
- Heroes out of range are unaffected.
- Visual: blink flash on Eliott + smaller echo flashes on each pulled ally.

**Stats:**
- Cooldown: 9s.
- Travel range: 240 px.
- Ally pull radius: 120 px (measured from Eliott's starting position).

---

### 3.2 Dick — Boomerang Throw (`W`)

**Lore source:** *"Melee weapon throw: Slow throw of a melee weapon in a form of boomerang."*

**Behaviour:**
- Dick **auto-targets the heaviest enemy** (highest current HP) within a 300 px radius.
- The hockey club is hurled and travels in an **oval arc** toward that target — curving out to one side rather than flying straight — so it sweeps through a wide band of enemies on both the outbound and return legs.
- Any enemy the club passes through takes damage (piercing; each enemy can be hit once per pass direction).
- After reaching the target or the far end of the oval, the club curves back to Dick.
- While the club is in flight Dick is unarmed (no auto-attack until the club returns).
- If no valid target exists within range the ability does not fire.

**Stats:**
- Outbound damage: 40 per enemy hit.
- Return damage: 25 per enemy hit.
- Travel speed: 260 px/s outbound, 300 px/s return.
- Oval width (lateral sweep): ~120 px off the straight line to target.
- Max range: 320 px from Dick before the return arc begins.
- Cooldown: 10s (starts on catch, not on throw).

---

### 3.3 Habib — Backdoor Blockade (`E`)

**Lore source:** *"High armor … Can craft armor."*

**Behaviour:**
- Habib activates a fortified stance that covers himself and nearby allies.
- For the duration, **all heroes within 150 px of Habib at activation** receive 50% incoming damage reduction.
- Affected heroes gain a metallic shimmer / armor-plate visual effect.
- The buff travels with each hero — they do not need to stay near Habib once buffed.
- The ability ends automatically after the duration.

**Stats:**
- Duration: 6s.
- Damage reduction: 50% for all affected heroes.
- Buff radius: 150 px (snapshot at activation — heroes outside the radius at that moment are not buffed).
- Cooldown: 14s (starts when buff expires).

---

## 4. Upgrade Pool — Passive and Active Tiers

### System rules

The slot-machine upgrade pool is split into two categories:

**Passive upgrades** — applied silently on selection; modify stats permanently for the rest of the run (same as current system).

**Active upgrades** — award the hero a new activatable skill. Active skills are bound to the hero's secondary hotkeys in the order they are picked up:

| Slot | Dick | Habib | Eliott |
|---|---|---|---|
| 1st active | `1` | `2` | `3` |
| 2nd active | `a` | `s` | `d` |

A hero can hold a maximum of **2 additional active abilities** beyond their base `Q/W/E` skill. If a hero already has 2 active upgrades, active-upgrade cards for that hero are removed from their reel for the rest of the run.

Active upgrade cards are visually distinguished from passive ones in the slot machine (e.g. a glowing border or "ACTIVE" badge).

#### Upgrade durability (rounds survived)

Active upgrades are **not wiped every wave**. Instead each active upgrade has a durability counter — the number of waves it survives before expiring. When the counter reaches zero the slot for that ability opens up again and can be filled by the next relevant offer.

| | Base durability |
|---|---|
| Default | **3 waves** |
| Minimum (any difficulty) | **2 waves** |

Difficulty modifies the base durability:

| Difficulty | Durability modifier |
|---|---|
| Cavity Cadet | +1 (4 waves) |
| Brood Hunter | 0 (3 waves, default) |
| The Crack Knight | −1 (2 waves, capped at minimum) |
| Rear Admiral | −1 (2 waves, capped at minimum) |
| Dev Mode | 3 waves (unchanged) |

**Counter behaviour:**
- The counter decrements at the end of each wave alongside the wave-clear event.
- When an upgrade expires it is removed from the hero's active slot and the slot shows as empty again.
- An expired upgrade ID is removed from `selectedUpgradeHistory` for that hero, making it eligible to appear in future reels again.
- The remaining durability count is shown as a small pip row (e.g. three dots → two dots → one dot) on the active-upgrade badge in the HUD so the player knows how long they have left.

Passive upgrades are not affected by this system — they remain permanent for the run.

---

### 4.1 Eliott's Upgrade Pool — 10 total (6 active + 4 passive)

Eliott's actives are alchemy substances. They affect either Eliott alone or all heroes in a small radius (~150 px) at activation. Passives improve his blink and survivability.

#### Active — Single-target (Eliott only)

| # | Upgrade | Effect |
|---|---|---|
| 1 | **Stoned Green Pipe** | Eliott transforms into a green stone statue. Becomes immortal. All enemies within 350 px are magnetically drawn to attack him instead of allies. After 4s Eliott teleports to the nearest ally. |

#### Active — Group (radius ~150 px)

| # | Upgrade | Effect |
|---|---|---|
| 2 | **Green Pipe** | All heroes in radius take 40% reduced damage for 5s. |
| 3 | **Blue Cubes of Rage** | All heroes in radius enter a rage state for 4s: +50% damage, +30% attack speed. |
| 4 | **Blue Cubes of Speed** | All heroes in radius gain a speed burst for 5s and deal contact damage (20/pass) while running through enemies. Heroes are not knocked back during this state. |
| 5 | **White Powder of Hit** | Each hero in radius teleports behind their nearest enemy, strikes once (1.5× damage), and blinks back. Heroes are immortal during the sequence. One-shot per activation. |
| 6 | **White Powder of Dominance** | Each hero in radius sequentially blinks to every enemy within 200 px, strikes once from behind, and returns. Heroes are immortal during the full sequence (~2s). |

#### Passive

| # | Upgrade | Effect |
|---|---|---|
| 7 | **Residual Haze** | Enemies near Eliott's blink landing point are slowed by 40% for 2s. |
| 8 | **Extended Formula** | All alchemy ability radii increased by 30%. |
| 9 | **Quick Brew** | All of Eliott's active ability cooldowns reduced by 20%. |
| 10 | **Smokescreen** | Eliott leaves a smoke cloud at his origin on every blink. Enemies inside the cloud have their attack targeting disrupted for 3s (they attack the cloud rather than heroes). |

---

### 4.2 Habib's Upgrade Pool — 10 total (3 active + 7 passive)

#### Active

| # | Upgrade | Effect |
|---|---|---|
| 1 | **Chain Lightning** | Fires a bolt that chains to up to 5 enemies within 200 px per jump. Each hit deals 28 damage and stuns for 1.5s. Cooldown: 8s. |
| 2 | **Flamethrower** | Vents a cone of flame (90° arc, 180 px) for 3s. Enemies take 12 damage per 0.25s and are set on fire (DoT: 6 damage/s for 4s). Cooldown: 12s. |
| 3 | **Acid Gun** | Fires a slow acid projectile. On impact splashes 60 px radius: 35 damage and 50% movement slow for 3s. Cooldown: 10s. |

#### Passive

| # | Upgrade | Effect |
|---|---|---|
| 4 | **Backdoor Armor — Fire** | When any hero is hit, the attacker takes 8 fire damage and is briefly ignited. Stacks with other retribution passives. |
| 5 | **Backdoor Armor — Lightning** | When any hero is hit, the attacker is stunned for 0.6s and jolted for 10 damage. |
| 6 | **Backdoor Armor — Spikes** | When any hero is hit, the attacker takes 12 physical spike damage. |
| 7 | **Dense Plating** | All heroes always receive 10% reduced damage (stacks multiplicatively with Backdoor Blockade). |
| 8 | **Reinforced Frame** | Habib's max HP increased by 30. |
| 9 | **Engineer's Efficiency** | Habib's active ability cooldowns reduced by 25%. |
| 10 | **Weighted Swing** | Habib's melee damage increased by 20% and knockback increased by 30%. |

---

### 4.3 Dick's Upgrade Pool — 10 total (5 active + 5 passive)

#### Active

| # | Upgrade | Effect |
|---|---|---|
| 1 | **Inappropriate Stories** | Dick starts telling a story. All allies within 250 px gain +40% movement speed and +30% attack speed for 6s. Cooldown: 16s. |
| 2 | **Scream** | Dick lets out a primal scream. All enemies within 250 px are stunned for 2.5s. Cooldown: 14s. |
| 3 | **360 Mill** | Dick spins in a full circle, swinging the club in a 360° arc (radius 80 px). All enemies in range take 2× Dick's base damage and are knocked back heavily. Dick is immortal during the spin. Cooldown: 10s. |
| 4 | **Vortex** | Like 360 Mill but Dick also moves in a ~60 px spiral while spinning, covering a larger area. Dick is immortal during the spin. Cooldown: 12s. |
| 5 | **Smashing Time** | Dick identifies the highest-HP enemy within 350 px, leaps to it, and slams for an instant kill (or 500 damage if HP exceeds threshold). Dick is immortal during the leap and slam. Cooldown: 20s. |

Dick has 5 active upgrades but can only equip 2 at a time — the player chooses which two across the run based on what the reel offers.

#### Passive

| # | Upgrade | Effect |
|---|---|---|
| 6 | **Iron Knuckles** | Dick's melee damage increased by 25%. |
| 7 | **Thunderfoot** | Dick's movement speed increased by 20%. |
| 8 | **Hard Cap** | Dick's knockback dealt increased by 40%. |
| 9 | **Thick Skull** | Dick's max HP increased by 40. |
| 10 | **Battle Rhythm** | Dick's attack rate increased by 15% (attack interval multiplier 0.85×). |

---

## 5. Implementation Order

Each step ends with a focused commit and a manual smoke test.

| Step | Scope | Commit target |
|---|---|---|
| 1 | Name fix: `Elliot` → `Eliott` everywhere | `fix: rename Elliot → Eliott throughout codebase` |
| 2 | Weapon reassignment: Habib gets standard hockey club melee; Eliott gets short club; remove Habib's thrownClub auto-attack | `feat: assign hockey club variants to all heroes` |
| 3 | Dick weapon rename: `dualClubs` → `hockeyClub` | included in Step 2 commit |
| 4 | Dick Boomerang Throw ability: oval arc, heaviest-target selection, unarmed state | `feat: Dick boomerang throw with oval arc` |
| 5 | Eliott Group Blink ability: pull nearby allies on land | `feat: Eliott group blink` |
| 6 | Habib Backdoor Blockade ability: snapshot-radius 50% damage reduction for all heroes in range | `feat: Habib backdoor blockade` |
| 7 | Active upgrade hotkey system: bind 1/2/3 and a/s/d; max 2 active slots per hero; HUD indicators | `feat: active upgrade hotkey system` |
| 8 | Eliott upgrade pool (all 6 active abilities) | `feat: Eliott alchemy upgrade pool` |
| 9 | Habib upgrade pool (3 active + 3 passive retribution armors) | `feat: Habib device and armor upgrade pool` |
| 10 | Dick upgrade pool (Inappropriate Stories + Scream + 3 melee specials + 5 passives) | `feat: Dick stories and special swings upgrade pool` |
| 11 | Doc pass: update `current_game_state.md`, heroes table, abilities section, weapons section | `docs: update game state for realistic abilities rework` |

---

## 6. HUD Changes

- Each hero portrait in the bottom HUD gains 2 secondary hotkey rows below the base ability indicator showing any active upgrade slots (empty slots shown as dim placeholders).
- Cooldown rings shown per slot.
- Passive upgrades continue to be shown as text badges on the portrait card (existing behaviour).

---

## 7. Out of Scope (this plan)

- Eliott's G36 gun ultimate — deferred.
- Habib's door-opening and device-reading mechanics — deferred (story mode).
- "Power of Friendship" cable skill (Draft 5 in lore) — deferred.
- Weapon upgrade tiers for Dick (bottle neck → metal pipe → hockey club chain) — deferred (story mode).
- Alchemy substance prerequisites (Draft 6) — deferred.
- Audio cues for new abilities and active upgrade activations — to be added in Phase 6 Audio once ability code is stable.

---

## 8. Smoke Checklist Additions

After implementation, add the following to `docs/current/smoke_checklist.md`:

- [ ] All hero name labels read "Eliott" (double-t).
- [ ] Habib auto-attacks with melee hockey club; no projectile spawned.
- [ ] Eliott auto-attacks with short hockey club; swing is visually smaller/faster than Dick's.
- [ ] Dick (`W`) auto-targets highest-HP enemy in 300 px; club travels oval arc, hits enemies on both legs, returns; Dick is unarmed during flight.
- [ ] Dick (`W`) does not fire when no valid target is in range.
- [ ] Eliott (`Q`) blink moves Eliott and nearby ally; hero outside 120 px is unaffected.
- [ ] Habib (`E`) Backdoor Blockade shows shimmer on all heroes within 150 px; those heroes take half damage for 6s; heroes outside radius unaffected.
- [ ] Active upgrade from slot machine binds to `1`/`a` (Dick), `2`/`s` (Habib), `3`/`d` (Eliott) in acquisition order.
- [ ] Third active upgrade offer does not appear in reel if hero already has 2 active upgrades.
- [ ] Eliott: Stoned Green Pipe makes Eliott immortal, draws enemies, teleports him to nearest ally on end.
- [ ] Dick: Inappropriate Stories stuns nearby enemies and buffs nearby allies simultaneously.
- [ ] Dick: 360 Mill / Vortex / Smashing Time leave Dick invulnerable during animation.
- [ ] Habib: Flamethrower cone visual and fire DoT applied to enemies.
- [ ] Habib: Retribution Armor passives trigger on any hero hit (not just Habib).
