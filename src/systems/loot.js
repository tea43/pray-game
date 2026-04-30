import { rand, randInt, dist2 } from '../utils/math.js';
import { state } from '../state.js';
import { DIFFICULTY_DEFS } from '../config/difficulty.js';
import { playSfx } from './audio.js';

export function applyLoot(loot, unit) {
  playSfx('loot');
  const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
  if (loot.type === 'medkit') {
    const heal = diff.loot.healAmount;
    const before = unit.hp;
    unit.hp = Math.min(unit.maxHp, unit.hp + heal);
    const actual = unit.hp - before;
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(20, 90);
      state.particles.push({
        x: loot.x, y: loot.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: rand(0.4, 0.9), maxLife: 0.9,
        color: i % 3 === 0 ? '#ffffff' : '#5fd06a',
        size: rand(1.5, 3), realtime: true,
      });
    }
    state.moveMarkers.push({ x: unit.x, y: unit.y - 18, life: 0.9, maxLife: 0.9, type: 'heal', text: '+' + actual });
  } else if (loot.type === 'stimpack') {
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
  } else if (loot.type === 'spray_gun') {
    unit.activeWeapon = 'spray_gun';
    unit.activeWeaponTimer = 15;
    for (let i = 0; i < 20; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(30, 110);
      state.particles.push({
        x: loot.x, y: loot.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: rand(0.3, 0.8), maxLife: 0.8,
        color: i % 2 === 0 ? '#ffa040' : '#ffe080',
        size: rand(1.5, 3), realtime: true,
      });
    }
    if (!state.settings.noShake) state.shake = Math.max(state.shake, 3);
    state.moveMarkers.push({ x: unit.x, y: unit.y - 18, life: 1.1, maxLife: 1.1, type: 'stim', text: 'SPRAY GUN!' });
  } else if (loot.type === 'samurai_sword') {
    unit.activeWeapon = 'samurai_sword';
    unit.activeWeaponTimer = 20;
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(30, 120);
      state.particles.push({
        x: loot.x, y: loot.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 70,
        life: rand(0.3, 0.9), maxLife: 0.9,
        color: i % 2 === 0 ? '#e8e060' : '#ffffff',
        size: rand(1.5, 3), realtime: true,
      });
    }
    if (!state.settings.noShake) state.shake = Math.max(state.shake, 4);
    state.moveMarkers.push({ x: unit.x, y: unit.y - 18, life: 1.1, maxLife: 1.1, type: 'stim', text: 'KATANA!' });
  } else if (loot.type === 'banana_bomb') {
    detonateBananaBomb(loot.x, loot.y);
  }
}

export function detonateBomb(x, y) {
  playSfx('explosion');
  const radius = 280;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < radius) {
      const ang = Math.atan2(e.y - y, e.x - x);
      const force = (1 - d / radius) * 380;
      e.knockX += Math.cos(ang) * force;
      e.knockY += Math.sin(ang) * force;
      e.hp = -999;
      e._die();
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
  playSfx('explosion');
  const radius = 420;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < radius) {
      const ang = Math.atan2(e.y - y, e.x - x);
      const force = (1 - d / radius) * 500;
      e.knockX += Math.cos(ang) * force;
      e.knockY += Math.sin(ang) * force;
      e.hp = -999;
      e._die();
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
