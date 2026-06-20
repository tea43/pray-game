# Weapons Rework Plan

This document details the exact code changes to replace the 11 generic placeholder weapons with the 16 new thematic post-soviet weapons.

## 1. `src/config/weapons.js`
The `WEAPON_DEFS` object will be entirely replaced with the following code. Attack rates (`atkRate`) are scaled down by ~5-10% per level to keep upgrades feeling impactful alongside the x1 to x3 damage scaling.

```javascript
export const WEAPON_DEFS = {

  // ── Melee ──────────────────────────────────────────────────────────────────

  car_antenna: {
    displayName:   'Car Antenna',
    type:          'melee',
    rarity:        'Common',
    atkRange:      55,
    atkDmg:        40,
    atkRate:       0.55,
    knockback:     40,
    swingArc:      1.5,
    swingOffset:   1.0,
    sfxAttack:     'weapon.attack.default',
    sfxFallback:   'weapon.attack.default',
    sprite:        'car_antenna',
    lootDuration:  null,
    levels: [
      { atkDmg: 40, atkRate: 0.55 },
      { atkDmg: 60, atkRate: 0.52 },
      { atkDmg: 80, atkRate: 0.49 },
      { atkDmg: 100, atkRate: 0.46 },
      { atkDmg: 120, atkRate: 0.43 },
    ],
  },

  toilet_lid: {
    displayName:   'Toilet Lid',
    type:          'melee',
    rarity:        'Rare',
    cleave:        true,
    cleaveArc:     55,
    atkRange:      45,
    atkDmg:        95,
    atkRate:       1.3,
    knockback:     160,
    sfxAttack:     'weapon.attack.default',
    sfxFallback:   'weapon.attack.default',
    sprite:        'toilet_lid',
    lootDuration:  null,
    levels: [
      { atkDmg: 95, atkRate: 1.30 },
      { atkDmg: 142.5, atkRate: 1.23 },
      { atkDmg: 190, atkRate: 1.16 },
      { atkDmg: 237.5, atkRate: 1.09 },
      { atkDmg: 285, atkRate: 1.02 },
    ],
  },

  bus_stop_pole: {
    displayName:   'Bus Stop Pole',
    type:          'melee',
    rarity:        'Epic',
    atkRange:      80,
    atkDmg:        150,
    atkRate:       2.0,
    knockback:     200,
    swingArc:      2.4,
    swingOffset:   1.2,
    sfxAttack:     'weapon.attack.default',
    sfxFallback:   'weapon.attack.default',
    sprite:        'bus_stop_pole',
    lootDuration:  null,
    levels: [
      { atkDmg: 150, atkRate: 2.0 },
      { atkDmg: 225, atkRate: 1.9 },
      { atkDmg: 300, atkRate: 1.8 },
      { atkDmg: 375, atkRate: 1.7 },
      { atkDmg: 450, atkRate: 1.6 },
    ],
  },

  radiator_rib: {
    displayName:   'Radiator Rib',
    type:          'melee',
    rarity:        'Legendary',
    atkRange:      50,
    atkDmg:        190,
    atkRate:       2.2,
    knockback:     250,
    swingArc:      2.0,
    swingOffset:   1.0,
    sfxAttack:     'weapon.attack.default',
    sfxFallback:   'weapon.attack.default',
    sprite:        'radiator_rib',
    lootDuration:  null,
    levels: [
      { atkDmg: 190, atkRate: 2.2 },
      { atkDmg: 285, atkRate: 2.1 },
      { atkDmg: 380, atkRate: 2.0 },
      { atkDmg: 475, atkRate: 1.9 },
      { atkDmg: 570, atkRate: 1.8 },
    ],
  },

  plastic_chair: {
    displayName:   'Plastic Chair',
    type:          'melee',
    rarity:        'Common',
    atkRange:      45,
    atkDmg:        65,
    atkRate:       0.7,
    knockback:     100,
    swingArc:      2.2,
    swingOffset:   1.1,
    sfxAttack:     'weapon.attack.default',
    sfxFallback:   'weapon.attack.default',
    sprite:        'plastic_chair',
    lootDuration:  null,
    levels: [
      { atkDmg: 65, atkRate: 0.70 },
      { atkDmg: 97.5, atkRate: 0.66 },
      { atkDmg: 130, atkRate: 0.62 },
      { atkDmg: 162.5, atkRate: 0.58 },
      { atkDmg: 195, atkRate: 0.54 },
    ],
  },

  shower_hose: {
    displayName:   'Shower Hose',
    type:          'melee',
    rarity:        'Rare',
    cleave:        true,
    cleaveArc:     45,
    atkRange:      75,
    atkDmg:        80,
    atkRate:       1.2,
    knockback:     70,
    sfxAttack:     'weapon.attack.default',
    sfxFallback:   'weapon.attack.default',
    sprite:        'shower_hose',
    lootDuration:  null,
    levels: [
      { atkDmg: 80, atkRate: 1.20 },
      { atkDmg: 120, atkRate: 1.14 },
      { atkDmg: 160, atkRate: 1.08 },
      { atkDmg: 200, atkRate: 1.02 },
      { atkDmg: 240, atkRate: 0.96 },
    ],
  },

  chain_with_padlock: {
    displayName:   'Doggo Chain',
    type:          'melee',
    rarity:        'Epic',
    cleave:        true,
    cleaveArc:     60,
    atkRange:      65,
    atkDmg:        110,
    atkRate:       1.6,
    knockback:     180,
    sfxAttack:     'weapon.attack.default',
    sfxFallback:   'weapon.attack.default',
    sprite:        'chain_with_padlock',
    lootDuration:  null,
    levels: [
      { atkDmg: 110, atkRate: 1.60 },
      { atkDmg: 165, atkRate: 1.52 },
      { atkDmg: 220, atkRate: 1.44 },
      { atkDmg: 275, atkRate: 1.36 },
      { atkDmg: 330, atkRate: 1.28 },
    ],
  },

  extension_cord: {
    displayName:   'Extension Cord',
    type:          'melee',
    rarity:        'Common',
    cleave:        true,
    cleaveArc:     50,
    atkRange:      70,
    atkDmg:        70,
    atkRate:       1.0,
    knockback:     60,
    sfxAttack:     'weapon.attack.default',
    sfxFallback:   'weapon.attack.default',
    sprite:        'extension_cord',
    lootDuration:  null,
    levels: [
      { atkDmg: 70, atkRate: 1.00 },
      { atkDmg: 105, atkRate: 0.95 },
      { atkDmg: 140, atkRate: 0.90 },
      { atkDmg: 175, atkRate: 0.85 },
      { atkDmg: 210, atkRate: 0.80 },
    ],
  },

  // ── Thrown ─────────────────────────────────────────────────────────────────

  frozen_cutlet: {
    displayName:       'Frozen Cutlet',
    type:              'thrown',
    rarity:            'Common',
    atkRange:          220,
    atkDmg:            40,
    atkRate:           0.8,
    returns:           false,
    piercing:          false,
    projectileSpeed:   450,
    projectileMaxRange:240,
    sfxThrow:          'shoot',
    sfxImpact:         'hit',
    sfxFallbackThrow:  'shoot',
    sfxFallbackImpact: 'hit',
    sprite:            'frozen_cutlet',
    lootDuration:      null,
    levels: [
      { atkDmg: 40, atkRate: 0.80 },
      { atkDmg: 60, atkRate: 0.76 },
      { atkDmg: 80, atkRate: 0.72 },
      { atkDmg: 100, atkRate: 0.68 },
      { atkDmg: 120, atkRate: 0.64 },
    ],
  },

  pickle_jar: {
    displayName:       'Pickle Jar',
    type:              'thrown',
    rarity:            'Epic',
    atkRange:          200,
    atkDmg:            105,
    atkRate:           1.5,
    returns:           false,
    piercing:          false,
    aoeRadius:         40,
    projectileSpeed:   400,
    projectileMaxRange:220,
    sfxThrow:          'shoot',
    sfxImpact:         'hit',
    sfxFallbackThrow:  'shoot',
    sfxFallbackImpact: 'hit',
    sprite:            'pickle_jar',
    lootDuration:      null,
    levels: [
      { atkDmg: 105, atkRate: 1.50 },
      { atkDmg: 157.5, atkRate: 1.42 },
      { atkDmg: 210, atkRate: 1.34 },
      { atkDmg: 262.5, atkRate: 1.26 },
      { atkDmg: 315, atkRate: 1.18, aoeRadius: 50 },
    ],
  },

  bottle_cap_shuriken: {
    displayName:       'Cap Shuriken',
    type:              'thrown',
    rarity:            'Common',
    atkRange:          260,
    atkDmg:            25,
    atkRate:           0.35,
    returns:           false,
    piercing:          false,
    projectileSpeed:   600,
    projectileMaxRange:280,
    sfxThrow:          'shoot',
    sfxImpact:         'hit',
    sfxFallbackThrow:  'shoot',
    sfxFallbackImpact: 'hit',
    sprite:            'bottle_cap_shuriken',
    lootDuration:      null,
    levels: [
      { atkDmg: 25, atkRate: 0.35 },
      { atkDmg: 37.5, atkRate: 0.33 },
      { atkDmg: 50, atkRate: 0.31 },
      { atkDmg: 62.5, atkRate: 0.29 },
      { atkDmg: 75, atkRate: 0.27 },
    ],
  },

  // ── Ranged ─────────────────────────────────────────────────────────────────

  bed_spring_arbalest: {
    displayName:       'Spring Arbalest',
    type:              'ranged',
    rarity:            'Epic',
    atkRange:          420,
    atkDmg:            110,
    atkRate:           2.0,
    bulletCount:       1,
    spread:            0,
    projectileSpeed:   750,
    sfxFire:           'shoot',
    sfxFallback:       'shoot',
    sprite:            'bed_spring_arbalest',
    lootDuration:      null,
    levels: [
      { atkDmg: 110, atkRate: 2.0 },
      { atkDmg: 165, atkRate: 1.9 },
      { atkDmg: 220, atkRate: 1.8 },
      { atkDmg: 275, atkRate: 1.7 },
      { atkDmg: 330, atkRate: 1.6 },
    ],
  },

  bike_spoke_slingshot: {
    displayName:       'Spoke Slingshot',
    type:              'ranged',
    rarity:            'Common',
    atkRange:          350,
    atkDmg:            57,
    atkRate:           0.9,
    bulletCount:       1,
    spread:            0.05,
    projectileSpeed:   600,
    sfxFire:           'shoot',
    sfxFallback:       'shoot',
    sprite:            'bike_spoke_slingshot',
    lootDuration:      null,
    levels: [
      { atkDmg: 57, atkRate: 0.90 },
      { atkDmg: 85.5, atkRate: 0.85 },
      { atkDmg: 114, atkRate: 0.80 },
      { atkDmg: 142.5, atkRate: 0.75 },
      { atkDmg: 171, atkRate: 0.70 },
    ],
  },

  courtyard_railgun: {
    displayName:       'Railgun',
    type:              'ranged',
    rarity:            'Legendary',
    atkRange:          500,
    atkDmg:            130,
    atkRate:           2.0,
    bulletCount:       1,
    spread:            0,
    projectileSpeed:   1200,
    sfxFire:           'shoot',
    sfxFallback:       'shoot',
    sprite:            'courtyard_railgun',
    lootDuration:      null,
    levels: [
      { atkDmg: 130, atkRate: 2.0 },
      { atkDmg: 195, atkRate: 1.9 },
      { atkDmg: 260, atkRate: 1.8 },
      { atkDmg: 325, atkRate: 1.7 },
      { atkDmg: 390, atkRate: 1.6 },
    ],
  },

  contraceptive_catapult: {
    displayName:       'Catapult',
    type:              'ranged',
    rarity:            'Rare',
    atkRange:          380,
    atkDmg:            75,
    atkRate:           1.1,
    bulletCount:       1,
    spread:            0.1,
    projectileSpeed:   500,
    sfxFire:           'shoot',
    sfxFallback:       'shoot',
    sprite:            'contraceptive_catapult',
    lootDuration:      null,
    levels: [
      { atkDmg: 75, atkRate: 1.10 },
      { atkDmg: 112.5, atkRate: 1.04 },
      { atkDmg: 150, atkRate: 0.98 },
      { atkDmg: 187.5, atkRate: 0.92 },
      { atkDmg: 225, atkRate: 0.86 },
    ],
  },

  fence_wire_bow: {
    displayName:       'Fence Bow',
    type:              'ranged',
    rarity:            'Common',
    atkRange:          360,
    atkDmg:            65,
    atkRate:           0.9,
    bulletCount:       1,
    spread:            0.15,
    projectileSpeed:   580,
    sfxFire:           'shoot',
    sfxFallback:       'shoot',
    sprite:            'fence_wire_bow',
    lootDuration:      null,
    levels: [
      { atkDmg: 65, atkRate: 0.90 },
      { atkDmg: 97.5, atkRate: 0.85 },
      { atkDmg: 130, atkRate: 0.80 },
      { atkDmg: 162.5, atkRate: 0.75 },
      { atkDmg: 195, atkRate: 0.70 },
    ],
  },
};
```

