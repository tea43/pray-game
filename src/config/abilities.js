import { G } from '../globals.js';
import { state } from '../state.js';
import { rand, dist2, clamp } from '../utils/math.js';
import { isWalkable, nearestWalkable } from '../utils/terrain.js';
import { pushDamageNumber } from '../render/effects.js';
import { playSfx } from '../systems/audio.js';

// ── XP Configs ────────────────────────────────────────────────────────────────
// Threshold formula: next = A × prev + B (linear escalation when A=1)

export const ABILITY_XP_CONFIG = {
  startThreshold: 38,
  A: 1,
  B: 2,
};

export const WEAPON_XP_CONFIG = {
  startThreshold: 100,
  A: 5,
  B: 20,
};

// ── Global effect configs ─────────────────────────────────────────────────────
// All acid DoT effects share these values; override per-ability only when spec
// explicitly calls out a different duration (e.g. Lightning Chain slowDuration).

export const ACID_CONFIG = {
  initialDamage: 18,  // direct hit damage for acid slingshot projectiles
  dotDamage: 3,
  dotInterval: 0.5,
};

export const TINKERING_SLOW_CONFIG = {
  factor: 0.5,     // speed multiplier while slowed (0.5 = half speed)
  duration: 2.0,
};

// ── Revive Minigame config ─────────────────────────────────────────────────────

export const REVIVE_MINIGAME_CONFIG = {
  baseRounds: 3,
  roundsIncrement: 2,
  markerSpeed: 3.0,         // seconds for marker to cross the full bar
  zoneCount: 2,
  zoneWidthFraction: 0.18,  // dark zone width as fraction of bar width at wave 1
  zoneWidthDecayA: 0.97,    // multiplied by wave: width = fraction × A^wave
  zoneWidthDecayB: 0,       // flat subtraction per wave after multiplier
  zoneWidthMin: 0.06,       // floor — zones never shrink below this fraction
  reviveHpFraction: 0.33,
  failureMessages: [
    "Your hands weren't exactly steady for a heart massage.",
    "You broke three of his ribs. Was that a rescue or an attack?",
    "Did you just slap him in the face and call it medicine?",
    "CPR certification: revoked.",
    "He was already dead. You made it worse somehow.",
    "Field surgery with the confidence of a drunk mechanic.",
    "Next time try not to kneel on his neck.",
    "The worms outside are less dangerous than your first aid.",
    "He twitched. You panicked. He died again.",
    "Technically that counts as a second cause of death.",
  ],
};

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

// Core blink movement: teleport unit toward mouse, return {startX,startY,nx,ny}.
// Does NOT apply ally pull or post-blink effects — call site adds those.
function _performBlink(unit) {
  const mx = state.mouse.x + G.camera.x, my = state.mouse.y + G.camera.y;
  const dx = mx - unit.x, dy = my - unit.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) return null;
  const step = Math.min(d, 240);
  const startX = unit.x, startY = unit.y;

  for (let i = 0; i < 14; i++) {
    state.particles.push({ x: unit.x, y: unit.y, vx: rand(-90, 90), vy: rand(-110, 60), life: rand(0.35, 0.7), maxLife: 0.7, color: '#80c8ff', size: rand(1.5, 3), realtime: true });
  }
  for (let i = 0; i < 10; i++) {
    state.particles.push({ x: unit.x, y: unit.y, vx: rand(-60, 60), vy: rand(-60, 60), life: rand(0.3, 0.55), maxLife: 0.55, color: 'rgba(180,230,255,1)', size: rand(2, 4), realtime: true, additive: true });
  }

  const rawX = clamp(unit.x + (dx / d) * step, 6, G.WORLD_W - 6);
  const rawY = clamp(unit.y + (dy / d) * step, 6, G.WORLD_H - 6);
  const landed = isWalkable(rawX, rawY) ? { x: rawX, y: rawY } : nearestWalkable(rawX, rawY);
  const nx = landed.x, ny = landed.y;

  const steps = 16;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    state.particles.push({ x: unit.x + (nx - unit.x) * t + rand(-1.5, 1.5), y: unit.y + (ny - unit.y) * t + rand(-1.5, 1.5), vx: 0, vy: 0, life: 0.32, maxLife: 0.32, color: 'rgba(180,230,255,1)', size: 3.5, realtime: true, additive: true });
  }

  unit.x = nx; unit.y = ny; unit.tx = nx; unit.ty = ny;
  unit._lastBlinkDest = { x: nx, y: ny, _originX: startX, _originY: startY };
  unit.z = 0; unit.vz = 220; unit.blinkFlash = 1;

  for (let i = 0; i < 22; i++) {
    state.particles.push({ x: unit.x, y: unit.y, vx: rand(-130, 130), vy: rand(-130, 80), life: rand(0.35, 0.7), maxLife: 0.7, color: '#80c8ff', size: rand(1.5, 3), realtime: true });
  }
  for (let i = 0; i < 14; i++) {
    state.particles.push({ x: unit.x, y: unit.y, vx: rand(-80, 80), vy: rand(-80, 80), life: rand(0.3, 0.6), maxLife: 0.6, color: 'rgba(200,240,255,1)', size: rand(2, 4), realtime: true, additive: true });
  }
  return { startX, startY, nx, ny };
}

// ── Ability tree definitions per hero ────────────────────────────────────────
// Maps each hero to their 3 ability trees. treeNum matches unit.abilityTrees keys.
// levelNames[i] is the ability name at level i+1 (0-indexed).

