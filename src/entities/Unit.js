import { G } from '../globals.js';
import { rand, dist2, clamp } from '../utils/math.js';
import { state } from '../state.js';
import { HERO_DEFS } from '../config/heroes.js';
import { WEAPON_DEFS } from '../config/weapons.js';
import { DIFFICULTY_DEFS } from '../config/difficulty.js';
import { resolveAsset } from '../config/assets.js';
import { Projectile } from './Projectile.js';
import { ShotgunBullet } from './ShotgunBullet.js';
import { playSfx } from '../systems/audio.js';
import { pushDamageNumber } from '../render/effects.js';
import { ABILITY_DEFS } from '../config/abilities.js';

export class Unit {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.tx = x; this.ty = y;
    this.z = 0;
    this.vz = 0;
    this.r = 11;
    this.speed = 78;
    this.hp = 100; this.maxHp = 100;
    this.atkCd = 0;
    this.selected = false;
    this.swing = 0;
    this.facing = 0;
    this.walkCycle = 0;
    this.dead = false;
    this.aggroTarget = null;
    this.hurtFlash = 0;

    this.type = type;
    this.abilityCd = 0;
    this.rageTimer = 0;
    this.blinkFlash = 0;
    this.dualSide = false;
    this.throwArm = 0;
    this.currentWeapon = null;
    this.previousWeapon = null;
    this.weaponTimer = 0;
    this._anim = { name: 'idle', frame: 0, timer: 0 };

    // Unified upgrade slots: holds actives {kind:'active',id,cd,maxCd,wavesLeft}
    // and passives {kind:'passive',id}. Max 2; 3rd push drops oldest (FIFO).
    this.upgradeSlots = [null, null];

    // Timers for various effects
    this.immortalTimer = 0;      // while > 0, incoming damage is absorbed
    this.blockadeTimer = 0;      // Habib's Backdoor Blockade: 50% dmg reduction
    this.alchemyArmorTimer = 0;  // Eliott's Green Pipe: 40% dmg reduction
    this.speedBoostTimer = 0;    // speed burst (Blue Cubes of Speed, Inappropriate Stories)
    this.storiesRateBoost = 0;   // attack rate boost from Inappropriate Stories
    this.alchemyRageMult = 1;    // extra atk speed multiplier from Blue Cubes of Rage
    this.stonedTimer = 0;        // Stoned Green Pipe: enemy magnet + immortal
    this.flamethrowerTimer = 0;  // Flamethrower cone active
    this.acidGunTimer = 0;       // Acid gun sustained fire
    this.acidGunFireCd = 0;      // Acid gun fire rate cooldown
    this.millTimer = 0;          // 360 Mill spin visual timer
    this.millAngle = 0;
    this.millCenterX = 0;
    this.millCenterY = 0;
    this._millTargetX = 0;
    this._millTargetY = 0;
    this.vortexTimer = 0;        // Vortex spin visual timer
    this.vortexAngle = 0;
    this.vortexCenterX = 0;
    this.vortexCenterY = 0;
    this._vortexTargetX = 0;
    this._vortexTargetY = 0;
    this._wpHitReturn = null;    // White Powder of Hit return data
    this._dominanceTargets = null;
    this._dominanceOrigin = null;
    this._dominanceTimer = 0;

    // Medkit over-time heal
    this.medkitHealRemaining = 0;  // HP remaining to be healed
    this.medkitHealPerSec    = 0;  // HP/s rate

    // Dick boomerang state
    this.boomerang = null; // {startX, startY, targetX, targetY, phase, t, clubX, clubY, hitOut, hitRet}

    // Passive upgrade flags (set per-wave by applyWaveUpgrades)
    this.residualHaze = false;
    this.extendedFormula = false;
    this.smokescreen = false;
    this.backdoorArmorFire = false;
    this.backdoorArmorLightning = false;
    this.backdoorArmorSpikes = false;
    this.densePlating = 0;
    this._maxHpBonusApplied = 0;

