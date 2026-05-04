## Feature: Between-Wave Upgrade System

### Overview
Implement a between-wave upgrade screen that appears after each completed wave. Upgrades are temporary — they last only for the upcoming wave, then reset before the player picks new ones.

### Flow
1. Player completes a wave.
2. Upgrade screen appears, showing one upgrade panel per character.
3. Player selects exactly **1 upgrade from each character** (3 total).
4. Player presses the "Next Wave" button → selected upgrades are applied.
5. Next wave starts.
6. When that wave ends, all upgrades are removed and the cycle repeats from step 2.

### Characters & Upgrade Types (Lore)
| Character     | Craft Specialty | Data File              |
|---------------|-----------------|------------------------|
| Elliot        | Potions         | `elliot_upgrades.json` |
| Dick/Richard  | Armor           | `dick_upgrades.json`   |
| Habib         | Weapons         | `habib_upgrades.json`  |

### Rarity Tiers
Each character has **10 upgrades** distributed as follows:
| Rarity    | Count | Color (suggested) |
|-----------|-------|--------------------|
| Common    | 4     | Grey               |
| Rare      | 2     | Blue               |
| Epic      | 2     | Purple             |
| Legendary | 2     | Gold               |

---

### Elliot's Upgrades (Potions)

| #  | Name                  | Rarity    | Effect                                                        |
|----|-----------------------|-----------|---------------------------------------------------------------|
| 1  | Minor Healing Brew    | Common    | Restores 10% HP at the start of the wave                     |
| 2  | Stamina Tonic         | Common    | +10% movement speed for the wave                             |
| 3  | Focus Drops           | Common    | +5% accuracy for all ranged attacks                          |
| 4  | Thin-Skin Salve       | Common    | Regenerate 1 HP every 10 seconds                             |
| 5  | Adrenaline Shot       | Rare      | +20% attack speed for the first 30 seconds of the wave       |
| 6  | Ironblood Elixir      | Rare      | +15% max HP for the wave                                     |
| 7  | Phantom Draught       | Epic      | 20% chance to dodge any incoming attack                      |
| 8  | Berserker Serum       | Epic      | +30% damage dealt, but take 15% more damage                  |
| 9  | Elixir of Immortality | Legendary | Revive once with 50% HP upon death                           |
| 10 | Timestop Vial         | Legendary | Activate to freeze all enemies for 5 seconds (one-time use)  |

### Dick/Richard's Upgrades (Armor)

| #  | Name                  | Rarity    | Effect                                                        |
|----|-----------------------|-----------|---------------------------------------------------------------|
| 1  | Padded Vest           | Common    | +5% damage reduction                                         |
| 2  | Reinforced Boots      | Common    | Immune to slow effects                                       |
| 3  | Scrap Shield          | Common    | Block the first hit of the wave completely                    |
| 4  | Patched Helmet        | Common    | +8% resistance to headshot/crit damage                       |
| 5  | Tempered Chestplate   | Rare      | +15% damage reduction                                        |
| 6  | Reflective Plating    | Rare      | Reflect 10% of melee damage back to attackers                |
| 7  | Titan's Bulwark       | Epic      | +25% max HP and immune to knockback                          |
| 8  | Thorn Mail             | Epic      | Attackers take 20% of the damage they deal as recoil         |
| 9  | Aegis of the Unyielding | Legendary | Take no more than 10% max HP per single hit                |
| 10 | Fortress Core         | Legendary | All allies within radius gain 15% damage reduction           |

### Habib's Upgrades (Weapons)

| #  | Name                  | Rarity    | Effect                                                        |
|----|-----------------------|-----------|---------------------------------------------------------------|
| 1  | Sharpened Edge        | Common    | +5% base damage                                              |
| 2  | Extended Mag          | Common    | +20% ammo capacity                                           |
| 3  | Lightweight Grip      | Common    | +10% reload speed                                            |
| 4  | Hollow Points         | Common    | +8% damage to unarmored enemies                              |
| 5  | Incendiary Rounds     | Rare      | Attacks have a 15% chance to apply burn (3s DoT)             |
| 6  | Precision Barrel      | Rare      | +20% crit chance                                             |
| 7  | Chain Lightning Mod   | Epic      | Attacks arc to 1 nearby enemy for 40% of the original damage |
| 8  | Vampiric Blade        | Epic      | Heal for 10% of damage dealt                                 |
| 9  | Godslayer Round       | Legendary | Every 10th hit deals 300% damage                             |
| 10 | Infinity Chamber      | Legendary | Unlimited ammo for the wave; +10% fire rate                  |

---

### Upgrade Selection
- Each character has a pool of upgrades defined in their JSON file.
- When the upgrade screen opens, a random subset is drawn from each character's pool and presented to the player. Higher-rarity upgrades should appear less frequently.
- The player picks one upgrade per character.

### Design Requirements
- **Data-driven**: all upgrades live in the JSON files listed above, not in code. Other developers will frequently add, update, and delete entries, so the schema must be simple and self-explanatory.
- **Easy to extend**: adding a new upgrade should only require appending an entry to the appropriate JSON file — no code changes.
- **Timing**: the upgrade screen must only appear after a wave is fully completed, never mid-wave.

### Deliverable
Provide a detailed implementation plan for this feature: data schema, screen flow, how upgrades are loaded/applied/reset, and any architecture considerations for maintainability.