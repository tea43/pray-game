# P-RAY: The Game

A Canvas 2D survival tactics game. Guide three survivors through 21 waves of an ever-deepening worm brood, then board the extraction helicopter before the brood claims the last of them.

---

## How to Play

### Download

```
git clone git@github.com:tea43/pray-game.git
cd pray-game
```

### Start (modular dev build)

```
npm install
npm run dev
```

Then open the local URL printed by Vite (usually `http://localhost:5173`).

### Start (single-file, no build step)

Open `wasteland_survivors-v4.html` in any modern browser (Chrome, Firefox, Safari, Edge).  
No server needed — double-click the file or drag it into a browser tab.

### Controls

| Input | Action |
|---|---|
| Left-click | Select a survivor |
| Left-drag | Box-select multiple survivors |
| Right-click ground | Move selected survivors |
| Right-click enemy | Attack-move to that enemy |
| Shift + click | Add / remove from selection |
| Ctrl / Cmd + A | Select all living survivors |
| S | Stop selected survivors |
| Space | Toggle manual pause |
| + / − | Raise / lower time speed (x1 → x2 → x3) |
| Q | Elliot's ability — BLINK |
| W | Dick's ability — RAGE |
| E | Habib's ability — CHAIN LIGHTNING |

> **Active pause:** time only flows while a survivor is moving. Stop your squad to freeze the action and plan your next move. SPACE forces a hard pause regardless.

---

## Lore

### The World

The wasteland was not always silent. What the survivors call "the Surfacing" began without warning — the ground split open and the brood came up from below. Ancient and vast, the worm colony has no language and no mercy. It simply hungers, and it sends its broods in waves.

Three people are still standing. They don't know each other. They don't have to. The horde doesn't care.

---

### The Survivors

#### Elliot
A wanderer in a pink floral shirt and a battered straw hat. Nobody knows where Elliot came from or why she carries a spiked club instead of something sensible. She doesn't explain herself. She moves fast, hits hard, and when things get truly desperate she blinks across open ground faster than anything the brood can track.

- **Weapon:** Long spiked club (melee, 56 px range)
- **HP:** 100
- **Ability — BLINK** `[Q]` *(6 s cooldown)*: Teleports up to 240 px toward the cursor in an instant. Leaves a trail of blue light. Use it to reposition out of a surround or close a gap.

---

#### Dick
Shirtless, tattooed, and unreasonably calm for someone standing in the middle of a worm swarm. Dick fights with two clubs and hits everything twice. His rage is not a metaphor.

- **Weapon:** Dual clubs (alternating melee strikes, 36 px range)
- **HP:** 120 (highest of the three)
- **Ability — RAGE** `[W]` *(12 s cooldown)*: Enters a 5-second frenzy. Damage doubles, attack speed doubles, knockback nearly doubles. His eyes glow red. The brood notices.

---

#### Habib
Calm, precise, and the only one of the three with any sense of range. Habib throws his club — and it hits. When the electrical charge in the air gets thick enough he can arc a lightning bolt through four worms in a chain.

- **Weapon:** Thrown club (ranged projectile, 220 px range)
- **HP:** 100
- **Ability — CHAIN LIGHTNING** `[E]` *(8 s cooldown)*: Fires a chain bolt that jumps to up to 4 enemies within 200 px of each other, dealing 30 damage and stunning each for 1.8 s. The arc is visible as a jagged bolt between targets.

---

### The Brood

The worm colony sends increasingly dangerous specimens as the waves progress.

#### Worm Hatchling
The smallest unit of the brood. Freshly surfaced, not yet fully formed. Slow and fragile — but they come in numbers. The first wave is nothing but these.

- Appears from: Wave 1
- HP: 30 | Damage: 10 | Speed: slow

---

#### Dart Worm
A narrow, fast-moving worm variant that burrows close to the surface before erupting from the ground at speed. Hard to click, dies quickly — but it hits first.

- Appears from: Wave 2
- HP: 22 | Damage: 8 | Speed: very fast

---

