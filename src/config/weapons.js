// ── Weapon definitions ────────────────────────────────────────────────────────
// Each entry fully describes a weapon's stats, behaviour, audio, and sprite.
// Heroes reference a key here via startingWeapon.
// Loot pickups also use these keys — applyLoot() sets unit.currentWeapon.
//
// type:
//   melee   — close-range swing; hits the single closest target in arc
//   cleave  — melee with arc hit on all enemies in a cone
//   thrown  — homing projectile that (optionally) returns to the thrower
//   ranged  — straight-line projectile(s), no return

export const WEAPON_DEFS = {

  // ── Melee ──────────────────────────────────────────────────────────────────

  hockey_club: {
    displayName:   'Hockey Club',
    type:          'melee',
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
  },

  short_hockey_club: {
    displayName:   'Short Hockey Club',
    type:          'melee',
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
  },

  long_club: {
    displayName:   'Long Club',
    type:          'melee',
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
  },

  dual_clubs: {
    displayName:   'Dual Clubs',
    type:          'melee',
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
  },

  samurai_sword: {
    displayName:   'Samurai Sword',
    type:          'melee',
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
  },

  // ── Thrown ─────────────────────────────────────────────────────────────────

  thrown_club: {
    displayName:       'Club',
    type:              'thrown',
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
  },

  boomerang: {
    displayName:       'Boomerang',
    type:              'thrown',
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
  },

  throwing_stone: {
    displayName:       'Throwing Stone',
    type:              'thrown',
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
  },

  // ── Ranged ─────────────────────────────────────────────────────────────────

  shotgun: {
    displayName:       'Shotgun',
    type:              'ranged',
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
  },

  bow: {
    displayName:       'Bow',
    type:              'ranged',
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
  },

  crossbow: {
    displayName:       'Crossbow',
    type:              'ranged',
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
  },
};
