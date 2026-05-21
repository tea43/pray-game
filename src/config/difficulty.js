// Difficulty Configuration
// ========================
//
// Each tier is a nested object grouped into three subsystems: hero, enemy, loot.
// To add a new tier, copy an existing entry and adjust values — no other file needs
// to change as long as DIFFICULTY_ORDER is updated.
//
// ── hero ───────────────────────────────────────────────────────────────────────
//   hpMult         Multiplier on each survivor's max HP.
//                    > 1 = more health (easier), < 1 = less health (harder).
//   armorMult      Protection multiplier. Higher = more armour = less damage taken.
//                    Damage received = base_dmg / armorMult.
//                    1.2 → survivor takes ~17% less damage.
//                    0.85 → survivor takes ~18% more damage.
//                    Reserved — not yet wired into Unit damage application.
//   abilityCdMult  Multiplier on all ability cooldown durations.
//                    < 1 = cooldowns recharge faster (easier).
//
// ── enemy ──────────────────────────────────────────────────────────────────────
//   hpMult         Multiplier on every spawned enemy's max HP.
//   dmgMult        Multiplier on every spawned enemy's damage per hit.
//   speedMult      Multiplier on every spawned enemy's movement speed.
//   spawnMult      Spawn speed multiplier. Higher = faster spawns (harder).
//                    spawnInterval = base / spawnMult.
//                    1.0 = normal, 1.5 = 50% faster spawning.
//   burstChanceMult  Scales the chance of a 2nd / 3rd enemy per spawn tick.
//                    > 1 = more simultaneous spawns (harder).
//   bosses         Explicit wave-to-count map per boss type.
//                    Each key is a wave number (integer), each value is the
//                    number of bosses of that type to spawn on that wave.
//                    Multiple types can trigger on the same wave.
//                    Supported types: miniboss, bigboss.
//                    Reserved type: megaboss (add to ENEMY_DEFS + spawning.js when ready).
//                    Example — two minibosses at wave 8, one bigboss at wave 9:
//                      miniboss: { 4: 1, 8: 2 }
//                      bigboss:  { 9: 1 }
//
// ── loot ───────────────────────────────────────────────────────────────────────
//   dropChanceMult   Global multiplier on every enemy's base drop chance.
//                      > 1 = more drops (easier).
//   healAmount       Absolute HP restored by one medkit pickup.
//   stimDuration     Seconds the stimpack rage buff lasts.
//   itemChances      Independent probability for each basic loot item.
//                    Each item is rolled separately — changing one does NOT
//                    affect the others. Values are 0–1 probabilities.
//                    Total < 1 → sometimes a drop roll yields nothing.
//                    Total > 1 → sometimes multiple items drop at once.
//     medkit           Probability of dropping a medkit on a successful drop roll.
//     stimpack         Probability of dropping a stimpack on a successful drop roll.
//     bomb             Probability of dropping a bomb on a successful drop roll.
//   specialDropMult  Multiplier on banana-bomb and special-weapon drop chances
//                    from elite enemies (mutant, blinker).