export const HERO_ABILITY_TREES = {
  eliott: [
    {
      treeNum: 1, hotkey: '1',
      name: 'Blink',
      abilityId: 'group_blink',
      levelAbilityIds: ['blink_self', 'group_blink', 'vacuum_group_blink'],
      levelNames: ['Blink', 'Group Blink', 'Vacuum + Group Blink'],
      levelDescs: [
        'Eliott blinks up to 240px toward cursor.',
        'Pulls allies within 120px of starting position to destination.',
        'Draws all nearby heroes to Eliott first, then group-blinks to destination.',
      ],
    },
    {
      treeNum: 2, hotkey: 'Q',
      name: 'Green Pipe',
      abilityId: 'green_pipe',
      levelAbilityIds: ['green_pipe', 'stoned_green_pipe', 'overcharged_pipe'],
      levelNames: ['Green Pipe', 'Stoned Green Pipe', 'Overcharged Pipe'],
      levelDescs: [
        'Eliott and nearby allies gain damage reduction for a duration.',
        'Eliott freezes and becomes immortal, attracting enemies. Blinks back to ally on expiry.',
        'Stoned Pipe effect, then an acid explosion around Eliott before he blinks back.',
      ],
    },
    {
      treeNum: 3, hotkey: 'A',
      name: 'White Powder',
      abilityId: 'white_powder_hit',
      levelAbilityIds: ['white_powder_hit', 'white_powder_dominance', 'potato_starch'],
      levelNames: ['White Powder of Hit', 'White Powder of Dominance', 'Potato Starch'],
      levelDescs: [
        'Each ally blinks behind the nearest enemy and strikes.',
        'Each ally chains blink-strikes through all nearby enemies.',
        'Dominance effect, then all heroes blink as a group to Eliott\'s move destination.',
      ],
    },
  ],
  dick: [
    {
      treeNum: 1, hotkey: '2',
      name: 'Boomerang',
      abilityId: 'boomerang',
      levelAbilityIds: ['boomerang', 'ellipse_boomerang', 'dual_boomerangs'],
      levelNames: ['Standard Boomerang', 'Ellipse Boomerang', 'Dual Boomerangs'],
      levelDescs: [
        'Throws club in an arc at the heaviest nearby enemy.',
        'Boomerang arcs in a wider ellipse, hitting all enemies in the arc path.',
        'Two boomerangs launched simultaneously targeting the 2 most dangerous enemies.',
      ],
    },
    {
      treeNum: 2, hotkey: 'W',
      name: 'Spin Clubs',
      abilityId: 'mill_360',
      levelAbilityIds: ['mill_360', 'vortex', 'dance_of_death'],
      levelNames: ['Mill 360', 'Vortex', 'Dance of Death'],
      levelDescs: [
        'Dick\'s club spins in a circle, dealing continuous damage. Dick stays movable.',
        'Spin with a gentle pull: enemies near the circle perimeter are drawn toward it.',
        'Dick becomes immortal. Enemies are pulled into a black hole. Dick slams at the end.',
      ],
    },
    {
      treeNum: 3, hotkey: 'S',
      name: 'Scream',
      abilityId: 'scream',
      levelAbilityIds: ['scream', 'inappropriate_stories', 'transgender_talk'],
      levelNames: ['Scream', 'Inappropriate Stories', 'Transgender Talk'],
      levelDescs: [
        'Stuns all nearby enemies.',
        'Boosts hero speed and attack rate. Stuns nearby enemies.',
        'Same boost as Inappropriate Stories. Nearby enemies are continuously stunned.',
      ],
    },
  ],
  habib: [
    {
      treeNum: 1, hotkey: '3',
      name: 'Backdoor Blockade',
      abilityId: 'backdoor_blockade',
      levelAbilityIds: ['backdoor_blockade', 'stunned_backdoor_blockade', 'fire_backdoor_blockade'],
      levelNames: ['Backdoor Blockade', 'Stunned Backdoor', 'Fire Backdoor'],
      levelDescs: [
        'All heroes within radius take 50% reduced damage for a duration.',
        'Same reduction; enemies that strike a protected hero are stunned.',
        'Same reduction; enemies that strike a protected hero take fire damage and burn.',
      ],
    },
    {
      treeNum: 2, hotkey: 'E',
      name: 'Tinkering',
      abilityId: 'acid_gun',
      levelAbilityIds: ['acid_slingshot', 'flamethrower', 'lightning_chain_tinkering'],
      levelNames: ['Acid Slingshot', 'Flamethrower', 'Lightning Chain'],
      levelDescs: [
        'Habib fires a burst of acid projectiles. Each hit slows and applies acid DoT.',
        'Cone fire blast. Enemies hit take damage, are slowed, and burn.',
        'Lightning chains through multiple enemies. Each hit slows.',
      ],
    },
    {
      treeNum: 3, hotkey: 'D',
      name: 'Weapon Effects',
      abilityId: 'weapon_effects',
      levelAbilityIds: ['weapon_effects_flame', 'weapon_effects_stun', 'weapon_effects_lightning'],
      levelNames: ['Flame Weapons', 'Stun Weapons', 'Chain Lightning Weapons'],
      levelDescs: [
        'All heroes\' weapons gain a chance to apply flame on hit for a timed window.',
        'All heroes\' weapons gain a chance to stun on hit for a timed window.',
        'All heroes\' weapons gain a chance to chain lightning on hit for a timed window.',
      ],
    },
  ],
};

// ── ABILITY_DEFS ─────────────────────────────────────────────────────────────
// Each entry shape:
//   { icon, color, sound?, maxCd?, activate?(unit), passive?(unit) }
// Passive-only entries have no activate/maxCd.