## 2. `src/config/heroes.js`
The hero loadouts will be modified in `HERO_DEFS` as follows. This gives each hero a distinct post-apocalyptic identity and a custom starting weapon that fits their playstyle.

**For Eliott:**
```javascript
  eliott: {
    // ... stats and colors ...
    startingWeapon: 'frozen_cutlet',
    weaponPool: ['frozen_cutlet', 'pickle_jar', 'bottle_cap_shuriken', 'fence_wire_bow', 'plastic_chair', 'extension_cord'],
    // ...
  },
```

**For Dick:**
```javascript
  dick: {
    // ... stats and colors ...
    startingWeapon: 'plastic_chair',
    weaponPool: ['plastic_chair', 'bus_stop_pole', 'radiator_rib', 'toilet_lid', 'chain_with_padlock', 'car_antenna'],
    // ...
  },
```

**For Habib:**
```javascript
  habib: {
    // ... stats and colors ...
    startingWeapon: 'extension_cord',
    weaponPool: ['extension_cord', 'shower_hose', 'bike_spoke_slingshot', 'bed_spring_arbalest', 'contraceptive_catapult', 'courtyard_railgun'],
    // ...
  },
```

## 3. `src/render/weaponSprites.js`
All old sprites will be deleted from `WEAPON_SPRITES` and `WEAPON_IMAGE_DEFS` (if applicable) and replaced with simple 16x16 placeholder block definitions for the 16 new keys to prevent rendering errors. For example:

```javascript
export const WEAPON_SPRITES = {
  frozen_cutlet: [
    "                ",
    "      1111      ",
    "     155551     ",
    "    15555551    ",
    "    15555551    ",
    "    15555551    ",
    "     155551     ",
    "      1111      ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                "
  ],
  // ... (15 more simple placeholder boxes generated with standard colors)
};
```

## 4. `docs/current/current_game_state.md`
The Base Weapons section will be updated:

```markdown
## Base Weapons

- Eliott: `frozen_cutlet` (slot 0, level 1); fast kitchen projectile.
- Dick: `plastic_chair` (slot 0, level 1); slap-and-smash fast weapon.
- Habib: `extension_cord` (slot 0, level 1); balanced mid-range whip.
```
And the Hero weapon pools text will match the `heroes.js` logic above.
