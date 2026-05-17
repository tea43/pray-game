// ── Weapon definitions ────────────────────────────────────────────────────────
// Each entry fully describes a weapon's stats, behaviour, audio, and sprite.
// Heroes reference a key here via startingWeapon and weaponPool.
//
// type:
//   melee   — close-range swing; hits the single closest target in arc
//   cleave  — melee with arc hit on all enemies in a cone
//   thrown  — homing projectile that (optionally) returns to the thrower
//   ranged  — straight-line projectile(s), no return
//
// rarity: Common | Rare | Epic | Legendary — used by WeaponLevelUpScene card UI
// levels: 5-entry array of per-level stat overrides (added in commit 2)

export const WEAPON_DEFS = {

  // ── Melee ──────────────────────────────────────────────────────────────────

  hockey_club: {
    displayName:   'Hockey Club',
    type:          'melee',
    rarity:        'Common',
    dual:          true,            // alternating swings
    atkRange:      40,
    atkDmg:        26,
    atkRate:       0.34,
    knockback:     90,
    swingArc:      2.2,
    swingOffset:   1.1,
    sfxAttack:     'weapon.hockeyClub.attack',
    sfxFallback:   'weapon.attack.default',
    lootDuration:  null,
    levels: [
      /* L1 */ { atkDmg: 26, atkRate: 0.34 },
      /* L2 */ { atkDmg: 32, atkRate: 0.32 },
      /* L3 */ { atkDmg: 40, atkRate: 0.30, knockback: 110 },
      /* L4 */ { atkDmg: 50, atkRate: 0.28, knockback: 120 },
      /* L5 */ { atkDmg: 65, atkRate: 0.25, knockback: 140 },
    ],
  },

  short_hockey_club: {
    displayName:   'Short Hockey Club',
    type:          'melee',
    rarity:        'Common',
    shortClub:     true,            // use scaled-down club draw
    atkRange:      32,
    atkDmg:        18,
    atkRate:       0.28,
    knockback:     55,
    swingArc:      2.0,
    swingOffset:   1.0,
    sfxAttack:     'weapon.attack.default',
    sfxFallback:   'weapon.attack.default',
    lootDuration:  null,
    levels: [
      /* L1 */ { atkDmg: 18, atkRate: 0.28 },
      /* L2 */ { atkDmg: 23, atkRate: 0.26 },
      /* L3 */ { atkDmg: 29, atkRate: 0.24, knockback: 70 },
      /* L4 */ { atkDmg: 36, atkRate: 0.22, knockback: 80 },
      /* L5 */ { atkDmg: 46, atkRate: 0.19, knockback: 95 },
    ],
  },

  long_club: {
    displayName:   'Long Club',
    type:          'melee',
    rarity:        'Rare',
    atkRange:      56,
    atkDmg:        32,
    atkRate:       0.55,
    knockback:     80,
    swingArc:      2.4,
    swingOffset:   1.2,
    sfxAttack:     'weapon.longClub.attack',
    sfxFallback:   'weapon.attack.default',
    sprite:        'long_club',
    lootDuration:  null,           // null = starting weapon, never expires
    levels: [
      /* L1 */ { atkDmg: 32, atkRate: 0.55 },
      /* L2 */ { atkDmg: 40, atkRate: 0.52 },
      /* L3 */ { atkDmg: 50, atkRate: 0.48, knockback: 100 },
      /* L4 */ { atkDmg: 62, atkRate: 0.44, knockback: 110, atkRange: 62 },
      /* L5 */ { atkDmg: 78, atkRate: 0.39, knockback: 125, atkRange: 68 },
    ],
  },

  dual_clubs: {
    displayName:   'Dual Clubs',
    type:          'melee',
    rarity:        'Rare',
    dual:          true,           // alternates left/right on each swing
    atkRange:      36,
    atkDmg:        24,
    atkRate:       0.34,
    knockback:     80,
    swingArc:      2.2,
    swingOffset:   1.1,
    sfxAttack:     'weapon.dualClubs.attack',
    sfxFallback:   'weapon.attack.default',
    sprite:        'dual_clubs',
    lootDuration:  null,
    levels: [
      /* L1 */ { atkDmg: 24, atkRate: 0.34 },
      /* L2 */ { atkDmg: 30, atkRate: 0.31 },
      /* L3 */ { atkDmg: 38, atkRate: 0.28, knockback: 95 },
      /* L4 */ { atkDmg: 47, atkRate: 0.25, knockback: 105 },
      /* L5 */ { atkDmg: 60, atkRate: 0.22, knockback: 120 },
    ],
  },

  samurai_sword: {
    displayName:   'Samurai Sword',
    type:          'melee',
    rarity:        'Epic',
    cleave:        true,           // hits all enemies in a cone per swing
    cleaveArc:     60,             // degrees (total arc = cleaveArc * 2 → ±60°)
    atkRange:      80,
    atkDmg:        70,
    atkRate:       0.55,
    knockback:     120,
    sfxAttack:     'weapon.samurai.attack',
    sfxFallback:   'weapon.attack.default',
    sprite:        'samurai_sword',
    lootDuration:  20,
    levels: [
      /* L1 */ { atkDmg: 70, atkRate: 0.55 },
      /* L2 */ { atkDmg: 88, atkRate: 0.52, cleaveArc: 65 },
      /* L3 */ { atkDmg: 108, atkRate: 0.48, cleaveArc: 70, atkRange: 88 },
      /* L4 */ { atkDmg: 132, atkRate: 0.44, cleaveArc: 75, atkRange: 95 },
      /* L5 */ { atkDmg: 160, atkRate: 0.40, cleaveArc: 80, atkRange: 100, knockback: 150 },
    ],
  },

  // ── Thrown ─────────────────────────────────────────────────────────────────

  thrown_club: {
    displayName:       'Club',
    type:              'thrown',
    rarity:            'Common',
    atkRange:          220,
    atkDmg:            36,
    atkRate:           0.9,
    returns:           true,
    piercing:          false,
    projectileSpeed:   430,
    projectileMaxRange:280,
    sfxThrow:          'weapon.thrownClub.throw',
    sfxImpact:         'weapon.thrownClub.impact',
    sfxFallbackThrow:  'shoot',
    sfxFallbackImpact: 'hit',
    sprite:            'thrown_club',
    lootDuration:      null,
    levels: [
      /* L1 */ { atkDmg: 36, atkRate: 0.9, projectileMaxRange: 280 },
      /* L2 */ { atkDmg: 44, atkRate: 0.85, projectileMaxRange: 310 },
      /* L3 */ { atkDmg: 54, atkRate: 0.80, projectileMaxRange: 340 },
      /* L4 */ { atkDmg: 66, atkRate: 0.74, projectileMaxRange: 370, piercing: true },
      /* L5 */ { atkDmg: 80, atkRate: 0.68, projectileMaxRange: 400, piercing: true },
    ],
  },

  boomerang: {
    displayName:       'Boomerang',
    type:              'thrown',
    rarity:            'Rare',
    atkRange:          300,
    atkDmg:            28,
    atkRate:           0.7,
    returns:           true,
    piercing:          true,       // hits multiple enemies on the outbound path
    projectileSpeed:   500,
    projectileMaxRange:340,
    sfxThrow:          'weapon.boomerang.throw',
    sfxImpact:         'weapon.boomerang.impact',
    sfxFallbackThrow:  'shoot',
    sfxFallbackImpact: 'hit',
    sprite:            'boomerang',
    lootDuration:      18,
    levels: [
      /* L1 */ { atkDmg: 28, atkRate: 0.7, projectileMaxRange: 340 },
      /* L2 */ { atkDmg: 35, atkRate: 0.65, projectileMaxRange: 370 },
      /* L3 */ { atkDmg: 44, atkRate: 0.60, projectileMaxRange: 400 },
      /* L4 */ { atkDmg: 55, atkRate: 0.55, projectileMaxRange: 430 },
      /* L5 */ { atkDmg: 68, atkRate: 0.50, projectileMaxRange: 460, atkRange: 350 },
    ],
  },

  throwing_stone: {
    displayName:       'Throwing Stone',
    type:              'thrown',
    rarity:            'Common',
    atkRange:          190,
    atkDmg:            22,
    atkRate:           0.55,
    returns:           false,
    piercing:          false,
    aoeRadius:         26,         // deals damage to all enemies within radius on impact
    projectileSpeed:   540,
    projectileMaxRange:210,
    sfxThrow:          'weapon.stone.throw',
    sfxImpact:         'weapon.stone.impact',
    sfxFallbackThrow:  'shoot',
    sfxFallbackImpact: 'hit',
    sprite:            'throwing_stone',
    lootDuration:      12,
    levels: [
      /* L1 */ { atkDmg: 22, atkRate: 0.55 },
      /* L2 */ { atkDmg: 28, atkRate: 0.52 },
      /* L3 */ { atkDmg: 36, atkRate: 0.48, aoeRadius: 32 },
      /* L4 */ { atkDmg: 45, atkRate: 0.44, aoeRadius: 38 },
      /* L5 */ { atkDmg: 56, atkRate: 0.40, aoeRadius: 44, projectileMaxRange: 240 },
    ],
  },

  // ── Ranged ─────────────────────────────────────────────────────────────────

  shotgun: {
    displayName:       'Shotgun',
    type:              'ranged',
    rarity:            'Rare',
    atkRange:          300,
    atkDmg:            18,         // per bullet
    atkRate:           1.10,
    bulletCount:       5,
    spread:            0.35,       // half-angle spread in radians
    projectileSpeed:   480,
    sfxFire:           'weapon.shotgun.fire',
    sfxFallback:       'shoot',
    sprite:            'shotgun',
    lootDuration:      15,
    levels: [
      /* L1 */ { atkDmg: 18, atkRate: 1.10, bulletCount: 5 },
      /* L2 */ { atkDmg: 22, atkRate: 1.05, bulletCount: 5 },
      /* L3 */ { atkDmg: 26, atkRate: 1.00, bulletCount: 6 },
      /* L4 */ { atkDmg: 31, atkRate: 0.92, bulletCount: 6, spread: 0.30 },
      /* L5 */ { atkDmg: 37, atkRate: 0.84, bulletCount: 7, spread: 0.28 },
    ],
  },

  bow: {
    displayName:       'Bow',
    type:              'ranged',
    rarity:            'Epic',
    atkRange:          380,
    atkDmg:            90,
    atkRate:           2.5,
    bulletCount:       1,
    spread:            0,
    projectileSpeed:   620,
    sfxFire:           'weapon.bow.fire',
    sfxFallback:       'shoot',
    sprite:            'bow',
    lootDuration:      18,
    levels: [
      /* L1 */ { atkDmg: 90,  atkRate: 2.5 },
      /* L2 */ { atkDmg: 112, atkRate: 2.3 },
      /* L3 */ { atkDmg: 138, atkRate: 2.1, bulletCount: 2 },
      /* L4 */ { atkDmg: 168, atkRate: 1.9, bulletCount: 2 },
      /* L5 */ { atkDmg: 200, atkRate: 1.7, bulletCount: 2, atkRange: 430 },
    ],
  },

  crossbow: {
    displayName:       'Crossbow',
    type:              'ranged',
    rarity:            'Rare',
    atkRange:          440,
    atkDmg:            65,
    atkRate:           1.9,
    bulletCount:       1,
    spread:            0,
    projectileSpeed:   800,
    sfxFire:           'weapon.crossbow.fire',
    sfxFallback:       'shoot',
    sprite:            'crossbow',
    lootDuration:      22,
    levels: [
      /* L1 */ { atkDmg: 65,  atkRate: 1.9 },
      /* L2 */ { atkDmg: 82,  atkRate: 1.75 },
      /* L3 */ { atkDmg: 100, atkRate: 1.60 },
      /* L4 */ { atkDmg: 122, atkRate: 1.45, atkRange: 480 },
      /* L5 */ { atkDmg: 148, atkRate: 1.30, atkRange: 520, bulletCount: 2 },
    ],
  },
};

// Returns weapon stats merged with the per-level overrides for slot.level.
// When def.levels is absent (or level 1 baseline), returns the def unchanged.
export function resolveWeaponStats(slot) {
  const def = WEAPON_DEFS[slot?.key];
  if (!def) return {};
  const lvl = def.levels?.[slot.level - 1] ?? {};
  return { key: slot.key, ...def, ...lvl };
}