export const ABILITY_DEFS = {

  // ── Base hero abilities ───────────────────────────────────────────────────

  // ── Eliott Tree 1 — Blink levels ─────────────────────────────────────────

  blink_self: {
    icon:  'assets/icons/abilities/group_blink.svg',
    color: '#80c8ff',
    sound: 'ability.blink',
    maxCd: 9,
    activate(unit) {
      const blink = _performBlink(unit);
      if (!blink) return false;
      const { startX, startY } = blink;
      if (unit.smokescreen) {
        for (let i = 0; i < 20; i++) {
          state.particles.push({ x: startX + rand(-15, 15), y: startY + rand(-15, 15), vx: rand(-20, 20), vy: rand(-30, -5), life: rand(1.5, 3.0), maxLife: 3.0, color: `rgba(160,160,160,${rand(0.2, 0.5)})`, size: rand(8, 18), realtime: true });
        }
        state.smokeZones = state.smokeZones || [];
        state.smokeZones.push({ x: startX, y: startY, r: 40, life: 3.0, maxLife: 3.0 });
      }
      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.18); state.flashColor = '#a0d8ff'; }
      unit.abilityCd = unit.abilityMaxCd;
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 2);
      return true;
    },
  },

  group_blink: {
    icon:  'assets/icons/abilities/group_blink.svg',
    color: '#80c8ff',
    sound: 'ability.blink',
    maxCd: 9,
    activate(unit) {
      const blink = _performBlink(unit);
      if (!blink) return false;
      const { startX, startY, nx, ny } = blink;

      if (unit.smokescreen) {
        for (let i = 0; i < 20; i++) {
          state.particles.push({ x: startX + rand(-15, 15), y: startY + rand(-15, 15), vx: rand(-20, 20), vy: rand(-30, -5), life: rand(1.5, 3.0), maxLife: 3.0, color: `rgba(160,160,160,${rand(0.2, 0.5)})`, size: rand(8, 18), realtime: true });
        }
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
          const rawAx = clamp(nx + Math.cos(ang) * off, 6, G.WORLD_W - 6);
          const rawAy = clamp(ny + Math.sin(ang) * off, 6, G.WORLD_H - 6);
          const landedA = isWalkable(rawAx, rawAy) ? { x: rawAx, y: rawAy } : nearestWalkable(rawAx, rawAy);
          const ax = landedA.x, ay = landedA.y;
          ally.x = ax; ally.y = ay; ally.tx = ax; ally.ty = ay;
          ally.blinkFlash = 0.8;
          for (let i = 0; i < 8; i++) {
            state.particles.push({ x: ax, y: ay, vx: rand(-60, 60), vy: rand(-70, 30), life: rand(0.2, 0.45), maxLife: 0.45, color: '#80c8ff', size: rand(1, 2.5), realtime: true });
          }
        }
      }

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

  vacuum_group_blink: {
    icon:  'assets/icons/abilities/group_blink.svg',
    color: '#60b0ff',
    sound: 'ability.blink',
    maxCd: 11,
    activate(unit) {
      // Step 1: vacuum — pull all alive allies within vacuumRadius to Eliott's current position
      const vacuumRadius = 200;
      for (const ally of state.units) {
        if (ally === unit || ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) < vacuumRadius) {
          const ang = rand(0, Math.PI * 2);
          const off = rand(8, 22);
          const ax = clamp(unit.x + Math.cos(ang) * off, 6, G.WORLD_W - 6);
          const ay = clamp(unit.y + Math.sin(ang) * off, 6, G.WORLD_H - 6);
          ally.x = ax; ally.y = ay; ally.tx = ax; ally.ty = ay;
          ally.blinkFlash = 0.5;
          for (let i = 0; i < 6; i++) {
            state.particles.push({ x: ax, y: ay, vx: rand(-40, 40), vy: rand(-50, 20), life: rand(0.2, 0.4), maxLife: 0.4, color: '#60b0ff', size: rand(1, 2), realtime: true });
          }
        }
      }
      // Step 2: group blink (reuses existing L2 activate, skipping smokescreen and residualHaze duplicate)
      return ABILITY_DEFS.group_blink.activate(unit);
    },
  },

  // ── Eliott Tree 2 — Green Pipe L3 ─────────────────────────────────────────

  overcharged_pipe: {
    icon:  'assets/icons/abilities/stoned_green_pipe.svg',
    color: '#20e860',
    sound: 'ability.stoned_green_pipe',
    maxCd: 28,
    activate(unit) {
      unit.stonedTimer = 4;
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 4);
      unit.tx = unit.x; unit.ty = unit.y; unit.aggroTarget = null;
      unit.stonedAcidExplosion = true;
      _radialParticles(unit.x, unit.y, 20, '#20e860', '#40ff80');
    },
  },

  // ── Eliott Tree 3 — White Powder L3 ───────────────────────────────────────

  potato_starch: {
    icon:  'assets/icons/abilities/white_powder_dominance.svg',
    color: '#d0b0ff',
    sound: 'ability.white_powder_dominance',
    maxCd: 25,
    activate(unit) {
      // Same as white_powder_dominance but mark unit for group blink after chain completes
      const result = ABILITY_DEFS.white_powder_dominance.activate(unit);
      if (result !== false) unit._dominanceGroupBlink = true;
      return result;
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
    // SOUND POINT 1 — ACTIVATION (sniff / intake hit).
    // This key is played automatically by Unit.cast() / Unit.activateSkill()
    // immediately when the player presses the ability key, before any teleport.
    // To change it: edit the string below and add the file to the audio manifest.
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
        const bx = clamp(nearest.x + Math.cos(ang) * 30, 6, G.WORLD_W - 6);
        const by = clamp(nearest.y + Math.sin(ang) * 30, 6, G.WORLD_H);
        const origX = ally.x, origY = ally.y;
        ally.x = bx; ally.y = by; ally.tx = bx; ally.ty = by;
        ally.blinkFlash = 1;
        ally.immortalTimer = Math.max(ally.immortalTimer || 0, 0.6);
        // SOUND POINT 2 — BLINK-IN: reuses Eliott's blink whoosh.
        playSfx('ability.blink');
        const dmg = Math.round(ally.atkDmg * 1.5 * (ally.upgradeDmgMult || 1));
        nearest.hp -= dmg;
        nearest.hurtFlash = 1;
        // SOUND POINT 3 — IMPACT: ally's current weapon attack + alien hit.
        playSfx(ally._wDef.sfxAttack || 'weapon.attack.default', { fallback: ally._wDef.sfxFallback || 'weapon.attack.default', synthetic: 'hit' });
        playSfx('alien.hit.default', { synthetic: 'hit' });
        pushDamageNumber(nearest.x, nearest.y - nearest.r - 4, dmg, { crit: true, rgb: [240, 220, 100] });
        // teleport back after 0.3s — return blink is handled in Unit.update()
        // SOUND POINT 4 — BLINK-OUT (return teleport, 0.3 s later).
        // Handled in Unit.js where _wpHitReturn timer expires — see comment there.
        ally._wpHitReturn = { timer: 0.3, x: origX, y: origY };
        _radialParticles(bx, by, 8, '#ffffff', '#ffe0ff');
      }
    },
  },

  white_powder_dominance: {
    icon:  'assets/icons/abilities/white_powder_dominance.svg',
    color: '#c0a0ff',
    // SOUND POINT 1 — ACTIVATION (intense sniff / surge).
    // Same mechanism as white_powder_hit — played once on key press by Unit.cast().
    // To change: edit the string below and add the file to the audio manifest.
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
        // SOUND POINT 2 — CHAIN START: blink whoosh once per ally when the chain begins.
        playSfx('ability.blink');
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
    maxCd: 10,
    activate(unit) {
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 2.2);
      unit.millTimer = 2.2;
      unit.millAngle = unit.facing;
      unit.millCenterX = unit.x;
      unit.millCenterY = unit.y;
      unit._millTargetX = unit.tx;
      unit._millTargetY = unit.ty;
      // Store handle so Unit.update can stop it when millTimer expires.
      unit._millSoundHandle = playSfx('ability.mill_360');
      _radialParticles(unit.x, unit.y, 22, '#ff8020', '#ffd060');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 8);
    },
  },

  vortex: {
    icon:  'assets/icons/abilities/vortex.svg',
    color: '#ff6010',
    maxCd: 12,
    activate(unit) {
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, 2.8);
      unit.vortexTimer = 2.8;
      unit.vortexAngle = unit.facing;
      unit.vortexCenterX = unit.x;
      unit.vortexCenterY = unit.y;
      unit._vortexTargetX = unit.tx;
      unit._vortexTargetY = unit.ty;
      // Store handle so Unit.update can stop it when vortexTimer expires.
      unit._vortexSoundHandle = playSfx('ability.vortex');
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
      // Leap arc: scatter particles along the jump path before teleporting
      const leapSteps = 12;
      const fromX = unit.x, fromY = unit.y;
      const toX = clamp(target.x + rand(-20, 20), 6, G.WORLD_W - 6);
      const toY = clamp(target.y + rand(-20, 20), 6, G.WORLD_H);
      const midX = (fromX + toX) / 2, midY = Math.min(fromY, toY) - 40;
      for (let i = 0; i <= leapSteps; i++) {
        const t = i / leapSteps;
        const px = (1-t)*(1-t)*fromX + 2*(1-t)*t*midX + t*t*toX;
        const py = (1-t)*(1-t)*fromY + 2*(1-t)*t*midY + t*t*toY;
        for (let j = 0; j < 3; j++) {
          state.particles.push({ x: px + rand(-4, 4), y: py + rand(-4, 4), vx: rand(-40, 40), vy: rand(-60, -10), life: rand(0.2, 0.5), maxLife: 0.5, color: j % 2 ? '#ff3010' : '#ffb030', size: rand(2, 4), realtime: true });
        }
      }
      unit.x = toX; unit.y = toY;
      unit.tx = unit.x; unit.ty = unit.y;
      unit.blinkFlash = 1;
      unit.vz = 180; unit.z = 0;
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

  // ── Dick Tree 1 — Boomerang L2/L3 ────────────────────────────────────────

  ellipse_boomerang: {
    icon:  'assets/icons/abilities/boomerang.svg',
    color: '#ff7050',
    sound: 'ability.boomerang',
    maxCd: 10,
    activate(unit) {
      if (unit.boomerang !== null) return false;
      let target = null, maxHp = -1;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const d = dist2(unit.x, unit.y, e.x, e.y);
        if (d < 320 && e.hp > maxHp) { maxHp = e.hp; target = e; }
      }
      if (!target) return false;
      unit.boomerang = {
        startX: unit.x, startY: unit.y,
        targetX: target.x, targetY: target.y,
        phase: 'outbound', t: 0,
        clubX: unit.x, clubY: unit.y,
        hitOut: new Set(), hitRet: new Set(),
        ellipseWidth: 140,
      };
      return true;
    },
  },

  dual_boomerangs: {
    icon:  'assets/icons/abilities/boomerang.svg',
    color: '#ff9060',
    sound: 'ability.boomerang',
    maxCd: 12,
    activate(unit) {
      if (unit.boomerang !== null) return false;
      // Find 2 most dangerous (highest threat: HP * nearby allies) — use HP as proxy
      const alive = state.enemies.filter(e => !e.dead && dist2(unit.x, unit.y, e.x, e.y) < 360);
      if (alive.length === 0) return false;
      alive.sort((a, b) => b.hp - a.hp);
      const t1 = alive[0];
      const t2 = alive[1] ?? alive[0];
      unit.boomerang = {
        startX: unit.x, startY: unit.y,
        targetX: t1.x, targetY: t1.y,
        phase: 'outbound', t: 0,
        clubX: unit.x, clubY: unit.y,
        hitOut: new Set(), hitRet: new Set(),
        ellipseWidth: 120,
      };
      unit.boomerang2 = {
        startX: unit.x, startY: unit.y,
        targetX: t2.x, targetY: t2.y,
        phase: 'outbound', t: 0,
        clubX: unit.x + rand(-10, 10), clubY: unit.y + rand(-10, 10),
        hitOut: new Set(), hitRet: new Set(),
        ellipseWidth: -120,  // mirror arc direction
      };
      return true;
    },
  },

  // ── Dick Tree 2 — Dance of Death (L3) ────────────────────────────────────

  dance_of_death: {
    icon:  'assets/icons/abilities/mill_360.svg',
    color: '#ff2000',
    maxCd: 22,
    activate(unit) {
      const duration     = 5.0;
      const pullRadius   = 90;
      const slamDamage   = 120;
      const postStunDur  = 2.0;
      unit.danceOfDeathTimer   = duration;
      unit.danceOfDeathCenterX = unit.x;
      unit.danceOfDeathCenterY = unit.y;
      unit.danceOfDeathPullR   = pullRadius;
      unit.danceOfDeathSlamDmg = slamDamage;
      unit.danceOfDeathStunDur = postStunDur;
      unit.immortalTimer = Math.max(unit.immortalTimer || 0, duration + 0.1);
      _radialParticles(unit.x, unit.y, 40, '#ff2000', '#ff8030');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 10);
    },
  },

  // ── Dick Tree 3 — Transgender Talk (L3) ──────────────────────────────────

  transgender_talk: {
    icon:  'assets/icons/abilities/inappropriate_stories.svg',
    color: '#ff6080',
    sound: 'ability.inappropriate_stories',
    maxCd: 20,
    activate(unit) {
      const radius       = 250;
      const heroDuration = 6;
      const heroAtkBoost = 6;
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) < radius) {
          ally.speedBoostTimer = Math.max(ally.speedBoostTimer || 0, heroDuration);
          ally.storiesRateBoost = Math.max(ally.storiesRateBoost || 0, heroAtkBoost);
        }
      }
      // Initial stun burst
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(unit.x, unit.y, e.x, e.y) < radius) {
          e.stunTimer = Math.max(e.stunTimer, 0.8);
          e.hurtFlash = 0.5;
        }
      }
      // Set continuous stun timer on Dick (ticked in Unit.update)
      unit.transgenderTalkTimer  = heroDuration;
      unit.transgenderTalkRadius = radius;
      unit._tTalkStunCd = 0;
      _radialParticles(unit.x, unit.y, 22, '#ff6080', '#ffb0c0');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 5);
    },
  },

  // ── Habib Tree 1 — Backdoor Blockade L2/L3 ───────────────────────────────

  stunned_backdoor_blockade: {
    icon:  'assets/icons/abilities/backdoor_blockade.svg',
    color: '#b08cff',
    sound: 'ability.backdoor_blockade',
    maxCd: 14,
    activate(unit) {
      const radius = 150;
      const stunDuration = 1.5;
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) < radius) {
          ally.blockadeTimer = 6;
          ally.blockadeStunOnHit = stunDuration;
          for (let i = 0; i < 12; i++) {
            const a = rand(0, Math.PI * 2);
            const v = rand(40, 100);
            state.particles.push({ x: ally.x, y: ally.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: rand(0.3, 0.7), maxLife: 0.7, color: i % 2 ? '#c8d8ff' : '#a0b8e8', size: rand(1.5, 3), realtime: true });
          }
        }
      }
      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.15); state.flashColor = '#b090ff'; }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 4);
      unit.abilityCd = unit.abilityMaxCd;
      return true;
    },
  },

  fire_backdoor_blockade: {
    icon:  'assets/icons/abilities/backdoor_blockade.svg',
    color: '#ff9060',
    sound: 'ability.backdoor_blockade',
    maxCd: 14,
    activate(unit) {
      const radius = 150;
      const fireDamage = 15;
      const burnTimer = 3;
      for (const ally of state.units) {
        if (ally.dead) continue;
        if (dist2(unit.x, unit.y, ally.x, ally.y) < radius) {
          ally.blockadeTimer = 6;
          ally.blockadeFireOnHitDmg  = fireDamage;
          ally.blockadeFireOnHitBurn = burnTimer;
          for (let i = 0; i < 12; i++) {
            const a = rand(0, Math.PI * 2);
            const v = rand(40, 100);
            state.particles.push({ x: ally.x, y: ally.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: rand(0.3, 0.7), maxLife: 0.7, color: i % 2 ? '#ffb060' : '#ff7030', size: rand(1.5, 3), realtime: true });
          }
        }
      }
      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.2); state.flashColor = '#ff8040'; }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 5);
      unit.abilityCd = unit.abilityMaxCd;
      return true;
    },
  },

  // ── Habib Tree 2 — Tinkering L1/L3 ──────────────────────────────────────

  acid_slingshot: {
    icon:  'assets/icons/abilities/acid_gun.svg',
    color: '#40ff40',
    sound: 'ability.acid_gun',
    maxCd: 16,
    activate(unit) {
      unit.acidSlingshotShots    = 5;
      unit.acidSlingshotCd       = 0;
      unit.acidSlingshotInterval = 0.15;
      _radialParticles(unit.x, unit.y, 10, '#40ff40', '#80ff80');
    },
  },

  lightning_chain_tinkering: {
    icon:  'assets/icons/abilities/chain_lightning.svg',
    color: '#80d0ff',
    sound: 'ability.lightning',
    maxCd: 10,
    activate(unit) {
      const maxRange = 200;
      const hasTarget = state.enemies.some(e => !e.dead && dist2(unit.x, unit.y, e.x, e.y) < maxRange);
      if (!hasTarget) return false;
      const jumps = 6;
      let cx = unit.x, cy = unit.y;
      const hit = new Set();
      const points = [{ x: cx, y: cy }];
      for (let i = 0; i < jumps; i++) {
        let nearest = null, nd = maxRange;
        for (const e of state.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = dist2(cx, cy, e.x, e.y);
          if (d < nd) { nd = d; nearest = e; }
        }
        if (!nearest) break;
        hit.add(nearest);
        points.push({ x: nearest.x, y: nearest.y });
        const dmg = Math.round(22 * (unit.upgradeDmgMult || 1));
        nearest.hp -= dmg;
        nearest.hurtFlash = 1;
        nearest.slowTimer = Math.max(nearest.slowTimer || 0, TINKERING_SLOW_CONFIG.duration);
        nearest.slowFactor = Math.min(nearest.slowFactor ?? 1, TINKERING_SLOW_CONFIG.factor);
        nearest.knockX += rand(-20, 20);
        nearest.knockY += rand(-20, 20);
        for (let j = 0; j < 8; j++) {
          state.particles.push({ x: nearest.x, y: nearest.y, vx: rand(-80, 80), vy: rand(-100, -20), life: rand(0.2, 0.5), maxLife: 0.5, color: j % 2 ? '#80d0ff' : '#e0f4ff', size: rand(1.2, 2.5), realtime: true });
        }
        pushDamageNumber(nearest.x, nearest.y - nearest.r - 4, dmg, { rgb: [140, 210, 255] });
        cx = nearest.x; cy = nearest.y;
      }
      if (points.length > 1) {
        state.bolts.push({ points, life: 0.4, maxLife: 0.4 });
        if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.18); state.flashColor = '#80d0ff'; }
        if (!state.settings.noShake) state.hitStop = Math.max(state.hitStop, 0.03);
      }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 4);
    },
  },

  // ── Habib Tree 3 — Weapon Effects L1/L2/L3 ───────────────────────────────

  weapon_effects_flame: {
    icon:  'assets/icons/abilities/chain_lightning.svg',
    color: '#ff8030',
    maxCd: 18,
    activate(unit) {
      const duration     = 8;
      const triggerChance = 0.80;
      for (const ally of state.units) {
        if (ally.dead) continue;
        ally.weaponEffectTimer  = duration;
        ally.weaponEffectType   = 'flame';
        ally.weaponEffectChance = triggerChance;
        ally.weaponEffectParams = { damage: 10, burnTimer: 2 };
      }
      _radialParticles(unit.x, unit.y, 16, '#ff8030', '#ffc060');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 3);
    },
  },

  weapon_effects_stun: {
    icon:  'assets/icons/abilities/chain_lightning.svg',
    color: '#c080ff',
    maxCd: 20,
    activate(unit) {
      const duration      = 8;
      const triggerChance = 0.85;
      for (const ally of state.units) {
        if (ally.dead) continue;
        ally.weaponEffectTimer  = duration;
        ally.weaponEffectType   = 'stun';
        ally.weaponEffectChance = triggerChance;
        ally.weaponEffectParams = { stunTime: 1.2 };
      }
      _radialParticles(unit.x, unit.y, 16, '#c080ff', '#e0b0ff');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 3);
    },
  },

  weapon_effects_lightning: {
    icon:  'assets/icons/abilities/chain_lightning.svg',
    color: '#a0e0ff',
    maxCd: 22,
    activate(unit) {
      const duration      = 8;
      const triggerChance = 0.75;
      for (const ally of state.units) {
        if (ally.dead) continue;
        ally.weaponEffectTimer  = duration;
        ally.weaponEffectType   = 'lightning';
        ally.weaponEffectChance = triggerChance;
        ally.weaponEffectParams = { chainCount: 3 };
      }
      _radialParticles(unit.x, unit.y, 20, '#a0e0ff', '#e0f8ff');
      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.12); state.flashColor = '#a0d8ff'; }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 4);
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

