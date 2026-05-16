export const LOOT_DEFS = {
  basicDropWeights: [
    { type: 'medkit',      threshold: 0.52 },
    { type: 'rare_medkit', threshold: 0.60 },
    { type: 'stimpack',    threshold: 0.95 },
    { type: 'bomb',        threshold: 1.00 },
  ],
  specialWeapons: ['shotgun', 'samurai_sword', 'boomerang', 'bow'],
  bananaBombChance: 0.02,
  specialWeaponChance: 0.20,
  // Explosion damage (falls off linearly to 0 at edge of radius)
  bombDamage:       150,   // max damage at centre (was instant kill)
  bananaBombDamage: 300,
  essence: {
    xpPerPickup: 1,
    xpPerLevel:  50,
    dropCount: { regular: 1, miniboss: 8, bigboss: 25 },
  },
};