export const DIFFICULTY_DEFS = {

  'cavity-cadet': {
    label: 'Cavity Cadet',

    hero: {
      hpMult:                  1.25,
      armorMult:               1.20,
      abilityCdMult:           0.75,
      activeSkillDurabilityMod: 1,   // +1 wave → 4 waves default
    },

    enemy: {
      hpMult:          0.70,
      dmgMult:         0.70,
      speedMult:       0.80,
      spawnMult:       0.75,  // spawns are 25% slower than normal
      burstChanceMult: 0.50,
      bosses: {
        miniboss: { 5: 1, 10: 1, 15: 1, 20: 1 },
        bigboss:  { 11: 1 },
        // megaboss: {}  // reserved
      },
    },

    loot: {
      dropChanceMult:  1.50,
      healAmount:      80,
      stimDuration:    8,
      itemChances: {    // independent rolls — changing one does not affect others
        medkit:   0.07, // generous healing
        stimpack: 0.03,
        bomb:     0.01,
      },
      specialDropMult: 1.50,
    },
  },

  'brood-hunter': {
    label: 'Brood Hunter',

    hero: {
      hpMult:                  1.00,
      armorMult:               1.00,
      abilityCdMult:           1.00,
      activeSkillDurabilityMod: 0,
    },

    enemy: {
      hpMult:          1.00,
      dmgMult:         1.00,
      speedMult:       1.00,
      spawnMult:       1.00,
      burstChanceMult: 1.00,
      bosses: {
        miniboss: { 4: 1, 8: 1, 12: 1, 16: 1, 20: 1 },
        bigboss:  { 9: 1, 18: 1 },
        // megaboss: {}  // reserved
      },
    },

    loot: {
      dropChanceMult:  1.00,
      healAmount:      60,
      stimDuration:    5,
      itemChances: {
        medkit:   0.06,
        stimpack: 0.035,
        bomb:     0.01,
      },
      specialDropMult: 1.00,
    },
  },

  'crack-knight': {
    label: 'The Crack Knight',

    hero: {
      hpMult:                  0.85,
      armorMult:               1.00,
      abilityCdMult:           1.15,
      activeSkillDurabilityMod: -1,  // 2 waves (minimum)
    },

    enemy: {
      hpMult:          1.30,
      dmgMult:         1.30,
      speedMult:       1.15,
      spawnMult:       1.20,  // spawns are 20% faster
      burstChanceMult: 1.30,
      bosses: {
        miniboss: { 3: 1, 6: 1, 10: 1, 13: 1, 17: 1, 20: 1 },
        bigboss:  { 8: 1, 16: 1 },
        // megaboss: {}  // reserved
      },
    },

    loot: {
      dropChanceMult:  0.70,
      healAmount:      45,
      stimDuration:    4,
      itemChances: {
        medkit:   0.05,  // fewer medkits
        stimpack: 0.03,  // stimpack unchanged relative to medkit
        bomb:     0.024, // more explosives
      },
      specialDropMult: 0.70,
    },
  },

  'rear-admiral': {
    label: 'Rear Admiral',

    hero: {
      hpMult:                  0.70,
      armorMult:               0.85,
      abilityCdMult:           1.35,
      activeSkillDurabilityMod: -1,  // 2 waves (minimum)
    },

    enemy: {
      hpMult:          1.70,
      dmgMult:         1.70,
      speedMult:       1.40,
      spawnMult:       1.55,
      burstChanceMult: 1.80,
      bosses: {
        miniboss: { 3: 2, 6: 1, 10: 2, 14: 1, 18: 1 },
        bigboss:  { 7: 1, 14: 1, 21: 1 },
      },
    },

    loot: {
      dropChanceMult:  0.40,
      healAmount:      30,
      stimDuration:    3,
      itemChances: {
        medkit:   0.035,
        stimpack: 0.025,
        bomb:     0.056,
      },
      specialDropMult: 0.40,
    },
  },

  'dev-mode': {
    label: 'Dev Mode',
    // Start at wave 21 so all enemy types are in the spawn pool.
    // devSpawn pre-places one of each type on game start so they are visible immediately.
    // Bosses are handled separately via the bosses map.
    // K key (in-game) instantly kills all enemies to skip to extraction.
    devWaves: [21],
    devSpawn: [
      { kind: 'raider',  count: 2 },
      { kind: 'runner',  count: 2 },
      { kind: 'ghoul',   count: 2 },
      { kind: 'mutant',  count: 1 },
      { kind: 'blinker', count: 1 },
    ],

    hero: {
      hpMult:                  2.00,
      armorMult:               2.00,
      abilityCdMult:           0.50,
      activeSkillDurabilityMod: 0,
    },

    enemy: {
      hpMult:          0.30,
      dmgMult:         0.30,
      speedMult:       0.70,
      spawnMult:       0.50,
      burstChanceMult: 0.30,
      bosses: {
        miniboss: { 21: 1 },
        bigboss:  { 21: 1 },
      },
    },

    loot: {
      dropChanceMult:  3.00,
      healAmount:      999,
      stimDuration:    15,
      itemChances: {
        medkit:   0.10,
        stimpack: 0.08,
        bomb:     0.08,
      },
      specialDropMult: 3.00,
    },
  },

  'ability-test': {
    label: 'Ability Test',
    // Group ability testing mode: superboost always full, enemies spawn close and fast.
    devAbilityTest: true,
    devWaves: [5],
    devSpawn: [
      { kind: 'raider', count: 3 },
      { kind: 'ghoul',  count: 2 },
      { kind: 'mutant', count: 1 },
    ],

    hero: {
      hpMult:                  3.00,
      armorMult:               2.00,
      abilityCdMult:           0.40,
      activeSkillDurabilityMod: 0,
    },

    enemy: {
      hpMult:          0.25,
      dmgMult:         0.25,
      speedMult:       0.80,
      spawnMult:       2.00,  // fast spawn rate
      burstChanceMult: 0.50,
      bosses: {},
    },

    loot: {
      dropChanceMult:  2.00,
      healAmount:      999,
      stimDuration:    10,
      itemChances: {
        medkit:   0.10,
        stimpack: 0.08,
        bomb:     0.05,
      },
      specialDropMult: 2.00,
    },
  },

  'max-abilities': {
    label: 'Max Abilities',
    // All ability trees start at level 3. Superboost always full.
    // Use this to test every ability and Dance of Death at full power.
    devMaxAbilities: true,
    devAbilityTest: true,   // keeps superboost meter full
    devWaves: [5],
    devSpawn: [
      { kind: 'raider', count: 4 },
      { kind: 'ghoul',  count: 3 },
      { kind: 'mutant', count: 2 },
      { kind: 'blinker', count: 1 },
    ],

    hero: {
      hpMult:                  3.00,
      armorMult:               2.00,
      abilityCdMult:           0.30,   // short cooldowns for rapid testing
      activeSkillDurabilityMod: 0,
    },

    enemy: {
      hpMult:          0.25,
      dmgMult:         0.20,
      speedMult:       0.80,
      spawnMult:       2.00,
      burstChanceMult: 0.50,
      bosses: { miniboss: { 5: 1 } },
    },

    loot: {
      dropChanceMult:  3.00,
      healAmount:      999,
      stimDuration:    15,
      itemChances: {
        medkit:   0.12,
        stimpack: 0.10,
        bomb:     0.06,
      },
      specialDropMult: 3.00,
    },
  },

};

export const DIFFICULTY_ORDER = ['cavity-cadet', 'brood-hunter', 'crack-knight', 'rear-admiral', 'dev-mode'];

// Rolls each item independently using the active difficulty's itemChances.
// Returns an array of loot type strings (may be empty, may contain multiple).
export function rollItemDrops(diff) {
  const c = diff.loot.itemChances;
  const drops = [];
  if (Math.random() < c.medkit)   drops.push('medkit');
  if (Math.random() < c.stimpack) drops.push('stimpack');
  if (Math.random() < c.bomb)     drops.push('bomb');
  return drops;
}