    const def = HERO_DEFS[type] || HERO_DEFS.eliott;
    const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
    this.name = def.name;
    this.abilityKey = def.abilityKey;
    this.abilityName = def.abilityName;
    this.abilityId = def.abilityId || '';
    this.abilityDescription = def.abilityDescription || '';
    this.abilityMaxCd = def.abilityMaxCd * diff.hero.abilityCdMult;
    this.abilityColor = def.abilityColor;
    this.currentWeapon = def.startingWeapon || 'hockey_club';
    this.maxHp = Math.round(def.maxHp * diff.hero.hpMult);
    this.hp = this.maxHp;
    this.palette = { ...def.palette };
  }

  get _wDef() { return WEAPON_DEFS[this.currentWeapon] ?? {}; }
  get atkDmg() {
    const base = this._wDef.atkDmg ?? 24;
    const rageMult = this.rageTimer > 0 ? 2 : 1;
    return base * rageMult * (this.upgradeDmgMult || 1);
  }
  get atkRate() {
    const base = this._wDef.atkRate ?? 0.5;
    const rageMult = this.rageTimer > 0 ? 0.4 : 1;
    const alchMult = this.rageTimer > 0 ? (1 / Math.max(1, this.alchemyRageMult)) : 1;
    const storiesMult = this.storiesRateBoost > 0 ? (1 / 1.3) : 1;
    return base * rageMult * alchMult * storiesMult * (this.upgradeRateMult || 1);
  }
  get atkRange() { return this._wDef.atkRange ?? 50; }
  get moving()   { return dist2(this.x, this.y, this.tx, this.ty) > 2.5; }

  update(dt) {
    if (this.dead) return;

    if (this.z > 0 || this.vz !== 0) {
      this.vz -= 800 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; }
    }

    // Tick all timers
    this.rageTimer        = Math.max(0, this.rageTimer - dt);
    this.abilityCd        = Math.max(0, this.abilityCd - dt);
    this.immortalTimer    = Math.max(0, this.immortalTimer - dt);
    this.blockadeTimer    = Math.max(0, this.blockadeTimer - dt);
    this.alchemyArmorTimer= Math.max(0, this.alchemyArmorTimer - dt);
    this.speedBoostTimer  = Math.max(0, this.speedBoostTimer - dt);
    this.storiesRateBoost = Math.max(0, this.storiesRateBoost - dt);
    const _prevStoned = this.stonedTimer;
    this.stonedTimer      = Math.max(0, this.stonedTimer - dt);
    if (_prevStoned > 0 && this.stonedTimer <= 0) {
      let closestAlly = null, closestDist = Infinity;
      for (const ally of state.units) {
        if (ally === this || ally.dead) continue;
        const d = dist2(this.x, this.y, ally.x, ally.y);
        if (d < closestDist) { closestDist = d; closestAlly = ally; }
      }
      if (closestAlly) {
        const ang = rand(0, Math.PI * 2);
        const off = closestAlly.r + this.r + 8;
        this.x = clamp(closestAlly.x + Math.cos(ang) * off, 6, G.W - 6);
        this.y = clamp(closestAlly.y + Math.sin(ang) * off, 6, G.PLAY_BOTTOM);
        this.tx = this.x; this.ty = this.y;
        this.blinkFlash = 1;
        for (let i = 0; i < 12; i++) {
          const a = rand(0, Math.PI * 2), v = rand(40, 100);
          state.particles.push({ x: this.x, y: this.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: rand(0.3, 0.7), maxLife: 0.7, color: i % 2 ? '#40c840' : '#80ff80', size: rand(1.5, 3), realtime: true });
        }
      }
    }
    this.flamethrowerTimer= Math.max(0, this.flamethrowerTimer - dt);
    this.acidGunTimer     = Math.max(0, this.acidGunTimer - dt);
    this.acidGunFireCd    = Math.max(0, this.acidGunFireCd - dt);
    const _prevMill   = this.millTimer;
    const _prevVortex = this.vortexTimer;
    this.millTimer        = Math.max(0, this.millTimer - dt);
    this.vortexTimer      = Math.max(0, this.vortexTimer - dt);

    if (this.medkitHealRemaining > 0) {
      const tick = Math.min(this.medkitHealPerSec * dt, this.medkitHealRemaining);
      this.hp = Math.min(this.maxHp, this.hp + tick);
      this.medkitHealRemaining = Math.max(0, this.medkitHealRemaining - tick);
    }

    // Mill 360: Dick orbits around a center that drifts toward his pre-activation destination
    if (this.millTimer > 0) {
      this.millAngle += dt * 6.0;
      const orbitR = 38;
      const mdx = this._millTargetX - this.millCenterX, mdy = this._millTargetY - this.millCenterY;
      const md = Math.hypot(mdx, mdy);
      if (md > 2) { const s = Math.min(md, this.speed * dt); this.millCenterX = clamp(this.millCenterX + mdx / md * s, 6, G.W - 6); this.millCenterY = clamp(this.millCenterY + mdy / md * s, 6, G.PLAY_BOTTOM); }
      this.x = clamp(this.millCenterX + Math.cos(this.millAngle) * orbitR, 6, G.W - 6);
      this.y = clamp(this.millCenterY + Math.sin(this.millAngle) * orbitR, 6, G.PLAY_BOTTOM);
      this.tx = this.x; this.ty = this.y;
      this.facing = this.millAngle + Math.PI * 0.5;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(this.x, this.y, e.x, e.y) < 80 + e.r) {
          const dmg = this.atkDmg * 2 * (this.upgradeDmgMult || 1) * dt;
          e.hp -= dmg;
          e.hurtFlash = Math.max(e.hurtFlash, 0.15);
          const ang = Math.atan2(e.y - this.y, e.x - this.x);
          e.knockX += Math.cos(ang) * 40 * dt;
          e.knockY += Math.sin(ang) * 40 * dt;
        }
      }
    }
    // On mill expiry: snap Dick to center and resume walking to original destination
    if (_prevMill > 0 && this.millTimer <= 0) {
      this.x = this.millCenterX; this.y = this.millCenterY;
      this.tx = this._millTargetX; this.ty = this._millTargetY;
      this._millSoundHandle?.stop(); this._millSoundHandle = null;
    }

    // Vortex: Dick orbits a larger circle, center drifts toward pre-activation destination
    if (this.vortexTimer > 0) {
      this.vortexAngle += dt * 4.5;
      const orbitR = 50;
      const vdx = this._vortexTargetX - this.vortexCenterX, vdy = this._vortexTargetY - this.vortexCenterY;
      const vd = Math.hypot(vdx, vdy);
      if (vd > 2) { const s = Math.min(vd, this.speed * dt); this.vortexCenterX = clamp(this.vortexCenterX + vdx / vd * s, 6, G.W - 6); this.vortexCenterY = clamp(this.vortexCenterY + vdy / vd * s, 6, G.PLAY_BOTTOM); }
      this.x = clamp(this.vortexCenterX + Math.cos(this.vortexAngle) * orbitR, 6, G.W - 6);
      this.y = clamp(this.vortexCenterY + Math.sin(this.vortexAngle) * orbitR, 6, G.PLAY_BOTTOM);
      this.tx = this.x; this.ty = this.y;
      this.facing = this.vortexAngle + Math.PI * 0.5;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const ed = dist2(this.x, this.y, e.x, e.y);
        if (ed < 100 + e.r) {
          const dmg = this.atkDmg * 2.2 * (this.upgradeDmgMult || 1) * dt;
          e.hp -= dmg;
          e.hurtFlash = Math.max(e.hurtFlash, 0.15);
          // Pull toward center
          const ax = Math.atan2(this.vortexCenterY - e.y, this.vortexCenterX - e.x);
          e.knockX += Math.cos(ax) * 60 * dt;
          e.knockY += Math.sin(ax) * 60 * dt;
        }
      }
    }
    // On vortex expiry: snap Dick to center and resume walking to original destination
    if (_prevVortex > 0 && this.vortexTimer <= 0) {
      this.x = this.vortexCenterX; this.y = this.vortexCenterY;
      this.tx = this._vortexTargetX; this.ty = this._vortexTargetY;
      this._vortexSoundHandle?.stop(); this._vortexSoundHandle = null;
    }

    if (this.speedBoostTimer <= 0 && this.alchemyRageMult !== 1) this.alchemyRageMult = 1;

    // Tick active skill cooldowns
    for (const slot of this.upgradeSlots) {
      if (slot?.kind === 'active') slot.cd = Math.max(0, slot.cd - dt);
    }

    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) {
        this.currentWeapon = this.previousWeapon || this.currentWeapon;
        this.previousWeapon = null;
        this.weaponTimer = 0;
      }
    }

    // White Powder of Hit return
    if (this._wpHitReturn) {
      this._wpHitReturn.timer -= dt;
      if (this._wpHitReturn.timer <= 0) {
        this.x = this._wpHitReturn.x;
        this.y = this._wpHitReturn.y;
        this.tx = this._wpHitReturn.x;
        this.ty = this._wpHitReturn.y;
        this.blinkFlash = 0.7;
        // SOUND POINT 4 — BLINK-OUT: same blink whoosh as the outbound teleport.
        playSfx('ability.blink');
        this._wpHitReturn = null;
      }
    }

    // White Powder of Dominance sequential strike
    // Each strike fires every 0.25 s (_dominanceTimer). Sound should fire
    // once per strike so the chain feels rapid and escalating.
    if (this._dominanceTargets && this._dominanceTargets.length > 0) {
      this._dominanceTimer -= dt;
      if (this._dominanceTimer <= 0) {
        while (this._dominanceTargets.length > 0 && this._dominanceTargets[0]?.dead) {
          this._dominanceTargets.shift();
        }
        const e = this._dominanceTargets.shift();
        if (e && !e.dead) {
          const ang = e.facing + Math.PI;
          this.x = clamp(e.x + Math.cos(ang) * 28, 6, G.W - 6);
          this.y = clamp(e.y + Math.sin(ang) * 28, 6, G.PLAY_BOTTOM);
          this.tx = this.x; this.ty = this.y;
          this.blinkFlash = 0.7;
          const dmg = Math.round(this.atkDmg * (this.upgradeDmgMult || 1));
          e.hp -= dmg;
          e.hurtFlash = 1;
          // SOUND POINT 3 — CHAIN STRIKE: blink whoosh + hero's weapon hit, every 0.25 s.
          playSfx('ability.blink');
          playSfx(this._wDef.sfxAttack || 'weapon.attack.default', { fallback: this._wDef.sfxFallback || 'weapon.attack.default', synthetic: 'hit' });
          playSfx('alien.hit.default', { synthetic: 'hit' });
          pushDamageNumber(e.x, e.y - e.r - 4, dmg, { crit: true, rgb: [240, 220, 100] });
        }
        this._dominanceTimer = 0.25;
        if (this._dominanceTargets.length === 0) {
          if (this._dominanceOrigin) {
            this.x = clamp(this._dominanceOrigin.x, 6, G.W - 6);
            this.y = clamp(this._dominanceOrigin.y, 6, G.PLAY_BOTTOM);
            this.tx = this.x; this.ty = this.y;
            this._dominanceOrigin = null;
          }
          this._dominanceTargets = null;
          this.blinkFlash = 1;
        }
      }
    }

    // Flamethrower cone damage
    if (this.flamethrowerTimer > 0) {
      const coneRange = 180, halfArc = Math.PI * 0.25; // 90° cone
      // Auto-aim toward nearest living enemy
      let _ftNearest = null, _ftNd = Infinity;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const d = dist2(this.x, this.y, e.x, e.y);
        if (d < _ftNd) { _ftNd = d; _ftNearest = e; }
      }
      if (_ftNearest) this.facing = Math.atan2(_ftNearest.y - this.y, _ftNearest.x - this.x);
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(this.x, this.y, e.x, e.y) > coneRange + e.r) continue;
        let da = Math.atan2(e.y - this.y, e.x - this.x) - this.facing;
        while (da >  Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > halfArc) continue;
        const flameDmg = 12 * dt / 0.25; // 12 per 0.25s
        e.hp -= flameDmg;
        e.hurtFlash = 0.3;
        if (!e.fireDot || e.fireDot < 4) e.fireDot = 4;
        if (Math.random() < dt * 10) {
          state.particles.push({ x: e.x + rand(-5, 5), y: e.y + rand(-5, 5), vx: rand(-40, 40), vy: rand(-80, -20), life: rand(0.2, 0.5), maxLife: 0.5, color: rand(0, 1) > 0.5 ? '#ff6020' : '#ff9040', size: rand(2, 4), realtime: true });
        }
      }
    }

    // Acid gun: auto-aim and fire periodic blobs
    if (this.acidGunTimer > 0) {
      let nearest = null, nd = Infinity;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const d = dist2(this.x, this.y, e.x, e.y);
        if (d < nd) { nd = d; nearest = e; }
      }
      if (nearest) {
        this.facing = Math.atan2(nearest.y - this.y, nearest.x - this.x);
        if (this.acidGunFireCd <= 0) {
          const ang = this.facing + rand(-0.15, 0.15);
          state.acidShots = state.acidShots || [];
          state.acidShots.push({
            x: this.x + Math.cos(this.facing) * (this.r + 4),
            y: this.y + Math.sin(this.facing) * (this.r + 4),
            vx: Math.cos(ang) * 240, vy: Math.sin(ang) * 240,
            life: 2.0, maxLife: 2.0, dead: false,
            owner: this,
          });
          this.acidGunFireCd = 0.35;
        }
      }
    }

    // Movement
    const effectiveSpeed = this.speed * (this.speedBoostTimer > 0 ? 1.8 : 1);
    if (this.moving) {
      const dx = this.tx - this.x, dy = this.ty - this.y;
      const d = Math.hypot(dx, dy);
      this.facing = Math.atan2(dy, dx);
      const step = effectiveSpeed * dt;
      if (step >= d) { this.x = this.tx; this.y = this.ty; }
      else { this.x += (dx / d) * step; this.y += (dy / d) * step; }
      this.walkCycle += dt * 9;

      // Speed boost contact damage
      if (this.speedBoostTimer > 0) {
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (dist2(this.x, this.y, e.x, e.y) < this.r + e.r + 4) {
            if (!this._speedDmgCd || this._speedDmgCd <= 0) {
              e.hp -= 20;
              e.hurtFlash = 0.5;
              this._speedDmgCd = 0.3;
            }
          }
        }
      }
    }
    if (this._speedDmgCd) this._speedDmgCd = Math.max(0, this._speedDmgCd - dt);

    this.atkCd -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
    this.swing = Math.max(0, this.swing - dt * 6);
    this.blinkFlash = Math.max(0, this.blinkFlash - dt * 2.5);
    this.throwArm = Math.max(0, this.throwArm - dt * 4);

    // Dick boomerang update
    if (this.type === 'dick' && this.boomerang !== null) {
      this._updateBoomerang(dt);
    }

    // Auto-attack (skip while Dick is boomeranging)
    if (!(this.type === 'dick' && this.boomerang !== null)) {
      let target = null;
      if (this.aggroTarget && !this.aggroTarget.dead) {
        const d = dist2(this.x, this.y, this.aggroTarget.x, this.aggroTarget.y);
        if (d < this.atkRange + 40) target = this.aggroTarget;
        else this.aggroTarget = null;
      }
      if (!target) {
        let nd = this.atkRange;
        for (const e of state.enemies) {
          if (e.dead) continue;
          const d = dist2(this.x, this.y, e.x, e.y);
          if (d < nd) { nd = d; target = e; }
        }
      }
      if (target && dist2(this.x, this.y, target.x, target.y) < this.atkRange && this.atkCd <= 0) {
        this.attack(target);
      }
    }

    this._tickAnim(dt);
  }

  _updateBoomerang(dt) {
    const b = this.boomerang;
    const speed = b.phase === 'outbound' ? 260 : 300;

    // Endpoint changes dynamically for return phase
    const sx = b.clubX ?? b.startX;
    const sy = b.clubY ?? b.startY;
    const ex = b.phase === 'outbound' ? b.targetX : this.x;
    const ey = b.phase === 'outbound' ? b.targetY : this.y;

    const dx = ex - (b.phase === 'outbound' ? b.startX : b.targetX);
    const dy = ey - (b.phase === 'outbound' ? b.startY : b.targetY);
    const totalDist = Math.hypot(dx, dy);

    if (totalDist < 1) {
      this._boomerangPhaseEnd();
      return;
    }

    const perpX = -dy / totalDist * 80;
    const perpY = dx / totalDist * 80;
    const bsx = b.phase === 'outbound' ? b.startX : b.targetX;
    const bsy = b.phase === 'outbound' ? b.startY : b.targetY;
    const bex = b.phase === 'outbound' ? b.targetX : this.x;
    const bey = b.phase === 'outbound' ? b.targetY : this.y;
    const ctrlX = (bsx + bex) / 2 + perpX;
    const ctrlY = (bsy + bey) / 2 + perpY;

    const arcLen = totalDist * 1.4;
    b.t = Math.min(1, b.t + (speed * dt) / Math.max(arcLen, 1));

    const t = b.t;
    b.clubX = (1-t)*(1-t)*bsx + 2*(1-t)*t*ctrlX + t*t*bex;
    b.clubY = (1-t)*(1-t)*bsy + 2*(1-t)*t*ctrlY + t*t*bey;

    // Hit detection
    const hitSet = b.phase === 'outbound' ? b.hitOut : b.hitRet;
    const dmg = Math.round((b.phase === 'outbound' ? 50 : 35) * (this.upgradeDmgMult || 1));
    for (const e of state.enemies) {
      if (e.dead || hitSet.has(e)) continue;
      if (dist2(b.clubX, b.clubY, e.x, e.y) < e.r + 18) {
        hitSet.add(e);
        e.hp -= dmg;
        e.hurtFlash = 1;
        const ang = Math.atan2(e.y - b.clubY, e.x - b.clubX);
        e.knockX += Math.cos(ang) * 60;
        e.knockY += Math.sin(ang) * 60;
        playSfx(this._wDef.sfxAttack || 'weapon.attack.default', { fallback: this._wDef.sfxFallback || 'weapon.attack.default', synthetic: 'hit' });
        playSfx('alien.hit.default', { synthetic: 'hit' });
        pushDamageNumber(e.x, e.y - e.r - 4, dmg, { rgb: [210, 185, 130] });
        for (let i = 0; i < 6; i++) {
          state.particles.push({ x: e.x + rand(-3,3), y: e.y + rand(-3,3), vx: rand(-70,70), vy: rand(-90,-10), life: rand(0.2,0.5), maxLife: 0.5, color: e.bloodColor, size: rand(1.2, 2.5), realtime: true });
        }
      }
    }

    if (b.t >= 1) this._boomerangPhaseEnd();
  }

  _boomerangPhaseEnd() {
    const b = this.boomerang;
    if (b.phase === 'outbound') {
      b.phase = 'return';
      b.t = 0;
    } else {
      this.boomerang = null;
      this.abilityCd = this.abilityMaxCd;
    }
  }

  tickSkillDurability() {
    for (let i = 0; i < this.upgradeSlots.length; i++) {
      const slot = this.upgradeSlots[i];
      if (!slot || slot.kind !== 'active') continue;
      slot.wavesLeft--;
      if (slot.wavesLeft <= 0) {
        const hist = state.selectedUpgradeHistory[this.type];
        if (hist) {
          const idx = hist.indexOf(slot.id);
          if (idx >= 0) hist.splice(idx, 1);
        }
        this.upgradeSlots[i] = null;
      }
    }
  }

  pushUpgrade(id, kind, baseDurability) {
    const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
    const durMod = diff.hero.activeSkillDurabilityMod ?? 0;
    const wavesLeft = Math.max(2, 3 + durMod);
    const def = kind === 'active' ? ABILITY_DEFS[id] : null;
    const entry = kind === 'active'
      ? { kind: 'active', id, cd: 0, maxCd: def?.maxCd || 12, wavesLeft }
      : { kind: 'passive', id };

    const freeIdx = this.upgradeSlots.findIndex(s => s === null);
    if (freeIdx !== -1) {
      this.upgradeSlots[freeIdx] = entry;
    } else {
      // FIFO: drop oldest slot, free its history entry so it can be offered again
      const dropped = this.upgradeSlots[0];
      if (dropped) {
        const hist = state.selectedUpgradeHistory[this.type];
        if (hist) {
          const idx = hist.indexOf(dropped.id);
          if (idx >= 0) hist.splice(idx, 1);
        }
      }
      this.upgradeSlots[0] = this.upgradeSlots[1];
      this.upgradeSlots[1] = entry;
    }
  }

  activateSkill(slotIdx) {
    const slot = this.upgradeSlots[slotIdx];
    if (!slot || slot.kind !== 'active' || slot.cd > 0 || this.dead) return false;
    const impl = ABILITY_DEFS[slot.id];
    if (!impl) return false;
    const result = impl.activate(this);
    if (result === false) return false;  // ability declined (e.g. no targets)
    // Plays the `sound` key defined on the ability in config/abilities.js.
    // This is SOUND POINT 1 for upgrade-slot actives (white_powder_hit,
    // white_powder_dominance, etc.) — fires once on activation only.
    // Mid-ability sounds (blink, impact, chain strikes) must be added as
    // explicit playSfx() calls inside activate() or in the update timers above.
    if (impl.sound) playSfx(impl.sound);
    slot.cd = slot.maxCd;
    return true;
  }

  _animName() {
    if (this.dead)        return 'death';
    if (this.swing > 0.5) return 'attack';
    if (this.type === 'eliott' && this.blinkFlash > 0.5) return 'blink';
    if (this.type === 'dick'   && this.rageTimer  > 0)   return 'rage';
    if (this.throwArm > 0.5) return 'casting';
    if (this.moving)      return 'walk';
    return 'idle';
  }

  _tickAnim(dt) {
    const sprite = resolveAsset('heroes', this.type);
    if (!sprite?.isAnimated) return;
    const name = this._animName();
    const anim = sprite.animations[name] || sprite.animations.idle;
    if (!anim) return;
    if (this._anim.name !== name) {
      this._anim.name  = name;
      this._anim.frame = 0;
      this._anim.timer = 0;
    }
    this._anim.timer += dt;
    const frameDur = 1 / anim.fps;
    while (this._anim.timer >= frameDur) {
      this._anim.timer -= frameDur;
      const loop = name !== 'death';
      this._anim.frame = loop
        ? (this._anim.frame + 1) % anim.frames
        : Math.min(this._anim.frame + 1, anim.frames - 1);
    }
  }

  attack(enemy) {
    const wDef = this._wDef;
    this.atkCd = this.atkRate;
    this.facing = Math.atan2(enemy.y - this.y, enemy.x - this.x);
    this.swing = 1;

    if (wDef.type === 'ranged') {
      this._attackRanged(wDef, enemy);
    } else if (wDef.type === 'thrown') {
      this._attackThrown(wDef, enemy);
    } else if (wDef.cleave) {
      this._attackCleave(wDef);
    } else {
      this._attackMelee(wDef, enemy);
    }
  }

  _attackMelee(wDef, enemy) {
    if (wDef.dual) this.dualSide = !this.dualSide;
    if (this.z === 0) this.vz = 120;
    const dmg = this.atkDmg;
    const kb = (wDef.knockback ?? 80) * (this.rageTimer > 0 ? 1.75 : 1);
    playSfx(wDef.sfxAttack || 'weapon.attack.default', { fallback: wDef.sfxFallback || 'weapon.attack.default', synthetic: 'hit' });
    playSfx(enemy.kind === 'bigboss' || enemy.kind === 'miniboss' ? 'boss.hit.default' : 'alien.hit.default', { synthetic: 'hit' });
    enemy.hp -= dmg;
    enemy.knockX += Math.cos(this.facing) * kb;
    enemy.knockY += Math.sin(this.facing) * kb;
    enemy.hurtFlash = 1;
    state.bloodStains.push({ x: enemy.x + rand(-6, 6), y: enemy.y + rand(-6, 6), r: enemy.r * rand(0.5, 0.8), rot: rand(0, Math.PI), a: rand(0.3, 0.5) });
    const hitCount = this.rageTimer > 0 ? 14 : 10;
    for (let i = 0; i < hitCount; i++) {
      state.particles.push({ x: enemy.x + rand(-3, 3), y: enemy.y + rand(-3, 3), vx: rand(-90, 90), vy: rand(-110, -10), life: rand(0.3, 0.7), maxLife: 0.7, color: enemy.bloodColor, size: rand(1.2, 2.8), realtime: true });
    }
    const sparkX = enemy.x - Math.cos(this.facing) * (enemy.r * 0.5);
    const sparkY = enemy.y - Math.sin(this.facing) * (enemy.r * 0.5);
    state.particles.push({ x: sparkX, y: sparkY, vx: 0, vy: 0, life: 0.16, maxLife: 0.16, color: this.rageTimer > 0 ? 'rgba(255,160,80,1)' : 'rgba(255,220,160,1)', size: this.rageTimer > 0 ? 9 : 6, realtime: true, additive: true });
    pushDamageNumber(enemy.x, enemy.y - enemy.r - 4, dmg, { crit: this.rageTimer > 0, rgb: this.rageTimer > 0 ? [255, 120, 80] : [255, 230, 200] });
    if (!state.settings.noShake) state.shake   = Math.max(state.shake,   this.rageTimer > 0 ? 5    : 3);
    if (!state.settings.noShake) state.hitStop = Math.max(state.hitStop, this.rageTimer > 0 ? 0.04 : 0.018);
  }

  _attackCleave(wDef) {
    playSfx(wDef.sfxAttack || 'weapon.samurai.attack', { synthetic: 'hit' });
    const halfArc = Math.PI * ((wDef.cleaveArc ?? 60) / 180);
    const kb = wDef.knockback ?? 120;
    let hit = 0;
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (dist2(this.x, this.y, e.x, e.y) > this.atkRange + e.r) continue;
      let da = Math.atan2(e.y - this.y, e.x - this.x) - this.facing;
      while (da >  Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > halfArc) continue;
      const dmg = this.atkDmg;
      e.hp -= dmg;
      e.knockX += Math.cos(this.facing) * kb;
      e.knockY += Math.sin(this.facing) * kb;
      e.hurtFlash = 1;
      state.bloodStains.push({ x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), r: e.r * rand(0.6, 1.0), rot: rand(0, Math.PI), a: rand(0.3, 0.6) });
      for (let i = 0; i < 6; i++) {
        state.particles.push({ x: e.x + rand(-3, 3), y: e.y + rand(-3, 3), vx: rand(-80, 80), vy: rand(-100, -10), life: rand(0.3, 0.6), maxLife: 0.6, color: '#e8d080', size: rand(1.2, 2.5), realtime: true });
        state.particles.push({ x: e.x + rand(-4, 4), y: e.y + rand(-4, 4), vx: rand(-50, 50), vy: rand(-80, -10), life: rand(0.2, 0.5), maxLife: 0.5, color: 'rgba(255,240,180,1)', size: rand(1.5, 3), realtime: true, additive: true });
      }
      pushDamageNumber(e.x, e.y - e.r - 4, dmg, { crit: true, rgb: [255, 240, 160] });
      hit++;
    }
    if (hit > 0) playSfx('alien.hit.default', { synthetic: 'hit' });
    state.particles.push({ x: this.x + Math.cos(this.facing) * 24, y: this.y + Math.sin(this.facing) * 24, vx: 0, vy: 0, life: 0.18, maxLife: 0.18, color: 'rgba(255,245,200,1)', size: 16, realtime: true, additive: true });
    if (!state.settings.noShake) state.shake   = Math.max(state.shake,   hit > 1 ? 7    : 3.5);
    if (hit > 0 && !state.settings.noShake) state.hitStop = Math.max(state.hitStop, hit > 2 ? 0.06 : 0.03);
  }

  _attackThrown(wDef, enemy) {
    this.throwArm = 1;
    const sx = this.x + Math.cos(this.facing) * (this.r + 6);
    const sy = this.y + Math.sin(this.facing) * (this.r + 6);
    state.projectiles.push(new Projectile(sx, sy, enemy, this.atkDmg, this.facing, this, wDef));
    if (!state.settings.noShake) state.shake = Math.max(state.shake, 1.5);
  }

  _attackRanged(wDef, enemy) {
    this.throwArm = 1;
    playSfx(wDef.sfxFire || 'weapon.throw.default', { synthetic: wDef.sfxFallback || 'shoot' });
    const count  = wDef.bulletCount ?? 1;
    const spread = wDef.spread ?? 0;
    const dmgPer = count > 1 ? this.atkDmg * 0.5 : this.atkDmg;
    for (let i = 0; i < count; i++) {
      const offset = count > 1 ? (i / (count - 1) - 0.5) * spread * 2 : 0;
      const ang = this.facing + offset;
      const sx = this.x + Math.cos(ang) * (this.r + 6);
      const sy = this.y + Math.sin(ang) * (this.r + 6);
      state.projectiles.push(new ShotgunBullet(sx, sy, ang, dmgPer, wDef));
    }
    if (!state.settings.noShake) state.shake = Math.max(state.shake, count > 1 ? 2.5 : 1.2);
  }

  moveTo(x, y) {
    if (this.stonedTimer > 0) return;
    // During mill/vortex redirect the destination to the orbit center target
    // so the player can steer the spin with right-click like normal movement.
    if (this.millTimer > 0) {
      this._millTargetX = clamp(x, 6, G.W - 6);
      this._millTargetY = clamp(y, 6, G.PLAY_BOTTOM);
      return;
    }
    if (this.vortexTimer > 0) {
      this._vortexTargetX = clamp(x, 6, G.W - 6);
      this._vortexTargetY = clamp(y, 6, G.PLAY_BOTTOM);
      return;
    }
    this.tx = clamp(x, 6, G.W - 6);
    this.ty = clamp(y, 6, G.PLAY_BOTTOM);
    this.aggroTarget = null;
  }
  attackMove(enemy) {
    if (this.stonedTimer > 0) return;
    this.aggroTarget = enemy;
    this.tx = clamp(enemy.x, 6, G.W - 6);
    this.ty = clamp(enemy.y, 6, G.PLAY_BOTTOM);
  }
  stop() { this.tx = this.x; this.ty = this.y; this.aggroTarget = null; }

  cast() {
    if (this.dead || this.abilityCd > 0) return false;
    const def = ABILITY_DEFS[this.abilityId];
    if (!def?.activate) return false;
    const result = def.activate(this);
    // Same as activateSkill — plays `sound` once on activation (SOUND POINT 1).
    // Used for the three base hero abilities (group_blink, boomerang, backdoor_blockade).
    if (result !== false && def.sound) playSfx(def.sound);
    return result ?? true;
  }

  // Apply incoming damage to this hero, respecting reductions.
  // Returns the actual damage dealt.
  applyDamage(rawDmg, attacker) {
    if (this.dead) return 0;
    if (this.immortalTimer > 0) return 0;
    if (this._dominanceTargets !== null) return 0;

    let dmg = rawDmg;
    if (this.blockadeTimer > 0) dmg *= 0.5;
    if (this.alchemyArmorTimer > 0) dmg *= 0.6;
    if (this.densePlating > 0) dmg *= (1 - this.densePlating);
    dmg = Math.max(0, dmg);

    this.hp -= dmg;
    this.hurtFlash = 1;

    // Retribution armor passives — retaliate against the attacker
    if (attacker && !attacker.dead) {
      if (this.backdoorArmorFire) {
        attacker.hp -= 8;
        attacker.hurtFlash = 0.5;
        if (!attacker.fireDot || attacker.fireDot < 2) attacker.fireDot = 2;
      }
      if (this.backdoorArmorLightning) {
        attacker.hp -= 10;
        attacker.stunTimer = Math.max(attacker.stunTimer, 0.6);
        attacker.hurtFlash = 0.5;
      }
      if (this.backdoorArmorSpikes) {
        attacker.hp -= 12;
        attacker.hurtFlash = 0.5;
      }
    }

    return dmg;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(0, -this.z);

    if (this.blinkFlash > 0) {
      ctx.strokeStyle = `rgba(128, 200, 255, ${this.blinkFlash})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 14 * (1 - this.blinkFlash), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.rageTimer > 0) {
      const pulse = 0.5 + Math.sin(state.time * 14) * 0.5;
      const fade = Math.min(1, this.rageTimer / 0.4);
      ctx.strokeStyle = `rgba(255, 60, 30, ${(0.35 + pulse * 0.4) * fade})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 4 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 180, 60, ${0.55 * fade})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Backdoor Blockade shimmer
    if (this.blockadeTimer > 0) {
      const pulse = 0.5 + Math.sin(state.time * 8) * 0.5;
      const fade = Math.min(1, this.blockadeTimer / 0.5);
      ctx.strokeStyle = `rgba(180, 200, 255, ${(0.4 + pulse * 0.4) * fade})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 6 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
      // Metallic cross-hatch on body
      ctx.strokeStyle = `rgba(200, 220, 255, ${0.25 * fade})`;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI + state.time * 0.5;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(a) * (this.r - 2), this.y + Math.sin(a) * (this.r - 2));
        ctx.lineTo(this.x + Math.cos(a + Math.PI) * (this.r - 2), this.y + Math.sin(a + Math.PI) * (this.r - 2));
        ctx.stroke();
      }
    }

    // Alchemy armor shimmer (Green Pipe)
    if (this.alchemyArmorTimer > 0) {
      const pulse = 0.5 + Math.sin(state.time * 6) * 0.5;
      ctx.strokeStyle = `rgba(60, 200, 60, ${0.35 + pulse * 0.35})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 5 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Stoned Green Pipe: green stone statue effect
    if (this.stonedTimer > 0) {
      ctx.strokeStyle = `rgba(40, 160, 40, 0.9)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(40, 160, 40, 0.4)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Speed boost sparkles
    if (this.speedBoostTimer > 0 && Math.random() < 0.25) {
      const a = rand(0, Math.PI * 2);
      const r = this.r + rand(2, 6);
      state.particles.push({ x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r, vx: rand(-30, 30), vy: rand(-50, -10), life: rand(0.1, 0.3), maxLife: 0.3, color: '#8080ff', size: rand(1.5, 2.5), realtime: true });
    }

    if (this.selected && this.moving) {
      ctx.strokeStyle = 'rgba(180, 220, 130, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.tx, this.ty);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.selected) {
      const pulse = 1 + Math.sin(state.time * 5) * 0.08;
      ctx.strokeStyle = 'rgba(180, 220, 130, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.r - 1, (this.r + 5) * pulse, (this.r + 5) * 0.4 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const wobble = this.moving ? Math.sin(this.walkCycle) * 1.2 : 0;
    const flashBoost = this.hurtFlash > 0 ? this.hurtFlash : 0;

    ctx.save();
    ctx.translate(this.x, this.y + wobble);

    const sprite = resolveAsset('heroes', this.type);
    if (sprite) {
      ctx.rotate(this.facing);
      if (flashBoost > 0) { ctx.globalAlpha = 0.7 + flashBoost * 0.3; ctx.filter = 'brightness(2)'; }
      sprite.draw(ctx, this._anim, -this.r * 1.5, -this.r * 1.5, this.r * 3, this.r * 3);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    } else if (this.type === 'eliott') {
      this._drawEliott(ctx, flashBoost);
    } else if (this.type === 'dick') {
      this._drawDick(ctx, flashBoost);
    } else if (this.type === 'habib') {
      this._drawHabib(ctx, flashBoost);
    }

    ctx.restore();

    if (this.type === 'habib' && Math.random() < 0.06) {
      const a = rand(0, Math.PI * 2);
      const r = this.r + rand(1, 4);
      ctx.strokeStyle = 'rgba(200, 230, 255, 0.75)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
      ctx.lineTo(this.x + Math.cos(a) * (r + rand(3, 7)) + rand(-2, 2), this.y + Math.sin(a) * (r + rand(3, 7)) + rand(-2, 2));
      ctx.stroke();
    }

    // Only draw held weapon if not boomeranging
    if (!(this.type === 'dick' && this.boomerang !== null)) {
      this._drawWeapon(ctx);
    }

    // Draw flying boomerang
    if (this.boomerang !== null) {
      this._drawFlyingBoomerang(ctx);
    }

    // Flamethrower visual — dense fire particle spray
    if (this.flamethrowerTimer > 0) {
      const coneRange = 180, halfArc = Math.PI * 0.25;
      // Hot nozzle glow
      ctx.save();
      const nx = this.x + Math.cos(this.facing) * (this.r + 4);
      const ny = this.y + Math.sin(this.facing) * (this.r + 4);
      const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, 20);
      grd.addColorStop(0,   'rgba(255, 255, 200, 0.95)');
      grd.addColorStop(0.4, 'rgba(255, 160, 30, 0.5)');
      grd.addColorStop(1,   'rgba(255, 80, 0, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(nx, ny, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Dense fire particles
      const count = 5 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const ang  = this.facing + rand(-halfArc * 0.85, halfArc * 0.85);
        const dist = rand(this.r + 4, 20);
        const spd  = rand(90, 220);
        const life = rand(0.18, 0.5);
        const r    = Math.random();
        const color = r < 0.12 ? '#ffffff'
                    : r < 0.30 ? '#ffee80'
                    : r < 0.55 ? '#ffaa30'
                    : r < 0.78 ? '#ff5010'
                    : '#c03010';
        state.particles.push({
          x: this.x + Math.cos(ang) * dist,
          y: this.y + Math.sin(ang) * dist,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - rand(8, 35),
          life, maxLife: life,
          color, size: rand(2.5, 8), realtime: true,
        });
      }
      // Sparse smoke trailing behind the flame
      if (Math.random() < 0.4) {
        const ang = this.facing + rand(-halfArc * 0.6, halfArc * 0.6);
        const d   = rand(55, coneRange * 0.75);
        state.particles.push({
          x: this.x + Math.cos(ang) * d, y: this.y + Math.sin(ang) * d,
          vx: rand(-12, 12), vy: rand(-28, -8),
          life: rand(0.5, 1.1), maxLife: 1.1,
          color: `rgba(70, 55, 45, ${rand(0.18, 0.38)})`, size: rand(6, 15), realtime: true,
        });
      }
    }

    // Mill/Vortex spin arc — drawn around the orbiting center
    if (this.millTimer > 0 || this.vortexTimer > 0) {
      const isVortex = this.vortexTimer > 0;
      const t  = isVortex ? this.vortexTimer : this.millTimer;
      const cx = isVortex ? this.vortexCenterX : this.millCenterX;
      const cy = isVortex ? this.vortexCenterY : this.millCenterY;
      const radius = isVortex ? 100 : 80;
      ctx.strokeStyle = `rgba(255, 180, 60, ${Math.min(1, t * 1.4)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 220, 80, ${Math.min(0.5, t * 0.7)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.swing > 0.3 && this._wDef.type !== 'thrown' && !(this.type === 'dick' && this.boomerang !== null)) {
      const swingArc = this.swing > 0 ? Math.sin((1 - this.swing) * Math.PI) * 2.2 - 1.1 : 0;
      const clubBase = this.facing - 0.4 + swingArc;
      const a = (this.swing - 0.3) * 0.8;
      ctx.strokeStyle = `rgba(230, 220, 200, ${a})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 22, clubBase - 1.4, clubBase + 0.4);
      ctx.stroke();
    }

    const barW = 24, barH = 3.5;
    const barX = this.x - barW / 2;
    const barY = this.y - this.r - 11;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    const hpPct = this.hp / this.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#7aa853' : hpPct > 0.25 ? '#c5a247' : '#a83a2a';
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    if (this.weaponTimer > 0) {
      const wDef = this._wDef;
      const pulse = 0.6 + Math.sin(state.time * 8) * 0.4;
      const isRanged = wDef.type === 'ranged';
      ctx.strokeStyle = isRanged ? `rgba(255,154,48,${pulse})` : `rgba(232,224,96,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = 'bold 8px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = isRanged ? '#ff9a30' : '#e8e060';
      const icon = isRanged ? '🔫' : '⚔';
      ctx.fillText(`${icon} ${this.weaponTimer.toFixed(0)}s`, this.x, barY - 4);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  _drawFlyingBoomerang(ctx) {
    const b = this.boomerang;
    if (!b) return;
    const angle = state.time * 14;
    ctx.save();
    ctx.translate(b.clubX, b.clubY);
    ctx.rotate(angle);
    // Shaft
    ctx.strokeStyle = '#5a3510';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    ctx.strokeStyle = '#9a6530';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    // Blade at tip
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(16 + Math.cos(1.1) * 12, Math.sin(1.1) * 12);
    ctx.stroke();
    ctx.strokeStyle = '#7a4520';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(16 + Math.cos(1.1) * 12, Math.sin(1.1) * 12);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  _drawEliott(ctx, flashBoost) {
    const p = this.palette;
    ctx.fillStyle = p.shorts;
    ctx.beginPath();
    ctx.ellipse(0, this.r * 0.55, this.r * 0.8, this.r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0f06';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.strokeStyle = '#5a3a20';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-4, this.r * 0.55);
    ctx.lineTo(-4, this.r * 0.75);
    ctx.stroke();

    ctx.fillStyle = flashBoost > 0 ? '#ffa090' : (this.stonedTimer > 0 ? '#60a060' : p.shirt);
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0f06';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = p.acc1;
    this._flower(ctx, -4, -3, 1.6);
    this._flower(ctx, 5, 2, 1.4);
    this._flower(ctx, -2, 5, 1.3);
    ctx.fillStyle = p.acc2;
    ctx.beginPath();
    ctx.ellipse(4, -4, 2.2, 1.1, 0.6, 0, Math.PI * 2);
    ctx.ellipse(-5, 3, 2, 1, -0.4, 0, Math.PI * 2);
    ctx.ellipse(2, -1, 1.6, 0.8, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.acc3;
    ctx.beginPath();
    ctx.arc(-4, -3, 0.5, 0, Math.PI * 2);
    ctx.arc(5, 2, 0.4, 0, Math.PI * 2);
    ctx.arc(-2, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(2, 3, this.r * 0.9, -0.3, 1.8);
    ctx.lineTo(0, 0);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120, 30, 60, 0.6)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.25, this.r * 0.35, 0.4, Math.PI - 0.4);
    ctx.stroke();

    ctx.fillStyle = flashBoost > 0 ? '#ffcaba' : (this.stonedTimer > 0 ? '#80b080' : p.skin);
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.6, this.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0f06';
    ctx.stroke();

    ctx.fillStyle = p.hat;
    ctx.beginPath();
    ctx.ellipse(0, -this.r * 0.58, this.r * 0.88, this.r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = p.hatTop;
    ctx.beginPath();
    ctx.ellipse(0, -this.r * 0.82, this.r * 0.55, this.r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.hatBand;
    ctx.fillRect(-this.r * 0.55, -this.r * 0.66, this.r * 1.1, 1.6);

    ctx.fillStyle = '#1a0f06';
    ctx.fillRect(-2.5, -this.r * 0.48, 1.3, 1);
    ctx.fillRect(1.2, -this.r * 0.48, 1.3, 1);
    ctx.strokeStyle = '#6a3020';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.38, 1.2, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  _flower(ctx, cx, cy, r) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawDick(ctx, flashBoost) {
    const p = this.palette;
    ctx.fillStyle = p.skinDark;
    ctx.beginPath();
    ctx.ellipse(0, this.r * 0.6, this.r * 0.7, this.r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = flashBoost > 0 ? '#ffb8a0' : p.skin;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0f06';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.strokeStyle = p.skinShade;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -this.r * 0.45);
    ctx.lineTo(0, this.r * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-this.r * 0.25, -this.r * 0.05, this.r * 0.3, 0, Math.PI, false);
    ctx.arc(this.r * 0.25, -this.r * 0.05, this.r * 0.3, 0, Math.PI, false);
    ctx.stroke();
    ctx.strokeStyle = p.skinShade;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-2, this.r * 0.25); ctx.lineTo(2, this.r * 0.25);
    ctx.moveTo(-2, this.r * 0.45); ctx.lineTo(2, this.r * 0.45);
    ctx.stroke();

    ctx.fillStyle = p.skinShade;
    ctx.beginPath();
    ctx.arc(-3, -this.r * 0.15, 0.7, 0, Math.PI * 2);
    ctx.arc(3, -this.r * 0.15, 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(50, 30, 15, 0.5)';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(rand(-3, 3), rand(-2, 2), 0.7, 0.7);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(2, 3, this.r * 0.9, -0.3, 1.8);
    ctx.lineTo(0, 0);
    ctx.fill();

    ctx.save();
    ctx.translate(0, -this.r * 0.6);
    ctx.rotate(this.facing);
    ctx.fillStyle = p.cap;
    ctx.beginPath();
    ctx.ellipse(this.r * 0.45, 0, this.r * 0.38, this.r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0604';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = flashBoost > 0 ? '#ffcaba' : p.skin;
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.6, this.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0f06';
    ctx.stroke();

    ctx.fillStyle = p.cap;
    ctx.beginPath();
    ctx.ellipse(0, -this.r * 0.78, this.r * 0.55, this.r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0604';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = p.capTop;
    ctx.beginPath();
    ctx.ellipse(-1, -this.r * 0.88, this.r * 0.3, this.r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.capBtn;
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.92, 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.rageTimer > 0 ? '#ff4020' : '#1a0f06';
    if (this.rageTimer > 0) { ctx.shadowColor = '#ff4020'; ctx.shadowBlur = 4; }
    ctx.fillRect(-2.8, -this.r * 0.52, 1.5, 1.2);
    ctx.fillRect(1.3, -this.r * 0.52, 1.5, 1.2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#2a1a08';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-3, -this.r * 0.62);
    ctx.lineTo(-1.5, -this.r * 0.58);
    ctx.moveTo(3, -this.r * 0.62);
    ctx.lineTo(1.5, -this.r * 0.58);
    ctx.stroke();
  }

  _drawHabib(ctx, flashBoost) {
    const p = this.palette;
    ctx.fillStyle = p.shorts;
    ctx.beginPath();
    ctx.ellipse(0, this.r * 0.55, this.r * 0.88, this.r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0f06';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = p.shortsShade;
    ctx.beginPath();
    ctx.ellipse(1.5, this.r * 0.7, this.r * 0.7, this.r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6a1515';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(0, this.r * 0.4, this.r * 0.85, this.r * 0.2, 0, Math.PI * 0.15, Math.PI - Math.PI * 0.15);
    ctx.stroke();

    ctx.fillStyle = flashBoost > 0 ? '#ffcabc' : p.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0f06';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = p.shirtShade;
    ctx.beginPath();
    ctx.arc(2, 3, this.r * 0.9, -0.3, 1.8);
    ctx.lineTo(0, 0);
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = p.shirtShade;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-2.3, -this.r * 0.35);
    ctx.lineTo(0, -this.r * 0.18);
    ctx.lineTo(2.3, -this.r * 0.35);
    ctx.stroke();

    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(-this.r + 1, -0.5, 2.2, 0, Math.PI * 2);
    ctx.arc(this.r - 1, -0.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0f06';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (this.abilityCd <= 0) {
      ctx.strokeStyle = `rgba(160, 200, 255, ${0.3 + Math.sin(state.time * 8) * 0.2})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-4, -3); ctx.lineTo(-2, -1); ctx.lineTo(-4, 1);
      ctx.moveTo(3, -2);  ctx.lineTo(5, 0);   ctx.lineTo(3, 2);
      ctx.stroke();
    }

    ctx.fillStyle = flashBoost > 0 ? '#ffcaba' : p.skin;
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.6, this.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a0f06';
    ctx.stroke();

    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.8, this.r * 0.5, Math.PI + 0.1, -0.1);
    ctx.fill();
    ctx.fillRect(-1, -this.r * 1.05, 2, 2);

    ctx.fillStyle = '#1a0f06';
    ctx.fillRect(-2.5, -this.r * 0.55, 1.3, 1);
    ctx.fillRect(1.2, -this.r * 0.55, 1.3, 1);
  }

  _drawWeapon(ctx) {
    const wDef = this._wDef;
    if (wDef.shortClub)              this._drawShortClub(ctx);
    else if (wDef.dual)              this._drawDualClubs(ctx);
    else if (wDef.type === 'thrown') this._drawHeldClubs(ctx);
    else if (wDef.type === 'melee')  this._drawLongClub(ctx);
    else if (wDef.type === 'ranged') this._drawHeldClubs(ctx);
  }

  _drawSingleClub(ctx, baseAng, len, scale) {
    scale = scale || 1;
    const gripX = this.x + Math.cos(baseAng - 0.3) * (this.r * 0.7);
    const gripY = this.y + Math.sin(baseAng - 0.3) * (this.r * 0.7);
    const tipX = gripX + Math.cos(baseAng) * len;
    const tipY = gripY + Math.sin(baseAng) * len;

    ctx.strokeStyle = '#3a2510'; ctx.lineWidth = 2.8 * scale; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gripX, gripY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.strokeStyle = '#6b4a20'; ctx.lineWidth = 1 * scale;
    ctx.beginPath(); ctx.moveTo(gripX, gripY); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.strokeStyle = '#1a0f06'; ctx.lineWidth = 3.5 * scale;
    const gx2 = gripX + Math.cos(baseAng) * 5, gy2 = gripY + Math.sin(baseAng) * 5;
    ctx.beginPath(); ctx.moveTo(gripX, gripY); ctx.lineTo(gx2, gy2); ctx.stroke();

    const bladeAng = baseAng + 1.1;
    const bx = tipX + Math.cos(bladeAng) * 7 * scale;
    const by = tipY + Math.sin(bladeAng) * 7 * scale;
    ctx.strokeStyle = '#2a1a08'; ctx.lineWidth = 3.5 * scale;
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = '#8a6b3a'; ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(tipX + Math.cos(bladeAng) * 3, tipY + Math.sin(bladeAng) * 3);
    ctx.lineTo(tipX + Math.cos(bladeAng) * 5, tipY + Math.sin(bladeAng) * 5);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  _drawLongClub(ctx) {
    const swingArc = this.swing > 0 ? Math.sin((1 - this.swing) * Math.PI) * 2.4 - 1.2 : 0;
    const baseAng = this.facing - 0.4 + swingArc;
    this._drawSingleClub(ctx, baseAng, 40, 1.05);
    const gripX = this.x + Math.cos(baseAng - 0.3) * (this.r * 0.7);
    const gripY = this.y + Math.sin(baseAng - 0.3) * (this.r * 0.7);
    ctx.strokeStyle = '#5a2520'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gripX + Math.cos(baseAng) * 9, gripY + Math.sin(baseAng) * 9);
    ctx.lineTo(gripX + Math.cos(baseAng) * 14, gripY + Math.sin(baseAng) * 14);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  _drawShortClub(ctx) {
    const swingArc = this.swing > 0 ? Math.sin((1 - this.swing) * Math.PI) * 2.0 - 1.0 : 0;
    const baseAng = this.facing - 0.3 + swingArc;
    this._drawSingleClub(ctx, baseAng, 26, 0.8);
  }

  _drawDualClubs(ctx) {
    const swingArc = this.swing > 0 ? Math.sin((1 - this.swing) * Math.PI) * 2.2 - 1.1 : 0;
    const sideSign = this.dualSide ? 1 : -1;
    const activeAng = this.facing - 0.4 * sideSign + swingArc * sideSign;
    const idleAng = this.facing - 0.4 * (-sideSign);
    const idleResting = idleAng + 0.5 * (-sideSign);
    this._drawSingleClub(ctx, idleResting, 22, 0.85);
    this._drawSingleClub(ctx, activeAng, 22, 1);
  }

  _drawHeldClubs(ctx) {
    const throwBoost = this.throwArm;
    const backAng = this.facing - 0.7;
    const backX = this.x + Math.cos(backAng) * (this.r * 0.6);
    const backY = this.y + Math.sin(backAng) * (this.r * 0.6);
    const backTipX = backX + Math.cos(backAng - 0.5) * 9;
    const backTipY = backY + Math.sin(backAng - 0.5) * 9;
    ctx.strokeStyle = '#3a2510'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(backX, backY); ctx.lineTo(backTipX, backTipY); ctx.stroke();
    ctx.strokeStyle = '#1a0f06'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(backX, backY);
    ctx.lineTo(backX + Math.cos(backAng - 0.5) * 3, backY + Math.sin(backAng - 0.5) * 3);
    ctx.stroke();

    const forwardAng = this.facing + (throwBoost > 0 ? 0 : 0.5);
    const reach = this.r * 0.6 + throwBoost * 6;
    const frontX = this.x + Math.cos(forwardAng) * reach;
    const frontY = this.y + Math.sin(forwardAng) * reach;
    if (throwBoost < 0.7) {
      const frontTipX = frontX + Math.cos(forwardAng - 0.3) * 9;
      const frontTipY = frontY + Math.sin(forwardAng - 0.3) * 9;
      ctx.strokeStyle = '#3a2510'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(frontX, frontY); ctx.lineTo(frontTipX, frontTipY); ctx.stroke();
      ctx.strokeStyle = '#1a0f06'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(frontX, frontY);
      ctx.lineTo(frontX + Math.cos(forwardAng - 0.3) * 3, frontY + Math.sin(forwardAng - 0.3) * 3);
      ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(200, 200, 220, ${(throwBoost - 0.7) * 1.5})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(frontX, frontY);
      ctx.lineTo(frontX + Math.cos(forwardAng) * 8, frontY + Math.sin(forwardAng) * 8);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
}
