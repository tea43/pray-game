#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'wasteland_survivors-v4.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);

if (!scriptMatch) {
  throw new Error('No embedded script found in wasteland_survivors-v4.html');
}

const script = scriptMatch[1];
new Function(script);

const configStart = script.indexOf('const HERO_DEFS =');
const configEnd = script.indexOf("window.addEventListener('resize'");

if (configStart < 0 || configEnd < 0 || configEnd <= configStart) {
  throw new Error('Could not locate in-file config block');
}

const configBlock = script.slice(configStart, configEnd);
const sandbox = {};
vm.runInNewContext(`${configBlock}
result = { HERO_DEFS, ENEMY_DEFS, LOOT_DEFS, WAVE_DEFS, DISPLAY_NAME_DEFS };`, sandbox);

const { HERO_DEFS, ENEMY_DEFS, LOOT_DEFS, WAVE_DEFS, DISPLAY_NAME_DEFS } = sandbox.result;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(DISPLAY_NAME_DEFS.gameTitle === 'P-RAY: The Game', 'game title config mismatch');

assert(HERO_DEFS.elliot.abilityKey === 'Q', 'Elliot should use Q');
assert(HERO_DEFS.dick.name === 'Dick', 'Dick definition missing');
assert(HERO_DEFS.dick.abilityName === 'RAGE', 'Dick should own Rage');
assert(HERO_DEFS.dick.weaponType === 'dualClubs', 'Dick should use dual clubs');
assert(HERO_DEFS.habib.name === 'Habib', 'Habib definition missing');
assert(HERO_DEFS.habib.abilityName === 'CHAIN LTG', 'Habib should own Chain Lightning');
assert(HERO_DEFS.habib.weaponType === 'thrownClub', 'Habib should use thrown club');

assert(ENEMY_DEFS.raider.displayName === 'Worm Hatchling', 'raider display mapping mismatch');
assert(ENEMY_DEFS.mutant.specialEligible === true, 'mutant should be special eligible');
assert(ENEMY_DEFS.blinker.specialEligible === true, 'blinker should be special eligible');
assert(ENEMY_DEFS.miniboss.name === 'BROOD WARDEN', 'miniboss name mismatch');
assert(ENEMY_DEFS.bigboss.name === 'ELDER WORM', 'bigboss name mismatch');

assert(LOOT_DEFS.basicDropWeights.at(-1).threshold === 1.00, 'basic loot weights must end at 1.00');
assert(LOOT_DEFS.specialWeapons.includes('spray_gun'), 'spray gun special missing');
assert(LOOT_DEFS.specialWeapons.includes('samurai_sword'), 'samurai sword special missing');

assert(WAVE_DEFS.maxWave === 21, 'max wave should be 21');
assert(WAVE_DEFS.duration === 22, 'wave duration should be 22 seconds');
assert(WAVE_DEFS.bigbossEvery === 9, 'bigboss cadence mismatch');
assert(WAVE_DEFS.minibossEvery === 4, 'miniboss cadence mismatch');

console.log('game data checks passed');
