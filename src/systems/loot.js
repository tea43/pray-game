import { rand, randInt, dist2 } from '../utils/math.js';
import { state } from '../state.js';
import { DIFFICULTY_DEFS } from '../config/difficulty.js';
import { LOOT_DEFS } from '../config/loot.js';
import { WEAPON_DEFS } from '../config/weapons.js';
import { playSfx } from './audio.js';
import { ABILITY_XP_CONFIG } from '../config/abilities.js';

export function applyLoot(loot, unit) {
  const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
  if (loot.type === 'medkit' || loot.type === 'rare_medkit') {
    playSfx('loot.medkit');
    const isRare = loot.type === 'rare_medkit';
    const totalHeal = isRare ? Math.round(diff.loot.healAmount * 1.8) : diff.loot.healAmount;
    const duration  = isRare ? 5 : 4;
    unit.medkitHealRemaining = Math.min(unit.maxHp - unit.hp, totalHeal);
    unit.medkitHealPerSec    = totalHeal / duration;
    const particleColor = isRare ? '#60b0ff' : '#5fd06a';
    const particleColor2 = isRare ? '#a0d8ff' : '#ffffff';
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(20, 90);
      state.particles.push({
        x: loot.x, y: loot.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: rand(0.4, 0.9), maxLife: 0.9,
        color: i % 3 === 0 ? particleColor2 : particleColor,
        size: rand(1.5, 3), realtime: true,
      });
    }
    state.moveMarkers.push({ x: unit.x, y: unit.y - 18, life: 0.9, maxLife: 0.9, type: 'heal', text: '+' + totalHeal });
  } else if (loot.type === 'stimpack') {
    playSfx('loot.stimpack');
    unit.rageTimer = Math.max(unit.rageTimer, diff.loot.stimDuration);
    unit.abilityCd = Math.max(unit.abilityCd - 2, 0);
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(30, 120);
      state.particles.push({
        x: loot.x, y: loot.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80,
        life: rand(0.4, 1.0), maxLife: 1.0,
        color: i % 2 === 0 ? '#ff6040' : '#ffb070',
        size: rand(1.5, 3), realtime: true,
      });
    }
    if (!state.settings.noShake) state.shake = Math.max(state.shake, 4);
    state.moveMarkers.push({ x: unit.x, y: unit.y - 18, life: 0.9, maxLife: 0.9, type: 'stim', text: 'RAGE' });
  } else if (loot.type === 'bomb') {
    detonateBomb(loot.x, loot.y);
  } else if (WEAPON_DEFS[loot.type]) {
    _weaponPickupBonus(unit, loot.type, loot.x, loot.y);
  } else if (loot.type === 'banana_bomb') {
    detonateBananaBomb(loot.x, loot.y);
  } else if (loot.type === 'essence') {
    playSfx('loot.essence', { volume: 0.3 });
    state.moveMarkers.push({ x: unit.x, y: unit.y - 18, life: 0.9, maxLife: 0.9, type: 'xp', text: '+1' });
    _gainAbilityXp(LOOT_DEFS.essence.xpPerPickup);
  }
}

function _levelUp(heroType) {
  state.xp -= state.xpToNext;
  state.level += 1;
  state._levelUpFlash = 0.9;
  state.pendingLevelUps = (state.pendingLevelUps || 0) + 1;
  if (!state.pendingWeaponUpgrades) state.pendingWeaponUpgrades = [];
  state.pendingWeaponUpgrades.push(heroType || 'eliott');
  playSfx('ui.levelup');
}

function _allAbilitiesMaxed() {
  return state.units?.every(u => [1, 2, 3].every(t => (u.abilityTrees?.[t] ?? 0) >= 3));
}

function _gainAbilityXp(amount) {
  if (_allAbilitiesMaxed()) {
    state.essenceSurplus = (state.essenceSurplus || 0) + amount;
    return;
  }
  state.abilityXp = (state.abilityXp || 0) + amount;
  while (state.abilityXp >= state.abilityXpThreshold) {
    state.abilityXp -= state.abilityXpThreshold;
    state.abilityXpThreshold = ABILITY_XP_CONFIG.A * state.abilityXpThreshold + ABILITY_XP_CONFIG.B;
    state.abilityXpPicks = (state.abilityXpPicks || 0) + 1;
    state.pendingAbilityPicks = (state.pendingAbilityPicks || 0) + 1;
  }
}