// ── Combination System ────────────────────────────────────────────────────────

// How long a secondary ability's combo window stays open after activation (seconds).
export const COMBO_WINDOW = 8;

// ── Combo helpers ─────────────────────────────────────────────────────────────

// Attach a per-hit callback to one or both of Dick's active boomerangs.
function _addBoomerangCombo(main, fn) {
  for (const b of [main.boomerang, main.boomerang2]) {
    if (!b) continue;
    b.comboHitFns = b.comboHitFns ?? [];
    b.comboHitFns.push(fn);
  }
}

// Apply fn(enemy, landX, landY) to all enemies within radius of the blink landing.
function _blinkAoE(main, radius, fn) {
  const lx = main._lastBlinkDest?.x ?? main.x;
  const ly = main._lastBlinkDest?.y ?? main.y;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (dist2(lx, ly, e.x, e.y) < radius) fn(e, lx, ly);
  }
}

// Chain lightning starting from a given enemy, jumping to nearby enemies.
function _comboChainLightning(mainUnit, startEnemy, jumps, dmg) {
  const range = 180;
  let cx = startEnemy.x, cy = startEnemy.y;
  const hit = new Set([startEnemy]);
  const pts = [{ x: cx, y: cy }];
  for (let i = 0; i < jumps; i++) {
    let next = null, nd = range;
    for (const e of state.enemies) {
      if (e.dead || hit.has(e)) continue;
      const d = dist2(cx, cy, e.x, e.y);
      if (d < nd) { nd = d; next = e; }
    }
    if (!next) break;
    hit.add(next);
    pts.push({ x: next.x, y: next.y });
    next.hp -= dmg;
    next.hurtFlash = 0.5;
    cx = next.x; cy = next.y;
  }
  if (pts.length > 1) state.bolts.push({ points: pts, life: 0.35, maxLife: 0.35 });
}

