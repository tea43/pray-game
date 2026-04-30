export const ENEMY_DEFS = {
  raider:   { displayName: 'Worm Hatchling', r: 9,  speed: 48,  hp: 30,   dmg: 10, color: '#3a2515', skin: '#c4a68a', hair: '#1a0f05', bloodColor: '#8a1a1a', dropChance: 0.45, fallbackRenderer: 'raider' },
  runner:   { displayName: 'Dart Worm',      r: 8,  speed: 105, hp: 22,   dmg: 8,  color: '#5a3a20', skin: '#d8b890', hair: '#1a0f05', bloodColor: '#8a1a1a', dropChance: 0.30, fallbackRenderer: 'runner' },
  ghoul:    { displayName: 'Husk Crawler',   r: 10, speed: 58,  hp: 50,   dmg: 14, color: '#4a3a25', skin: '#9a8570', hair: '#3a2515', bloodColor: '#6a3030', dropChance: 0.65, fallbackRenderer: 'ghoul' },
  mutant:   { displayName: 'Burrow Brute',   r: 15, speed: 32,  hp: 90,   dmg: 22, color: '#3a4a2a', skin: '#7a8a55', hair: '#2a3a20', bloodColor: '#4a6a2a', dropChance: 1.00, specialEligible: true, fallbackRenderer: 'mutant' },
  blinker:  { displayName: 'Phase Worm',     r: 10, speed: 38,  hp: 45,   dmg: 18, color: '#3a2545', skin: '#a890c8', hair: '#2a1830', bloodColor: '#5a2a6a', dropChance: 0.80, specialEligible: true, fallbackRenderer: 'blinker' },
  miniboss: { displayName: 'Brood Warden',   r: 22, speed: 40,  hp: 600,  dmg: 32, color: '#2a1a0a', skin: '#9a7a55', hair: '#1a0a05', bloodColor: '#7a1010', kbResist: 0.35, name: 'BROOD WARDEN', fallbackRenderer: 'miniboss' },
  bigboss:  { displayName: 'Elder Worm',     r: 32, speed: 28,  hp: 2000, dmg: 48, color: '#2a3a1a', skin: '#6a8a40', hair: '#1a2010', bloodColor: '#3a6a1a', kbResist: 0.18, name: 'ELDER WORM', fallbackRenderer: 'bigboss' },
};