#### Husk Crawler
A mid-size worm that has absorbed enough organic matter to grow a leathery outer shell. Moves at a steady pace and hits with moderate force. The backbone of the mid-wave brood.

- Appears from: Wave 2
- HP: 50 | Damage: 14 | Speed: medium

---

#### Burrow Brute
A heavily mutated worm that has fused with subsurface mineral deposits, giving it a greenish carapace and immense mass. Slow but almost impossible to knock back. Always drops supplies when killed.

- Appears from: Wave 4
- HP: 90 | Damage: 22 | Speed: slow
- Always drops loot

---

#### Phase Worm
A worm that has developed the ability to shift through short distances in spacetime — or something close to it. It telegraphs its blink with a glowing target ring, then reappears directly behind whichever survivor it has chosen. Semi-translucent when visible.

- Appears from: Wave 3
- HP: 45 | Damage: 18 | Speed: slow (but teleports)
- Behavior: charges a blink every 2.8–4.2 s, reappears behind the nearest survivor. Target position shown with a pulsing ring.

---

#### Brood Warden *(mini-boss)*
A massive worm that serves as the colony's guardian-tier specimen. It surfaces on every 4th wave. Unlike the horde it does not scatter — it marches directly toward the survivors and does not stop. Drops guaranteed supplies and a special weapon on death.

- Appears: every 4th wave
- HP: 600 | Damage: 32 | Knockback resistance: high
- Named on its HP bar: **BROOD WARDEN**
- Drops: medkit, stimpack, bomb + 1 random special weapon

---

#### Elder Worm *(final boss)*
The oldest and largest specimen yet observed. The Elder Worm has existed beneath the surface since before anyone alive can remember. When it surfaces, the ground shakes. Its slam attack sends a shockwave ring expanding outward that damages every survivor it crosses. Radiation-green particles drift off its body continuously.

- Appears: every 9th wave
- HP: 2,000 | Damage: 48 | Knockback resistance: extreme
- Named on its HP bar: **ELDER WORM**
- Special attack: slam shockwave (expanding ring, 35 damage, telegraphed by a shrinking yellow ring)
- Drops: bomb, medkits, stimpack + guaranteed banana bomb + 1 random special weapon

---

### Loot

Enemies drop supplies on death. Walk a survivor over a pickup to collect it.

| Item | Source | Effect |
|---|---|---|
| Medkit | Common drop | Heals 60 HP |
| Stimpack | Common drop | Triggers 5 s rage + reduces ability cooldown by 2 s |
| Bomb | Rare drop / boss drop | Detonates on pickup — kills all enemies within 280 px |
| Spray Gun | Hard enemies / bosses | Gives the picking survivor rapid-fire spread shot (5 bullets, 70° cone) for 15 s |
| Samurai Sword | Hard enemies / bosses | Gives the picking survivor a 120° cleave attack hitting all nearby enemies for 20 s |
| Banana Bomb | Extreme rarity (~2%) / Elder Worm | Detonates on pickup — larger blast (420 px), heavier screen shake, stuns enemies at the edge of the blast |

---

### The Waves

21 waves stand between the survivors and a chance at escape. Each wave lasts 22 seconds of game time. The brood grows denser and faster as the waves progress — spawn intervals shrink by 16% per wave. Wave 3 and wave 6 bring burst spawns that send multiple enemies in quick succession.

Surviving all 21 waves clears the brood — but the fight is not over. Once the last wave ends and all remaining enemies are killed, an extraction helicopter arrives. Move your survivors into the landing zone to board. When the last living hero boards, the helicopter lifts off and the victory screen fades in.

Every survivor dead before that is a defeat.

---

### Difficulty

| Mode | Notes |
|---|---|
| Cavity Cadet | Easier enemies, generous loot, fast ability cooldowns |
| Brood Hunter | Balanced, intended experience |
| The Crack Knight | Harder enemies, scarcer loot |
| Rear Admiral | Brutal — multiple bosses per wave |
| Dev Mode | Starts at wave 21 with all enemy types and both bosses; single wave, then extraction |

> *"The brood stirs."*