// Chain lightning from the nearest enemy within radius of a point.
function _comboChainLightningAtPoint(x, y, radius, jumps, dmg) {
  let start = null, nd = radius;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < nd) { nd = d; start = e; }
  }
  if (!start) return;
  start.hp -= dmg;
  start.hurtFlash = 0.5;
  const pts = [{ x, y }, { x: start.x, y: start.y }];
  let cx = start.x, cy = start.y;
  const hit = new Set([start]);
  for (let i = 1; i < jumps; i++) {
    let next = null, nd2 = 180;
    for (const e of state.enemies) {
      if (e.dead || hit.has(e)) continue;
      const d = dist2(cx, cy, e.x, e.y);
      if (d < nd2) { nd2 = d; next = e; }
    }
    if (!next) break;
    hit.add(next);
    pts.push({ x: next.x, y: next.y });
    next.hp -= dmg;
    next.hurtFlash = 0.5;
    cx = next.x; cy = next.y;
  }
  if (pts.length > 1) state.bolts.push({ points: pts, life: 0.4, maxLife: 0.4 });
  if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.12); state.flashColor = '#a0d8ff'; }
}

// Damage enemies along the corridor from blink origin to landing.
function _blinkTrail(main, halfWidth, dmg, vortexPull) {
  const ox = main._lastBlinkDest?._originX ?? main.x;
  const oy = main._lastBlinkDest?._originY ?? main.y;
  const lx = main._lastBlinkDest?.x ?? main.x;
  const ly = main._lastBlinkDest?.y ?? main.y;
  const len = Math.hypot(lx - ox, ly - oy);
  if (len < 2) return;
  const nx = (lx - ox) / len, ny = (ly - oy) / len;
  for (const e of state.enemies) {
    if (e.dead) continue;
    // Project enemy onto blink line
    const t = clamp(((e.x - ox) * nx + (e.y - oy) * ny) / len, 0, 1);
    const px = ox + t * (lx - ox), py = oy + t * (ly - oy);
    if (dist2(e.x, e.y, px, py) < halfWidth + e.r) {
      e.hp -= dmg;
      e.hurtFlash = 0.6;
      if (vortexPull) {
        // Weak pull toward landing zone
        const a = Math.atan2(ly - e.y, lx - e.x);
        e.knockX += Math.cos(a) * 80;
        e.knockY += Math.sin(a) * 80;
      }
      for (let i = 0; i < 5; i++) {
        state.particles.push({ x: px + rand(-4, 4), y: py + rand(-4, 4), vx: rand(-50, 50), vy: rand(-70, -10), life: rand(0.2, 0.5), maxLife: 0.5, color: '#ffd060', size: rand(1.5, 3), realtime: true });
      }
    }
  }
}