// Weapon loot on the ground now grants an immediate weapon upgrade for the picking hero.
function _weaponPickupBonus(unit, weaponKey, lootX, lootY) {
  const wDef = WEAPON_DEFS[weaponKey];
  const xpBonus = 10;
  playSfx(`loot.weapon.${weaponKey}`);

  state.xp += xpBonus;
  while (state.xp >= state.xpToNext) { _levelUp(unit.type); }

  const isRanged = wDef?.type === 'ranged';
  const color1   = isRanged ? '#ffa040' : '#e8e060';
  const color2   = isRanged ? '#ffe080' : '#ffffff';
  for (let i = 0; i < 22; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(30, 120);
    state.particles.push({ x: lootX, y: lootY, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 70, life: rand(0.3, 0.9), maxLife: 0.9, color: i % 2 === 0 ? color1 : color2, size: rand(1.5, 3), realtime: true });
  }
  if (!state.settings.noShake) state.shake = Math.max(state.shake, 3);
  state.moveMarkers.push({ x: unit.x, y: unit.y - 18, life: 1.1, maxLife: 1.1, type: 'xp', text: `+${xpBonus} XP` });
}

export function detonateBomb(x, y) {
  playSfx('explosion.bomb');
  const radius = 280;
  const maxDmg = LOOT_DEFS.bombDamage ?? 150;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < radius) {
      const falloff = 1 - d / radius;
      const ang = Math.atan2(e.y - y, e.x - x);
      e.knockX += Math.cos(ang) * falloff * 380;
      e.knockY += Math.sin(ang) * falloff * 380;
      e.hp -= maxDmg * falloff;
      e.hurtFlash = 1;
      if (e.hp <= 0) e._die();
    }
  }
  // Fire debris — darker palette, no additive glow.
  const palette = ['#c84020', '#a03020', '#7a4030', '#5a2010', '#3a2515'];
  for (let i = 0; i < 50; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(60, 280);
    state.particles.push({
      x: x + rand(-4, 4), y: y + rand(-4, 4),
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - rand(30, 100),
      life: rand(0.4, 1.0), maxLife: 1.0,
      color: palette[randInt(0, palette.length - 1)],
      size: rand(2, 4), realtime: true,
    });
  }
  // Smoke.
  for (let i = 0; i < 20; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(20, 60);
    state.particles.push({
      x: x + rand(-8, 8), y: y + rand(-8, 8),
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
      life: rand(0.8, 1.4), maxLife: 1.4,
      color: '#5a5045',
      size: rand(2.5, 5), realtime: true,
    });
  }
  state.explosions.push({ x, y, r: 8, maxR: radius, life: 0.55, maxLife: 0.55 });
  if (!state.settings.noShake) state.shake = Math.max(state.shake, 7);
}

export function detonateBananaBomb(x, y) {
  playSfx('explosion.banana-bomb');
  const radius = 420;
  const maxDmg = LOOT_DEFS.bananaBombDamage ?? 300;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < radius) {
      const falloff = 1 - d / radius;
      const ang = Math.atan2(e.y - y, e.x - x);
      e.knockX += Math.cos(ang) * falloff * 500;
      e.knockY += Math.sin(ang) * falloff * 500;
      e.hp -= maxDmg * falloff;
      e.hurtFlash = 1;
      if (e.hp <= 0) e._die();
      e.stunTimer = Math.max(e.stunTimer || 0, 2.5);
    }
  }
  // Debris — muted greens and darks, no additive glow.
  const bPalette = ['#6a8030', '#4a6020', '#3a5018', '#5a4030', '#3a2515'];
  for (let i = 0; i < 70; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(80, 360);
    state.particles.push({
      x: x + rand(-6, 6), y: y + rand(-6, 6),
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - rand(50, 130),
      life: rand(0.5, 1.2), maxLife: 1.2,
      color: bPalette[randInt(0, bPalette.length - 1)],
      size: rand(2, 4.5), realtime: true,
    });
  }
  // Smoke.
  for (let i = 0; i < 30; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(20, 70);
    state.particles.push({
      x: x + rand(-10, 10), y: y + rand(-10, 10),
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
      life: rand(0.9, 1.6), maxLife: 1.6,
      color: '#7a7050',
      size: rand(3, 6), realtime: true,
    });
  }
  state.explosions.push({ x, y, r: 10, maxR: radius, life: 0.7, maxLife: 0.7 });
  if (!state.settings.noShake) state.shake = Math.max(state.shake, 11);
}
