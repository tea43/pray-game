import { G } from '../globals.js';
import { state } from '../state.js';
import { rand, dist2, clamp } from '../utils/math.js';
import { playSfx } from './audio.js';
import { pushDamageNumber } from '../render/effects.js';

// Each entry: { maxCd, activate(unit), passive?(unit) }
// passive() is called each wave by applyWaveUpgrades if the skill is in a slot.

export const ACTIVE_SKILL_DEFS = {

  // ── Eliott active upgrades ─────────────────────────────────────────────────

  stoned_green_pipe: {
    maxCd: 25,
    activate(unit) {
      playSfx('ability_blink');
      unit.stonedTimer = 4;
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 4);
      _radialParticles(unit.x, unit.y, 16, '#40c840', '#80ff80');
    },
  },

  green_pipe: {
    maxCd: 12,
    activate(unit) {
      playSfx('ability_blink');
      const radius = _alchemyRadius(unit, 150);
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) < radius) {
          ally.alchemyArmorTimer = Math.max(ally.alchemyArmorTimer || 0, 5);
          _radialParticles(ally.x, ally.y, 8, '#40ff40', '#80ff80');
        }
      }
    },
  },

  blue_cubes_rage: {
    maxCd: 14,
    activate(unit) {
      playSfx('ability_rage');
      const radius = _alchemyRadius(unit, 150);
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) < radius) {
          ally.rageTimer = Math.max(ally.rageTimer || 0, 4);
          ally.alchemyRageMult = 1.3; // extra +30% atk speed beyond base rage
          _radialParticles(ally.x, ally.y, 10, '#4080ff', '#80a0ff');
        }
      }
    },
  },

  blue_cubes_speed: {
    maxCd: 16,
    activate(unit) {
      playSfx('ability_blink');
      const radius = _alchemyRadius(unit, 150);
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) < radius) {
          ally.speedBoostTimer = Math.max(ally.speedBoostTimer || 0, 5);
          _radialParticles(ally.x, ally.y, 8, '#6060ff', '#a0a0ff');
        }
      }
    },
  },

  white_powder_hit: {
    maxCd: 18,
    activate(unit) {
      playSfx('ability_blink');
      const radius = _alchemyRadius(unit, 150);
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) > radius) continue;
        let nearest = null, nd = Infinity;
        for (const e of state.enemies) {
          if (e.dead) continue;
          const d = dist2(ally.x, ally.y, e.x, e.y);
          if (d < nd) { nd = d; nearest = e; }
        }
        if (!nearest) continue;
        const ang = nearest.facing + Math.PI;
        const bx = clamp(nearest.x + Math.cos(ang) * 30, 6, G.W - 6);
        const by = clamp(nearest.y + Math.sin(ang) * 30, 6, G.PLAY_BOTTOM);
        const origX = ally.x, origY = ally.y;
        ally.x = bx; ally.y = by; ally.tx = bx; ally.ty = by;
        ally.blinkFlash = 1;
        ally.immortalTimer = Math.max(ally.immortalTimer || 0, 0.6);
        const dmg = Math.round(ally.atkDmg * 1.5 * (ally.upgradeDmgMult || 1));
        nearest.hp -= dmg;
        nearest.hurtFlash = 1;
        pushDamageNumber(nearest.x, nearest.y - nearest.r - 4, dmg, { crit: true, rgb: [240, 220, 100] });
        // teleport back after 0.3s
        ally._wpHitReturn = { timer: 0.3, x: origX, y: origY };
        _radialParticles(bx, by, 8, '#ffffff', '#ffe0ff');
      }
    },
  },

  white_powder_dominance: {
    maxCd: 22,
    activate(unit) {
      playSfx('ability_blink');
      const radius = _alchemyRadius(unit, 150);
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) > radius) continue;
        ally.immortalTimer = Math.max(ally.immortalTimer || 0, 2.5);
        // Queue sequential blink-strikes
        const targets = state.enemies.filter(e => !e.dead && dist2(ally.x, ally.y, e.x, e.y) < 200);
        if (targets.length === 0) continue;
        ally._dominanceOrigin = { x: ally.x, y: ally.y };
        ally._dominanceTargets = [...targets];
        ally._dominanceTimer = 0;
        _radialParticles(ally.x, ally.y, 12, '#ffffff', '#e0c0ff');
      }
    },
  },

  // ── Habib active upgrades ──────────────────────────────────────────────────

  chain_lightning: {
    maxCd: 8,
    activate(unit) {
      const maxRange = 200;
      // Don't activate if no enemies in range
      const hasTarget = state.enemies.some(e => !e.dead && dist2(unit.x, unit.y, e.x, e.y) < maxRange);
      if (!hasTarget) return false;
      playSfx('ability_lightning');
      const chains = 5;
      let cx = unit.x, cy = unit.y;
      const hit = new Set();
      const points = [{ x: cx, y: cy }];
      for (let i = 0; i < chains; i++) {
        let nearest = null, nd = maxRange;
        for (const e of state.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = dist2(cx, cy, e.x, e.y);
          if (d < nd) { nd = d; nearest = e; }
        }
        if (!nearest) break;
        hit.add(nearest);
        points.push({ x: nearest.x, y: nearest.y });
        const dmg = Math.round(28 * (unit.chainMult || 1));
        nearest.hp -= dmg;
        nearest.stunTimer = Math.max(nearest.stunTimer, 1.5);
        nearest.hurtFlash = 1;
        nearest.knockX += rand(-30, 30);
        nearest.knockY += rand(-30, 30);
        for (let j = 0; j < 10; j++) {
          state.particles.push({ x: nearest.x, y: nearest.y, vx: rand(-100, 100), vy: rand(-120, -20), life: rand(0.3, 0.7), maxLife: 0.7, color: j % 2 ? '#a0e0ff' : '#e0f0ff', size: rand(1.2, 2.5), realtime: true });
        }
        pushDamageNumber(nearest.x, nearest.y - nearest.r - 4, dmg, { rgb: [180, 230, 255] });
        cx = nearest.x; cy = nearest.y;
      }
      if (points.length > 1) {
        state.bolts.push({ points, life: 0.4, maxLife: 0.4 });
        if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.2); state.flashColor = '#a0d8ff'; }
        if (!state.settings.noShake) state.hitStop = Math.max(state.hitStop, 0.04);
      }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 5);
    },
  },

  flamethrower: {
    maxCd: 20,
    activate(unit) {
      playSfx('ability_rage');
      unit.flamethrowerTimer = 6;
      _radialParticles(unit.x, unit.y, 14, '#ff6020', '#ffb040');
    },
  },

  acid_gun: {
    maxCd: 14,
    activate(unit) {
      playSfx('ability_rage');
      unit.acidGunTimer = 5;
      unit.acidGunFireCd = 0;
      _radialParticles(unit.x, unit.y, 12, '#40ff40', '#80ff80');
    },
  },

  // ── Dick active upgrades ───────────────────────────────────────────────────

  inappropriate_stories: {
    maxCd: 16,
    activate(unit) {
      playSfx('ability_rage');
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) < 250) {
          ally.speedBoostTimer = Math.max(ally.speedBoostTimer || 0, 6);
          ally.storiesRateBoost = Math.max(ally.storiesRateBoost || 0, 6); // +30% atk speed
        }
      }
      // Stun nearby enemies
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(unit.x, unit.y, e.x, e.y) < 250) {
          e.stunTimer = Math.max(e.stunTimer, 1.5);
          e.hurtFlash = 0.5;
        }
      }
      _radialParticles(unit.x, unit.y, 18, '#ff8030', '#ffcc80');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 3);
    },
  },

  scream: {
    maxCd: 14,
    activate(unit) {
      playSfx('ability_rage');
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(unit.x, unit.y, e.x, e.y) < 250) {
          e.stunTimer = Math.max(e.stunTimer, 2.5);
          e.hurtFlash = 0.6;
          const ang = Math.atan2(e.y - unit.y, e.x - unit.x);
          e.knockX += Math.cos(ang) * 80;
          e.knockY += Math.sin(ang) * 80;
        }
      }
      _radialParticles(unit.x, unit.y, 24, '#ff4040', '#ff8080');
      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.25); state.flashColor = '#ff6040'; }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 7);
    },
  },

  mill_360: {
    maxCd: 10,
    activate(unit) {
      playSfx('ability_rage');
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 2.2);
      unit.millTimer = 2.2;
      unit.millAngle = unit.facing;
      unit.millCenterX = unit.x;
      unit.millCenterY = unit.y;
      _radialParticles(unit.x, unit.y, 22, '#ff8020', '#ffd060');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 8);
    },
  },

  vortex: {
    maxCd: 12,
    activate(unit) {
      playSfx('ability_rage');
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 2.8);
      unit.vortexTimer = 2.8;
      unit.vortexAngle = unit.facing;
      unit.vortexCenterX = unit.x;
      unit.vortexCenterY = unit.y;
      _radialParticles(unit.x, unit.y, 30, '#ff6010', '#ffe050');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 10);
    },
  },

  smashing_time: {
    maxCd: 20,
    activate(unit) {
      // Find highest-HP enemy within 350px
      let target = null, maxHp = -1;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(unit.x, unit.y, e.x, e.y) < 350 && e.hp > maxHp) { maxHp = e.hp; target = e; }
      }
      if (!target) return;
      playSfx('ability_rage');
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 0.5);
      unit.x = clamp(target.x + rand(-20, 20), 6, G.W - 6);
      unit.y = clamp(target.y + rand(-20, 20), 6, G.PLAY_BOTTOM);
      unit.tx = unit.x; unit.ty = unit.y;
      unit.blinkFlash = 1;
      const dmg = Math.min(500, target.hp);
      target.hp -= dmg;
      target.hurtFlash = 1;
      const ang = Math.atan2(target.y - unit.y, target.x - unit.x);
      target.knockX += Math.cos(ang) * 300;
      target.knockY += Math.sin(ang) * 300;
      pushDamageNumber(target.x, target.y - target.r - 4, dmg, { crit: true, rgb: [255, 80, 20] });
      _radialParticles(unit.x, unit.y, 28, '#ff3010', '#ffb030');
      if (!state.settings.noShake) { state.shake = Math.max(state.shake, 12); state.hitStop = Math.max(state.hitStop, 0.06); }
    },
  },

};

// ── Helpers ─────────────────────────────────────────────────────────────────

function _alchemyRadius(unit, base) {
  return unit.extendedFormula ? base * 1.3 : base;
}

function _radialParticles(x, y, n, col1, col2) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(60, 140);
    state.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
      life: rand(0.3, 0.7), maxLife: 0.7,
      color: i % 2 ? col1 : col2,
      size: rand(1.5, 3), realtime: true,
    });
  }
}