// Damage + optional vortex burst around a protected hero (for Blockade + Spin Clubs combo).
function _blockadeMillPulse(hero, radius, dmg, type) {
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (dist2(hero.x, hero.y, e.x, e.y) < radius + e.r) {
      e.hp -= dmg;
      e.hurtFlash = 0.5;
      const a = Math.atan2(e.y - hero.y, e.x - hero.x);
      if (type === 0) {
        e.knockX += Math.cos(a) * 100;
        e.knockY += Math.sin(a) * 100;
      } else if (type === 1) {
        // Vortex: pull inward
        e.knockX -= Math.cos(a) * 80;
        e.knockY -= Math.sin(a) * 80;
      } else {
        // Type 2: blast outward + stun
        e.knockX += Math.cos(a) * 200;
        e.knockY += Math.sin(a) * 200;
        e.stunTimer = Math.max(e.stunTimer, 1.5);
      }
      _radialParticles(hero.x, hero.y, 12, '#ff8020', '#ffd060');
    }
  }
}

// ── Combo table ───────────────────────────────────────────────────────────────
// Key format: `${mainHeroType}_${secondaryHeroType}_${secondaryTreeNum}`
// Each entry: array of 3 handlers [level1Fn, level2Fn, level3Fn]
// Handler signature: (mainUnit, secondaryUnit) => void

