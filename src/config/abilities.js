import { G } from '../globals.js';
import { state } from '../state.js';
import { rand, dist2, clamp } from '../utils/math.js';
import { pushDamageNumber } from '../render/effects.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── ABILITY_DEFS ─────────────────────────────────────────────────────────────
// Each entry shape:
//   { icon, color, sound?, maxCd?, activate?(unit), passive?(unit) }
// Passive-only entries have no activate/maxCd.

export const ABILITY_DEFS = {

  // ── Base hero abilities ───────────────────────────────────────────────────

  group_blink: {
    icon:  'assets/icons/abilities/group_blink.svg',
    color: '#80c8ff',
    sound: 'ability.blink',
    maxCd: 9,
    activate(unit) {
      const mx = state.mouse.x, my = state.mouse.y;
      const dx = mx - unit.x, dy = my - unit.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) return false;
      const maxRange = 240;
      const step = Math.min(d, maxRange);
      const startX = unit.x, startY = unit.y;

      // Departure burst
      for (let i = 0; i < 14; i++) {
        state.particles.push({ x: unit.x, y: unit.y, vx: rand(-90, 90), vy: rand(-110, 60), life: rand(0.35, 0.7), maxLife: 0.7, color: '#80c8ff', size: rand(1.5, 3), realtime: true });
      }
      for (let i = 0; i < 10; i++) {
        state.particles.push({ x: unit.x, y: unit.y, vx: rand(-60, 60), vy: rand(-60, 60), life: rand(0.3, 0.55), maxLife: 0.55, color: 'rgba(180, 230, 255, 1)', size: rand(2, 4), realtime: true, additive: true });
      }

      const nx = clamp(unit.x + (dx / d) * step, 6, G.W - 6);
      const ny = clamp(unit.y + (dy / d) * step, 6, G.PLAY_BOTTOM);

      const steps = 16;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        state.particles.push({ x: unit.x + (nx - unit.x) * t + rand(-1.5, 1.5), y: unit.y + (ny - unit.y) * t + rand(-1.5, 1.5), vx: 0, vy: 0, life: 0.32, maxLife: 0.32, color: 'rgba(180, 230, 255, 1)', size: 3.5, realtime: true, additive: true });
      }

      unit.x = nx; unit.y = ny;
      unit.tx = nx; unit.ty = ny;
      unit.z = 0; unit.vz = 220;
      unit.blinkFlash = 1;

      for (let i = 0; i < 22; i++) {
        state.particles.push({ x: unit.x, y: unit.y, vx: rand(-130, 130), vy: rand(-130, 80), life: rand(0.35, 0.7), maxLife: 0.7, color: '#80c8ff', size: rand(1.5, 3), realtime: true });
      }
      for (let i = 0; i < 14; i++) {
        state.particles.push({ x: unit.x, y: unit.y, vx: rand(-80, 80), vy: rand(-80, 80), life: rand(0.3, 0.6), maxLife: 0.6, color: 'rgba(200, 240, 255, 1)', size: rand(2, 4), realtime: true, additive: true });
      }

      // Smokescreen passive: leave a smoke cloud at origin
      if (unit.smokescreen) {
        for (let i = 0; i < 20; i++) {
          state.particles.push({ x: startX + rand(-15, 15), y: startY + rand(-15, 15), vx: rand(-20, 20), vy: rand(-30, -5), life: rand(1.5, 3.0), maxLife: 3.0, color: `rgba(160,160,160,${rand(0.2, 0.5)})`, size: rand(8, 18), realtime: true });
        }
        // Mark smoke zone for enemy AI disruption
        state.smokeZones = state.smokeZones || [];
        state.smokeZones.push({ x: startX, y: startY, r: 40, life: 3.0, maxLife: 3.0 });
      }

      // Pull nearby allies (within 120px of starting position)
      const ALLY_RADIUS = 120;
      for (const ally of state.units) {
        if (ally === unit || ally.dead) continue;
        if (dist2(startX, startY, ally.x, ally.y) < ALLY_RADIUS) {
          const ang = rand(0, Math.PI * 2);
          const off = rand(10, 38);
          const ax = clamp(nx + Math.cos(ang) * off, 6, G.W - 6);
          const ay = clamp(ny + Math.sin(ang) * off, 6, G.PLAY_BOTTOM);
          ally.x = ax; ally.y = ay; ally.tx = ax; ally.ty = ay;
          ally.blinkFlash = 0.8;
          for (let i = 0; i < 8; i++) {
            state.particles.push({ x: ax, y: ay, vx: rand(-60, 60), vy: rand(-70, 30), life: rand(0.2, 0.45), maxLife: 0.45, color: '#80c8ff', size: rand(1, 2.5), realtime: true });
          }
        }
      }

      // Residual Haze passive: slow enemies at landing point
      if (unit.residualHaze) {
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (dist2(nx, ny, e.x, e.y) < 80) {
            e.stunTimer = Math.max(e.stunTimer, 2.0);
          }
        }
      }

      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.18); state.flashColor = '#a0d8ff'; }
      unit.abilityCd = unit.abilityMaxCd;
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 2);
      return true;
    },
  },

  boomerang: {
    icon:  'assets/icons/abilities/boomerang.svg',
    color: '#ff6040',
    sound: 'ability.boomerang',
    maxCd: 10,
    activate(unit) {
      if (unit.boomerang !== null) return false;
      // Find heaviest enemy within 300px
      let target = null, maxHp = -1;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const d = dist2(unit.x, unit.y, e.x, e.y);
        if (d < 300 && e.hp > maxHp) { maxHp = e.hp; target = e; }
      }
      if (!target) return false;
      unit.boomerang = {
        startX: unit.x, startY: unit.y,
        targetX: target.x, targetY: target.y,
        phase: 'outbound',
        t: 0,
        clubX: unit.x, clubY: unit.y,
        hitOut: new Set(),
        hitRet: new Set(),
      };
      // Cooldown is set when caught (in _boomerangPhaseEnd return phase end)
      return true;
    },
  },

  backdoor_blockade: {
    icon:  'assets/icons/abilities/backdoor_blockade.svg',
    color: '#c8a0ff',
    sound: 'ability.backdoor_blockade',
    maxCd: 14,
    activate(unit) {
      const radius = 150;
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) < radius) {
          ally.blockadeTimer = 6;
          for (let i = 0; i < 12; i++) {
            const a = rand(0, Math.PI * 2);
            const v = rand(40, 100);
            state.particles.push({ x: ally.x, y: ally.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: rand(0.3, 0.7), maxLife: 0.7, color: i % 2 ? '#c8d8ff' : '#a0b8e8', size: rand(1.5, 3), realtime: true });
          }
        }
      }
      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.15); state.flashColor = '#c0c8ff'; }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 3);
      unit.abilityCd = unit.abilityMaxCd;
      return true;
    },
  },

  // ── Eliott active upgrades ────────────────────────────────────────────────

  stoned_green_pipe: {
    icon:  'assets/icons/abilities/stoned_green_pipe.svg',
    color: '#40c840',
    sound: 'ability.stoned_green_pipe',
    maxCd: 25,
    activate(unit) {
      unit.stonedTimer = 4;
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 4);
      unit.tx = unit.x; unit.ty = unit.y; unit.aggroTarget = null;
      _radialParticles(unit.x, unit.y, 16, '#40c840', '#80ff80');
    },
  },

  green_pipe: {
    icon:  'assets/icons/abilities/green_pipe.svg',
    color: '#60c060',
    sound: 'ability.green_pipe',
    maxCd: 12,
    activate(unit) {
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
    icon:  'assets/icons/abilities/blue_cubes_rage.svg',
    color: '#4080ff',
    sound: 'ability.rage',
    maxCd: 14,
    activate(unit) {
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
    icon:  'assets/icons/abilities/blue_cubes_speed.svg',
    color: '#6060ff',
    sound: 'ability.blue_cubes_speed',
    maxCd: 16,
    activate(unit) {
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
    icon:  'assets/icons/abilities/white_powder_hit.svg',
    color: '#e8e0ff',
    sound: 'ability.white_powder_hit',
    maxCd: 18,
    activate(unit) {
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
    icon:  'assets/icons/abilities/white_powder_dominance.svg',
    color: '#c0a0ff',
    sound: 'ability.white_powder_dominance',
    maxCd: 22,
    activate(unit) {
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

  // ── Habib active upgrades ─────────────────────────────────────────────────

  chain_lightning: {
    icon:  'assets/icons/abilities/chain_lightning.svg',
    color: '#a0e0ff',
    sound: 'ability.lightning',
    maxCd: 8,
    activate(unit) {
      const maxRange = 200;
      // Don't activate if no enemies in range
      const hasTarget = state.enemies.some(e => !e.dead && dist2(unit.x, unit.y, e.x, e.y) < maxRange);
      if (!hasTarget) return false;
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
    icon:  'assets/icons/abilities/flamethrower.svg',
    color: '#ff6020',
    sound: 'ability.flamethrower',
    maxCd: 20,
    activate(unit) {
      unit.flamethrowerTimer = 6;
      _radialParticles(unit.x, unit.y, 14, '#ff6020', '#ffb040');
    },
  },

  acid_gun: {
    icon:  'assets/icons/abilities/acid_gun.svg',
    color: '#60ff40',
    sound: 'ability.acid_gun',
    maxCd: 14,
    activate(unit) {
      unit.acidGunTimer = 5;
      unit.acidGunFireCd = 0;
      _radialParticles(unit.x, unit.y, 12, '#40ff40', '#80ff80');
    },
  },

  // ── Dick active upgrades ──────────────────────────────────────────────────

  inappropriate_stories: {
    icon:  'assets/icons/abilities/inappropriate_stories.svg',
    color: '#ff8030',
    sound: 'ability.inappropriate_stories',
    maxCd: 16,
    activate(unit) {
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
    icon:  'assets/icons/abilities/scream.svg',
    color: '#ff4040',
    sound: 'ability.scream',
    maxCd: 14,
    activate(unit) {
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
    icon:  'assets/icons/abilities/mill_360.svg',
    color: '#ff8020',
    sound: 'ability.mill_360',
    maxCd: 10,
    activate(unit) {
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 2.2);
      unit.millTimer = 2.2;
      unit.millAngle = unit.facing;
      unit.millCenterX = unit.x;
      unit.millCenterY = unit.y;
      unit._millTargetX = unit.tx;
      unit._millTargetY = unit.ty;
      _radialParticles(unit.x, unit.y, 22, '#ff8020', '#ffd060');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 8);
    },
  },

  vortex: {
    icon:  'assets/icons/abilities/vortex.svg',
    color: '#ff6010',
    sound: 'ability.vortex',
    maxCd: 12,
    activate(unit) {
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 2.8);
      unit.vortexTimer = 2.8;
      unit.vortexAngle = unit.facing;
      unit.vortexCenterX = unit.x;
      unit.vortexCenterY = unit.y;
      unit._vortexTargetX = unit.tx;
      unit._vortexTargetY = unit.ty;
      _radialParticles(unit.x, unit.y, 30, '#ff6010', '#ffe050');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 10);
    },
  },

  smashing_time: {
    icon:  'assets/icons/abilities/smashing_time.svg',
    color: '#ff3010',
    sound: 'ability.smashing_time',
    maxCd: 20,
    activate(unit) {
      // Find highest-HP enemy within 350px
      let target = null, maxHp = -1;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(unit.x, unit.y, e.x, e.y) < 350 && e.hp > maxHp) { maxHp = e.hp; target = e; }
      }
      if (!target) return false;
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

  // ── Passive-only entries (icon/color only) ────────────────────────────────

  residual_haze: {
    icon:  'assets/icons/abilities/residual_haze.svg',
    color: '#80c8a0',
  },

  extended_formula: {
    icon:  'assets/icons/abilities/extended_formula.svg',
    color: '#60d0a0',
  },

  quick_brew: {
    icon:  'assets/icons/abilities/quick_brew.svg',
    color: '#a0e060',
  },

  smokescreen: {
    icon:  'assets/icons/abilities/smokescreen.svg',
    color: '#a0a0c0',
    sound: 'ability.smokescreen',
  },

  iron_knuckles: {
    icon:  'assets/icons/abilities/iron_knuckles.svg',
    color: '#c0b080',
  },

  thunderfoot: {
    icon:  'assets/icons/abilities/thunderfoot.svg',
    color: '#ffd040',
  },

  hard_cap: {
    icon:  'assets/icons/abilities/hard_cap.svg',
    color: '#a08060',
  },

  thick_skull: {
    icon:  'assets/icons/abilities/thick_skull.svg',
    color: '#d0b0a0',
  },

  battle_rhythm: {
    icon:  'assets/icons/abilities/battle_rhythm.svg',
    color: '#ff6060',
  },

  backdoor_armor_fire: {
    icon:  'assets/icons/abilities/backdoor_armor_fire.svg',
    color: '#ff8040',
  },

  backdoor_armor_lightning: {
    icon:  'assets/icons/abilities/backdoor_armor_lightning.svg',
    color: '#a0d0ff',
  },

  backdoor_armor_spikes: {
    icon:  'assets/icons/abilities/backdoor_armor_spikes.svg',
    color: '#c0a060',
  },

  dense_plating: {
    icon:  'assets/icons/abilities/dense_plating.svg',
    color: '#909090',
  },

  reinforced_frame: {
    icon:  'assets/icons/abilities/reinforced_frame.svg',
    color: '#a0b0c0',
  },

  engineers_efficiency: {
    icon:  'assets/icons/abilities/engineers_efficiency.svg',
    color: '#d0c060',
  },

  weighted_swing: {
    icon:  'assets/icons/abilities/weighted_swing.svg',
    color: '#c06040',
  },

  blue_cubes_rage_passive: {
    icon:  'assets/icons/abilities/blue_cubes_rage.svg',
    color: '#4080ff',
  },

};