const COMBO_TABLE = {

  // ── Dick (Boomerang T1) + Eliott (Green Pipe T2) ─────────────────────────
  dick_eliott_2: [
    // L1: slow on boomerang hit
    (main) => {
      _addBoomerangCombo(main, (e) => {
        e.slowTimer = Math.max(e.slowTimer, 2);
        e.slowFactor = Math.min(e.slowFactor ?? 1, 0.5);
      });
    },
    // L2: slow + brief freeze
    (main) => {
      _addBoomerangCombo(main, (e) => {
        e.slowTimer = Math.max(e.slowTimer, 2);
        e.slowFactor = Math.min(e.slowFactor ?? 1, 0.5);
        e.stunTimer = Math.max(e.stunTimer, 0.8);
      });
    },
    // L3: slow + freeze + extra damage
    (main) => {
      _addBoomerangCombo(main, (e) => {
        e.slowTimer = Math.max(e.slowTimer, 2.5);
        e.slowFactor = Math.min(e.slowFactor ?? 1, 0.4);
        e.stunTimer = Math.max(e.stunTimer, 0.8);
        e.hp -= 15;
        e.hurtFlash = 0.5;
      });
    },
  ],

  // ── Dick (Boomerang T1) + Eliott (White Powder T3) ───────────────────────
  dick_eliott_3: [
    // L1: knockback on hit
    (main) => {
      _addBoomerangCombo(main, (e, bx, by) => {
        const a = Math.atan2(e.y - by, e.x - bx);
        e.knockX += Math.cos(a) * 120; e.knockY += Math.sin(a) * 120;
      });
    },
    // L2: heavy knockback
    (main) => {
      _addBoomerangCombo(main, (e, bx, by) => {
        const a = Math.atan2(e.y - by, e.x - bx);
        e.knockX += Math.cos(a) * 250; e.knockY += Math.sin(a) * 250;
      });
    },
    // L3: heavy knockback + stun
    (main) => {
      _addBoomerangCombo(main, (e, bx, by) => {
        const a = Math.atan2(e.y - by, e.x - bx);
        e.knockX += Math.cos(a) * 250; e.knockY += Math.sin(a) * 250;
        e.stunTimer = Math.max(e.stunTimer, 1.0);
      });
    },
  ],

  // ── Dick (Boomerang T1) + Habib (Tinkering T2) ───────────────────────────
  dick_habib_2: [
    // L1: acid on hit
    (main) => {
      _addBoomerangCombo(main, (e) => {
        e.acidDot = Math.max(e.acidDot || 0, 3);
        e.slowTimer = Math.max(e.slowTimer, TINKERING_SLOW_CONFIG.duration);
        e.slowFactor = Math.min(e.slowFactor ?? 1, TINKERING_SLOW_CONFIG.factor);
      });
    },
    // L2: fire on hit
    (main) => {
      _addBoomerangCombo(main, (e) => {
        e.fireDot = Math.max(e.fireDot || 0, 3);
        e.hp -= 10; e.hurtFlash = 0.5;
        e.slowTimer = Math.max(e.slowTimer, TINKERING_SLOW_CONFIG.duration);
        e.slowFactor = Math.min(e.slowFactor ?? 1, TINKERING_SLOW_CONFIG.factor);
      });
    },
    // L3: lightning chain on hit
    (main) => {
      _addBoomerangCombo(main, (e, _bx, _by, mainUnit) => {
        e.slowTimer = Math.max(e.slowTimer, TINKERING_SLOW_CONFIG.duration);
        e.slowFactor = Math.min(e.slowFactor ?? 1, TINKERING_SLOW_CONFIG.factor);
        _comboChainLightning(mainUnit, e, 3, 18);
      });
    },
  ],

  // ── Dick (Boomerang T1) + Habib (Weapon Effects T3) ──────────────────────
  dick_habib_3: [
    // L1: knockback + flame on hit
    (main) => {
      _addBoomerangCombo(main, (e, bx, by) => {
        const a = Math.atan2(e.y - by, e.x - bx);
        e.knockX += Math.cos(a) * 100; e.knockY += Math.sin(a) * 100;
        e.fireDot = Math.max(e.fireDot || 0, 2);
        e.hp -= 8; e.hurtFlash = 0.4;
      });
    },
    // L2: knockback + stun on hit
    (main) => {
      _addBoomerangCombo(main, (e, bx, by) => {
        const a = Math.atan2(e.y - by, e.x - bx);
        e.knockX += Math.cos(a) * 100; e.knockY += Math.sin(a) * 100;
        e.stunTimer = Math.max(e.stunTimer, 1.2);
      });
    },
    // L3: knockback + chain lightning on hit
    (main) => {
      _addBoomerangCombo(main, (e, bx, by, mainUnit) => {
        const a = Math.atan2(e.y - by, e.x - bx);
        e.knockX += Math.cos(a) * 100; e.knockY += Math.sin(a) * 100;
        _comboChainLightning(mainUnit, e, 3, 18);
      });
    },
  ],

  // ── Eliott (Blink T1) + Habib (Tinkering T2) ─────────────────────────────
  eliott_habib_2: [
    // L1: acid burst at landing
    (main) => {
      _blinkAoE(main, 110, (e) => {
        e.acidDot = Math.max(e.acidDot || 0, 4); e.hp -= 12; e.hurtFlash = 0.5;
        e.slowTimer = Math.max(e.slowTimer, TINKERING_SLOW_CONFIG.duration);
        e.slowFactor = Math.min(e.slowFactor ?? 1, TINKERING_SLOW_CONFIG.factor);
      });
      const lx = main._lastBlinkDest?.x ?? main.x, ly = main._lastBlinkDest?.y ?? main.y;
      _radialParticles(lx, ly, 14, '#40ff40', '#80ff80');
    },
    // L2: fire burst at landing
    (main) => {
      _blinkAoE(main, 120, (e) => {
        e.fireDot = Math.max(e.fireDot || 0, 4); e.hp -= 18; e.hurtFlash = 0.6;
        e.slowTimer = Math.max(e.slowTimer, TINKERING_SLOW_CONFIG.duration);
        e.slowFactor = Math.min(e.slowFactor ?? 1, TINKERING_SLOW_CONFIG.factor);
      });
      const lx = main._lastBlinkDest?.x ?? main.x, ly = main._lastBlinkDest?.y ?? main.y;
      _radialParticles(lx, ly, 16, '#ff6020', '#ffb040');
    },
    // L3: lightning burst at landing
    (main) => {
      const lx = main._lastBlinkDest?.x ?? main.x, ly = main._lastBlinkDest?.y ?? main.y;
      _blinkAoE(main, 130, (e) => {
        e.slowTimer = Math.max(e.slowTimer, TINKERING_SLOW_CONFIG.duration);
        e.slowFactor = Math.min(e.slowFactor ?? 1, TINKERING_SLOW_CONFIG.factor);
      });
      _comboChainLightningAtPoint(lx, ly, 130, 5, 25);
      _radialParticles(lx, ly, 18, '#a0e0ff', '#e0f0ff');
    },
  ],

  // ── Eliott (Blink T1) + Habib (Weapon Effects T3) ────────────────────────
  eliott_habib_3: [
    // L1: knockback + flame at landing
    (main) => {
      _blinkAoE(main, 110, (e, lx, ly) => {
        const a = Math.atan2(e.y - ly, e.x - lx);
        e.knockX += Math.cos(a) * 150; e.knockY += Math.sin(a) * 150;
        e.fireDot = Math.max(e.fireDot || 0, 3); e.hp -= 10; e.hurtFlash = 0.5;
      });
    },
    // L2: knockback + stun at landing
    (main) => {
      _blinkAoE(main, 120, (e, lx, ly) => {
        const a = Math.atan2(e.y - ly, e.x - lx);
        e.knockX += Math.cos(a) * 150; e.knockY += Math.sin(a) * 150;
        e.stunTimer = Math.max(e.stunTimer, 1.5);
      });
    },
    // L3: knockback + chain lightning at landing
    (main) => {
      const lx = main._lastBlinkDest?.x ?? main.x, ly = main._lastBlinkDest?.y ?? main.y;
      _blinkAoE(main, 130, (e, elx, ely) => {
        const a = Math.atan2(e.y - ely, e.x - elx);
        e.knockX += Math.cos(a) * 150; e.knockY += Math.sin(a) * 150;
      });
      _comboChainLightningAtPoint(lx, ly, 140, 4, 22);
    },
  ],

  // ── Eliott (Blink T1) + Dick (Spin Clubs T2) ─────────────────────────────
  eliott_dick_2: [
    // L1: damage trail from origin to landing
    (main) => { _blinkTrail(main, 70, 18, 0); },
    // L2: wider trail
    (main) => { _blinkTrail(main, 95, 22, 0); },
    // L3: wider trail + vortex pull at landing
    (main) => { _blinkTrail(main, 115, 26, 1); },
  ],

  // ── Eliott (Blink T1) + Dick (Scream T3) ─────────────────────────────────
  eliott_dick_3: [
    // L1: stun in landing radius
    (main) => {
      _blinkAoE(main, 120, (e) => { e.stunTimer = Math.max(e.stunTimer, 2.0); e.hurtFlash = 0.5; });
      const lx = main._lastBlinkDest?.x ?? main.x, ly = main._lastBlinkDest?.y ?? main.y;
      _radialParticles(lx, ly, 20, '#ff4040', '#ff8080');
    },
    // L2: longer stun + slow
    (main) => {
      _blinkAoE(main, 140, (e) => {
        e.stunTimer = Math.max(e.stunTimer, 3.0);
        e.slowTimer = Math.max(e.slowTimer, 2.5);
        e.slowFactor = Math.min(e.slowFactor ?? 1, 0.5);
        e.hurtFlash = 0.5;
      });
      const lx = main._lastBlinkDest?.x ?? main.x, ly = main._lastBlinkDest?.y ?? main.y;
      _radialParticles(lx, ly, 22, '#ff4040', '#ff8080');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 4);
    },
    // L3: max stun + slow + heavy shake
    (main) => {
      _blinkAoE(main, 160, (e) => {
        e.stunTimer = Math.max(e.stunTimer, 4.0);
        e.slowTimer = Math.max(e.slowTimer, 3.5);
        e.slowFactor = Math.min(e.slowFactor ?? 1, 0.4);
        e.hurtFlash = 0.7;
      });
      const lx = main._lastBlinkDest?.x ?? main.x, ly = main._lastBlinkDest?.y ?? main.y;
      _radialParticles(lx, ly, 28, '#ff2020', '#ff6060');
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 7);
    },
  ],

  // ── Habib (Blockade T1) + Eliott (Green Pipe T2) ─────────────────────────
  habib_eliott_2: [
    // L1: 2× protection (stack alchemyArmor on top of blockade)
    (main) => {
      for (const u of state.units) {
        if (!u.dead && u.blockadeTimer > 0) u.alchemyArmorTimer = Math.max(u.alchemyArmorTimer, 6);
      }
    },
    // L2: 2× + slow enemies on hit
    (main) => {
      for (const u of state.units) {
        if (!u.dead && u.blockadeTimer > 0) {
          u.alchemyArmorTimer = Math.max(u.alchemyArmorTimer, 6);
          u.blockadeSlowOnHit = Math.max(u.blockadeSlowOnHit, 2.0);
        }
      }
    },
    // L3: 2× + stun enemies on hit
    (main) => {
      for (const u of state.units) {
        if (!u.dead && u.blockadeTimer > 0) {
          u.alchemyArmorTimer = Math.max(u.alchemyArmorTimer, 6);
          u.blockadeStunOnHit = Math.max(u.blockadeStunOnHit, 1.5);
        }
      }
    },
  ],

  // ── Habib (Blockade T1) + Eliott (White Powder T3) ───────────────────────
  habib_eliott_3: [
    // L1: heavy knockback on attacker
    (main) => {
      for (const u of state.units) {
        if (!u.dead && u.blockadeTimer > 0) u.blockadeKbOnHit = Math.max(u.blockadeKbOnHit, 300);
      }
    },
    // L2: heavy knockback + stun
    (main) => {
      for (const u of state.units) {
        if (!u.dead && u.blockadeTimer > 0) {
          u.blockadeKbOnHit   = Math.max(u.blockadeKbOnHit, 300);
          u.blockadeStunOnHit = Math.max(u.blockadeStunOnHit, 1.0);
        }
      }
    },
    // L3: heavy knockback + stun + acid
    (main) => {
      for (const u of state.units) {
        if (!u.dead && u.blockadeTimer > 0) {
          u.blockadeKbOnHit   = Math.max(u.blockadeKbOnHit, 300);
          u.blockadeStunOnHit = Math.max(u.blockadeStunOnHit, 1.0);
          u.blockadeAcidOnHit = true;
        }
      }
    },
  ],

  // ── Habib (Blockade T1) + Dick (Spin Clubs T2) ───────────────────────────
  habib_dick_2: [
    // L1: damage pulse around each protected hero
    (main) => {
      for (const u of state.units) { if (!u.dead && u.blockadeTimer > 0) _blockadeMillPulse(u, 80, 28, 0); }
    },
    // L2: vortex pull + damage
    (main) => {
      for (const u of state.units) { if (!u.dead && u.blockadeTimer > 0) _blockadeMillPulse(u, 100, 32, 1); }
    },
    // L3: blast + stun
    (main) => {
      for (const u of state.units) { if (!u.dead && u.blockadeTimer > 0) _blockadeMillPulse(u, 130, 50, 2); }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 8);
    },
  ],

  // ── Habib (Blockade T1) + Dick (Scream T3) ───────────────────────────────
  habib_dick_3: [
    // L1: 3× stun duration for already-stunned enemies near protected heroes
    (main) => {
      for (const e of state.enemies) {
        if (e.dead || e.stunTimer <= 0) continue;
        if (state.units.some(u => !u.dead && u.blockadeTimer > 0 && dist2(u.x, u.y, e.x, e.y) < 200)) {
          e.stunTimer = Math.min(e.stunTimer * 3, 8);
        }
      }
    },
    // L2: 3× stun + slow
    (main) => {
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (!state.units.some(u => !u.dead && u.blockadeTimer > 0 && dist2(u.x, u.y, e.x, e.y) < 200)) continue;
        if (e.stunTimer > 0) e.stunTimer = Math.min(e.stunTimer * 3, 8);
        e.slowTimer = Math.max(e.slowTimer, 3);
        e.slowFactor = Math.min(e.slowFactor ?? 1, 0.4);
      }
    },
    // L3: 3× stun + slow + flee knockback
    (main) => {
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (!state.units.some(u => !u.dead && u.blockadeTimer > 0 && dist2(u.x, u.y, e.x, e.y) < 200)) continue;
        if (e.stunTimer > 0) e.stunTimer = Math.min(e.stunTimer * 3, 8);
        e.slowTimer = Math.max(e.slowTimer, 3);
        e.slowFactor = Math.min(e.slowFactor ?? 1, 0.4);
        const fa = rand(0, Math.PI * 2);
        e.knockX += Math.cos(fa) * 400; e.knockY += Math.sin(fa) * 400;
      }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 5);
    },
  ],
};

// ── Public entry point ────────────────────────────────────────────────────────
// Called by cast() after each main ability fires.
// Scans teammates' comboTimer windows and applies any matching combo effects.
export function applyCombos(mainUnit) {
  for (const other of state.units) {
    if (other === mainUnit || other.dead) continue;
    for (const treeNum of [2, 3]) {
      if ((other.comboTimer?.[treeNum] ?? 0) <= 0) continue;
      const level = other.comboLevel?.[treeNum] ?? 1;
      const key = `${mainUnit.type}_${other.type}_${treeNum}`;
      const handlers = COMBO_TABLE[key];
      if (!handlers) continue;
      const fn = handlers[level - 1];
      if (fn) fn(mainUnit, other);
    }
  }
}
