import { G } from '../globals.js';
import { rand, dist2, clamp } from '../utils/math.js';
import { state } from '../state.js';
import { HERO_DEFS, DEFAULT_PICKUP_R } from '../config/heroes.js';
import { WEAPON_DEFS, resolveWeaponStats } from '../config/weapons.js';
import { DIFFICULTY_DEFS } from '../config/difficulty.js';
import { resolveAsset } from '../config/assets.js';
import { Projectile } from './Projectile.js';
import { ShotgunBullet } from './ShotgunBullet.js';
import { playSfx } from '../systems/audio.js';
import { pushDamageNumber } from '../render/effects.js';
import { ABILITY_DEFS, WEAPON_XP_CONFIG, HERO_ABILITY_TREES, ACID_CONFIG, TINKERING_SLOW_CONFIG, applyCombos, COMBO_WINDOW } from '../config/abilities.js';
import { isWalkable, nearestWalkable, terrainSpeedMult } from '../utils/terrain.js';
import { drawWeaponSprite } from '../render/weaponSprites.js';

export class Unit {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.tx = x; this.ty = y;
    this.z = 0;
    this.vz = 0;
    this.r = 13;
    this.speed = 78;
    this.hp = 100; this.maxHp = 100;
    this.selected = false;
    this.swing = 0;
    this.facing = 0;
    this.walkCycle = 0;
    this.dead = false;
    this.aggroTarget = null;
    this.hurtFlash = 0;

    this.type = type;
    this.abilityCd = 0;
    this.superboostCharge = 0;  // 0..1; charges on each base ability cast; 1 = ready for group combo

    // Ability tree levels: tree 1 starts at 1 (active at game start); trees 2 & 3 start locked (0)
    this.abilityTrees = { 1: 1, 2: 0, 3: 0 };

    // Cooldowns for tree 2 and tree 3 secondary abilities
    this.treeCd  = { 2: 0, 3: 0 };

    // Per-hero Weapon XP: fills from damage dealt; triggers weapon level-up when threshold crossed
    this.weaponXp = 0;
    this.weaponXpThreshold = WEAPON_XP_CONFIG.startThreshold;
    this.weaponXpPicks = 0;
    this.rageTimer = 0;
    this.blinkFlash = 0;
    this.dualSide = false;
    this.throwArm = 0;
    this.weaponSlots = null;   // initialised after def lookup below
    this._previousSlot0 = null;
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
    this._wpHitPending = null;   // White Powder of Hit delayed blink (stagger)
    this._dominanceTargets = null;
    this._dominanceOrigin = null;
    this._dominanceTimer = 0;
    this._dominanceGroupBlink = false;  // Potato Starch: group blink after dominance completes
    this.stonedAcidExplosion = false;   // Overcharged Pipe: acid explosion on stoned expiry

    // Medkit over-time heal
    this.medkitHealRemaining = 0;  // HP remaining to be healed
    this.medkitHealPerSec    = 0;  // HP/s rate

    // Dick boomerang state
    this.boomerang  = null; // {startX, startY, targetX, targetY, phase, t, clubX, clubY, hitOut, hitRet, ellipseWidth?}
    this.boomerang2 = null; // second boomerang for dual_boomerangs (L3)

    // Dick Dance of Death state
    this.danceOfDeathTimer    = 0;
    this.danceOfDeathCenterX  = 0;
    this.danceOfDeathCenterY  = 0;
    this.danceOfDeathAngle    = 0;
    this._danceOfDeathTargetX = 0;
    this._danceOfDeathTargetY = 0;
    this.danceOfDeathPullR    = 90;    // pull radius (configurable via ability params)
    this.danceOfDeathSlamDmg  = 120;   // slam damage on leap
    this.danceOfDeathStunDur  = 2.0;   // post-slam stun duration

    // Dick Transgender Talk state
    this.transgenderTalkTimer  = 0;
    this.transgenderTalkRadius = 250;
    this._tTalkStunCd          = 0;    // stun re-application cooldown

    // Habib Backdoor Blockade L2/L3 retaliation (and combo augments)
    this.blockadeStunOnHit    = 0;    // stun duration applied to attacker (L2)
    this.blockadeFireOnHitDmg = 0;    // fire damage applied to attacker (L3)
    this.blockadeFireOnHitBurn = 0;   // burn timer applied to attacker (L3)
    this.blockadeSlowOnHit    = 0;    // slow duration for attacker (combo: Green Pipe L2)
    this.blockadeKbOnHit      = 0;    // knockback force for attacker (combo: White Powder)
    this.blockadeAcidOnHit    = false;// acid on attacker (combo: White Powder L3)

    // Combo detection — set by castTree(), read by cast() to detect active secondaries
    this.comboTimer = { 2: 0, 3: 0 };  // how long secondary window stays active
    this.comboLevel = { 2: 0, 3: 0 };  // tree level when the window was opened
    this._lastBlinkDest = null;         // landing position stored for blink combos

    // Habib Acid Slingshot burst state
    this.acidSlingshotShots    = 0;   // remaining shots in burst
    this.acidSlingshotCd       = 0;   // fire rate cooldown
    this.acidSlingshotInterval = 0.15;

    // Habib Weapon Effects window state
    this.weaponEffectTimer    = 0;    // duration remaining
    this.weaponEffectType     = '';   // 'flame' | 'stun' | 'lightning'
    this.weaponEffectChance   = 0;    // 0–1 triggerChance
    this.weaponEffectParams   = null; // {damage, burnTimer} | {stunTime} | {chainCount}

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
    this.weaponSlots = [
      { key: def.startingWeapon || 'hockey_club', level: 1, atkCd: 0 },
      null,
      null,
    ];
    this.maxHp = Math.round(def.maxHp * diff.hero.hpMult);
    this.hp = this.maxHp;
    this.pickupR = def.pickupR ?? DEFAULT_PICKUP_R;
    this.palette = { ...def.palette };
  }

  get _wDef() { return WEAPON_DEFS[this.weaponSlots[0]?.key] ?? {}; }

  // Highest-index filled slot — the "most recently equipped" weapon used for visuals.
  get _displaySlot() {
    for (let i = this.weaponSlots.length - 1; i >= 0; i--) {
      if (this.weaponSlots[i]) return this.weaponSlots[i];
    }
    return null;
  }
  get _displayWDef() { return WEAPON_DEFS[this._displaySlot?.key] ?? {}; }
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
    this._tickAnim(dt);
    if (this.dead) return;

    if (this.z > 0 || this.vz !== 0) {
      this.vz -= 800 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; }
    }

    // Tick all timers
    this.rageTimer        = Math.max(0, this.rageTimer - dt);
    this.abilityCd        = Math.max(0, this.abilityCd - dt);
    this.treeCd[2]        = Math.max(0, (this.treeCd[2] ?? 0) - dt);
    this.treeCd[3]        = Math.max(0, (this.treeCd[3] ?? 0) - dt);
    this.immortalTimer    = Math.max(0, this.immortalTimer - dt);
    const _prevBlockade = this.blockadeTimer;
    this.blockadeTimer    = Math.max(0, this.blockadeTimer - dt);
    if (_prevBlockade > 0 && this.blockadeTimer <= 0) {
      this.blockadeStunOnHit    = 0;
      this.blockadeFireOnHitDmg = 0;
      this.blockadeFireOnHitBurn = 0;
      this.blockadeSlowOnHit    = 0;
      this.blockadeKbOnHit      = 0;
      this.blockadeAcidOnHit    = false;
    }
    this.alchemyArmorTimer= Math.max(0, this.alchemyArmorTimer - dt);
    this.speedBoostTimer  = Math.max(0, this.speedBoostTimer - dt);
    this.storiesRateBoost = Math.max(0, this.storiesRateBoost - dt);
    const _prevStoned = this.stonedTimer;
    this.stonedTimer      = Math.max(0, this.stonedTimer - dt);
    if (_prevStoned > 0 && this.stonedTimer <= 0) {
      // Overcharged Pipe (L3): acid explosion before blink-back
      if (this.stonedAcidExplosion) {
        this.stonedAcidExplosion = false;
        const acidRadius = 130;
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (dist2(this.x, this.y, e.x, e.y) < acidRadius) {
            e.hp -= 25;
            e.acidDot = Math.max(e.acidDot || 0, 4);
            e.acidDotDmg = ACID_CONFIG.dotDamage;
            e.acidInterval = ACID_CONFIG.dotInterval;
            e.hurtFlash = 0.7;
          }
        }
        for (let i = 0; i < 22; i++) {
          const a = rand(0, Math.PI * 2), v = rand(50, 130);
          state.particles.push({ x: this.x, y: this.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: rand(0.4, 0.8), maxLife: 0.8, color: i % 2 ? '#40ff40' : '#80ff60', size: rand(1.5, 3), realtime: true });
        }
      }
      let closestAlly = null, closestDist = Infinity;
      for (const ally of state.units) {
        if (ally === this || ally.dead) continue;
        const d = dist2(this.x, this.y, ally.x, ally.y);
        if (d < closestDist) { closestDist = d; closestAlly = ally; }
      }
      if (closestAlly) {
        const ang = rand(0, Math.PI * 2);
        const off = closestAlly.r + this.r + 8;
        this.x = clamp(closestAlly.x + Math.cos(ang) * off, 6, G.WORLD_W - 6);
        this.y = clamp(closestAlly.y + Math.sin(ang) * off, 6, G.WORLD_H);
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
    const _prevDance  = this.danceOfDeathTimer;
    this.danceOfDeathTimer = Math.max(0, this.danceOfDeathTimer - dt);
    this.transgenderTalkTimer = Math.max(0, this.transgenderTalkTimer - dt);
    this._tTalkStunCd = Math.max(0, this._tTalkStunCd - dt);
    this.weaponEffectTimer = Math.max(0, this.weaponEffectTimer - dt);
    this.comboTimer[2] = Math.max(0, (this.comboTimer[2] ?? 0) - dt);
    this.comboTimer[3] = Math.max(0, (this.comboTimer[3] ?? 0) - dt);

    // Acid Slingshot burst — fire remaining shots
    if (this.acidSlingshotShots > 0) {
      this.acidSlingshotCd = Math.max(0, this.acidSlingshotCd - dt);
      if (this.acidSlingshotCd <= 0) {
        let nearest = null, nd = Infinity;
        for (const e of state.enemies) {
          if (e.dead) continue;
          const d = dist2(this.x, this.y, e.x, e.y);
          if (d < nd) { nd = d; nearest = e; }
        }
        if (nearest) {
          const ang = Math.atan2(nearest.y - this.y, nearest.x - this.x) + rand(-0.2, 0.2);
          state.acidShots = state.acidShots || [];
          state.acidShots.push({
            x: this.x + Math.cos(ang) * (this.r + 4),
            y: this.y + Math.sin(ang) * (this.r + 4),
            vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
            life: 2.0, maxLife: 2.0, dead: false,
            owner: this,
            damage: ACID_CONFIG.initialDamage ?? 18,
            acidDuration: 4,
            slowFactor: TINKERING_SLOW_CONFIG.factor,
            slowDuration: TINKERING_SLOW_CONFIG.duration,
          });
        }
        this.acidSlingshotShots--;
        this.acidSlingshotCd = this.acidSlingshotInterval;
      }
    }

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
      if (md > 2) { const s = Math.min(md, this.speed * dt); this.millCenterX = clamp(this.millCenterX + mdx / md * s, 6, G.WORLD_W - 6); this.millCenterY = clamp(this.millCenterY + mdy / md * s, 6, G.WORLD_H); }
      this.x = clamp(this.millCenterX + Math.cos(this.millAngle) * orbitR, 6, G.WORLD_W - 6);
      this.y = clamp(this.millCenterY + Math.sin(this.millAngle) * orbitR, 6, G.WORLD_H);
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
      if (vd > 2) { const s = Math.min(vd, this.speed * dt); this.vortexCenterX = clamp(this.vortexCenterX + vdx / vd * s, 6, G.WORLD_W - 6); this.vortexCenterY = clamp(this.vortexCenterY + vdy / vd * s, 6, G.WORLD_H); }
      this.x = clamp(this.vortexCenterX + Math.cos(this.vortexAngle) * orbitR, 6, G.WORLD_W - 6);
      this.y = clamp(this.vortexCenterY + Math.sin(this.vortexAngle) * orbitR, 6, G.WORLD_H);
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

    // Dance of Death: Dick orbits a circle (larger than Vortex), enemies sucked
    // toward the orbit center like a black hole, Dick is immortal; slam on expiry.
    if (this.danceOfDeathTimer > 0) {
      this.immortalTimer = Math.max(this.immortalTimer, dt + 0.05);
      this.danceOfDeathAngle += dt * 3.5;
      const orbitR = 68;
      const ddx = this._danceOfDeathTargetX - this.danceOfDeathCenterX;
      const ddy = this._danceOfDeathTargetY - this.danceOfDeathCenterY;
      const ddd = Math.hypot(ddx, ddy);
      if (ddd > 2) {
        const s = Math.min(ddd, this.speed * dt);
        this.danceOfDeathCenterX = clamp(this.danceOfDeathCenterX + ddx / ddd * s, 6, G.WORLD_W - 6);
        this.danceOfDeathCenterY = clamp(this.danceOfDeathCenterY + ddy / ddd * s, 6, G.WORLD_H);
      }
      this.x  = clamp(this.danceOfDeathCenterX + Math.cos(this.danceOfDeathAngle) * orbitR, 6, G.WORLD_W - 6);
      this.y  = clamp(this.danceOfDeathCenterY + Math.sin(this.danceOfDeathAngle) * orbitR, 6, G.WORLD_H);
      this.tx = this.x; this.ty = this.y;
      this.facing = this.danceOfDeathAngle + Math.PI * 0.5;
      const pullForce = 130 * dt;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const dx = this.danceOfDeathCenterX - e.x;
        const dy = this.danceOfDeathCenterY - e.y;
        const d  = Math.hypot(dx, dy);
        if (d < this.danceOfDeathPullR && d > 1) {
          e.knockX += (dx / d) * pullForce;
          e.knockY += (dy / d) * pullForce;
        }
      }
    }
    if (_prevDance > 0 && this.danceOfDeathTimer <= 0) {
      // Slam: leap to center, damage all nearby, stun survivors
      this.x = this.danceOfDeathCenterX;
      this.y = this.danceOfDeathCenterY;
      this.tx = this.x; this.ty = this.y;
      this.vz = 220; this.z = 0; this.blinkFlash = 1;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(this.x, this.y, e.x, e.y) < 80 + e.r) {
          e.hp -= this.danceOfDeathSlamDmg;
          e.hurtFlash = 1;
          const ang = Math.atan2(e.y - this.y, e.x - this.x);
          e.knockX += Math.cos(ang) * 200;
          e.knockY += Math.sin(ang) * 200;
          if (e.hp > 0) e.stunTimer = Math.max(e.stunTimer, this.danceOfDeathStunDur);
          pushDamageNumber(e.x, e.y - e.r - 4, this.danceOfDeathSlamDmg, { crit: true, rgb: [255, 80, 20] });
        }
      }
      for (let i = 0; i < 30; i++) {
        const a = rand(0, Math.PI * 2), v = rand(80, 200);
        state.particles.push({ x: this.x, y: this.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(0.4, 0.9), maxLife: 0.9, color: i % 2 ? '#ff3010' : '#ffb030', size: rand(2, 4), realtime: true });
      }
      if (!state.settings.noShake) { state.shake = Math.max(state.shake, 14); state.hitStop = Math.max(state.hitStop, 0.08); }
    }

    // Transgender Talk: re-apply stun to nearby enemies every 0.4s
    if (this.transgenderTalkTimer > 0 && this._tTalkStunCd <= 0) {
      this._tTalkStunCd = 0.4;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist2(this.x, this.y, e.x, e.y) < this.transgenderTalkRadius) {
          e.stunTimer = Math.max(e.stunTimer, 0.6);
        }
      }
    }

    if (this.speedBoostTimer <= 0 && this.alchemyRageMult !== 1) this.alchemyRageMult = 1;

    // Tick active skill cooldowns
    for (const slot of this.upgradeSlots) {
      if (slot?.kind === 'active') slot.cd = Math.max(0, slot.cd - dt);
    }

    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) {
        if (this._previousSlot0) {
          this.weaponSlots[0] = { ...this._previousSlot0, atkCd: 0 };
          this._previousSlot0 = null;
        }
        this.weaponTimer = 0;
      }
    }

    // White Powder of Hit stagger delay → fires the outbound blink after a random delay
    if (this._wpHitPending) {
      this._wpHitPending.delay -= dt;
      if (this._wpHitPending.delay <= 0) {
        const { bx, by, origX, origY, nearest, dmg } = this._wpHitPending;
        this._wpHitPending = null;
        if (nearest && !nearest.dead) {
          this.x = bx; this.y = by; this.tx = bx; this.ty = by;
          this.blinkFlash = 1;
          this.immortalTimer = Math.max(this.immortalTimer || 0, 0.6);
          playSfx('ability.blink');
          nearest.hp -= dmg;
          nearest.hurtFlash = 1;
          playSfx(this._wDef.sfxAttack || 'weapon.attack.default', { fallback: this._wDef.sfxFallback || 'weapon.attack.default' });
          playSfx('alien.hit.default');
          pushDamageNumber(nearest.x, nearest.y - nearest.r - 4, dmg, { crit: true, rgb: [240, 220, 100] });
          this._wpHitReturn = { timer: 0.3, x: origX, y: origY };
          for (let _i = 0; _i < 8; _i++) {
            const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 60;
            state.particles.push({ x: bx, y: by, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: 0.25+Math.random()*0.25, maxLife: 0.5, color: _i%2?'#ffffff':'#ffe0ff', size: 1+Math.random()*2, realtime: true });
          }
        }
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
          this.x = clamp(e.x + Math.cos(ang) * 28, 6, G.WORLD_W - 6);
          this.y = clamp(e.y + Math.sin(ang) * 28, 6, G.WORLD_H);
          this.tx = this.x; this.ty = this.y;
          this.blinkFlash = 0.7;
          const dmg = Math.round(this.atkDmg * (this.upgradeDmgMult || 1));
          e.hp -= dmg;
          e.hurtFlash = 1;
          // SOUND POINT 3 — CHAIN STRIKE: blink whoosh + hero's weapon hit, every 0.25 s.
          playSfx('ability.blink');
          playSfx(this._wDef.sfxAttack || 'weapon.attack.default', { fallback: this._wDef.sfxFallback || 'weapon.attack.default' });
          playSfx('alien.hit.default');
          pushDamageNumber(e.x, e.y - e.r - 4, dmg, { crit: true, rgb: [240, 220, 100] });
        }
        this._dominanceTimer = 0.25;
        if (this._dominanceTargets.length === 0) {
          if (this._dominanceOrigin) {
            this.x = clamp(this._dominanceOrigin.x, 6, G.WORLD_W - 6);
            this.y = clamp(this._dominanceOrigin.y, 6, G.WORLD_H);
            this.tx = this.x; this.ty = this.y;
            this._dominanceOrigin = null;
          }
          this._dominanceTargets = null;
          this.blinkFlash = 1;
          // Potato Starch (L3): trigger group blink to this unit's move destination
          if (this._dominanceGroupBlink) {
            this._dominanceGroupBlink = false;
            ABILITY_DEFS.group_blink.activate(this);
          }
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
    // Push-out: if inside a non-walkable tile (blink, knockback, etc.), snap to nearest walkable
    if (!isWalkable(this.x, this.y)) {
      const w = nearestWalkable(this.x, this.y);
      this.x = w.x; this.y = w.y;
      this.tx = w.x; this.ty = w.y;
    }

    const effectiveSpeed = this.speed * (this.speedBoostTimer > 0 ? 1.8 : 1) * terrainSpeedMult(this.x, this.y);
    if (this.moving) {
      const dx = this.tx - this.x, dy = this.ty - this.y;
      const d = Math.hypot(dx, dy);
      this.facing = Math.atan2(dy, dx);
      const step = effectiveSpeed * dt;
      if (step >= d) { this.x = this.tx; this.y = this.ty; }
      else {
        const nx = this.x + (dx / d) * step;
        const ny = this.y + (dy / d) * step;
        if (isWalkable(nx, ny)) {
          this.x = nx; this.y = ny;
        } else if (isWalkable(nx, this.y)) {
          this.x = nx;                        // slide along X axis
        } else if (isWalkable(this.x, ny)) {
          this.y = ny;                        // slide along Y axis
        } else {
          this.tx = this.x; this.ty = this.y; // fully blocked — cancel move
        }
      }
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

    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
    this.swing = Math.max(0, this.swing - dt * 6);
    this.blinkFlash = Math.max(0, this.blinkFlash - dt * 2.5);
    this.throwArm = Math.max(0, this.throwArm - dt * 4);

    // Dick boomerang update
    if (this.type === 'dick' && this.boomerang !== null) {
      this._updateBoomerang(dt, this.boomerang, 'primary');
    }
    if (this.type === 'dick' && this.boomerang2 !== null) {
      this._updateBoomerang(dt, this.boomerang2, 'secondary');
    }

    // Auto-attack: iterate all filled weapon slots independently (skip while Dick is boomeranging)
    if (!(this.type === 'dick' && this.boomerang !== null)) {
      for (let i = 0; i < this.weaponSlots.length; i++) {
        const slot = this.weaponSlots[i];
        if (!slot) continue;
        slot.atkCd -= dt;
        if (slot.atkCd > 0) continue;

        const stats = resolveWeaponStats(slot);
        const target = this._findTarget(stats.atkRange);
        if (!target) continue;

        this.attack(target, stats);
        slot.atkCd = this._slotAtkRate(stats);
      }
    }

  }

  // which: 'primary' | 'secondary' — determines which field is nulled on completion
  _updateBoomerang(dt, b, which) {
    const speed = b.phase === 'outbound' ? 260 : 300;
    const ellipseW = b.ellipseWidth ?? 80;

    const ex = b.phase === 'outbound' ? b.targetX : this.x;
    const ey = b.phase === 'outbound' ? b.targetY : this.y;
    const dx = ex - (b.phase === 'outbound' ? b.startX : b.targetX);
    const dy = ey - (b.phase === 'outbound' ? b.startY : b.targetY);
    const totalDist = Math.hypot(dx, dy);

    if (totalDist < 1) { this._boomerangPhaseEnd(which); return; }

    const perpX = -dy / totalDist * ellipseW;
    const perpY =  dx / totalDist * ellipseW;
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

    // Update trail: push current position, cap at 18 points.
    if (!b._trail) b._trail = [];
    b._trail.push({ x: b.clubX, y: b.clubY });
    if (b._trail.length > 18) b._trail.shift();

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
        playSfx(this._wDef.sfxAttack || 'weapon.attack.default', { fallback: this._wDef.sfxFallback || 'weapon.attack.default' });
        playSfx('alien.hit.default');
        pushDamageNumber(e.x, e.y - e.r - 4, dmg, { rgb: [210, 185, 130] });
        for (let i = 0; i < 6; i++) {
          state.particles.push({ x: e.x + rand(-3,3), y: e.y + rand(-3,3), vx: rand(-70,70), vy: rand(-90,-10), life: rand(0.2,0.5), maxLife: 0.5, color: e.bloodColor, size: rand(1.2, 2.5), realtime: true });
        }
        // Apply boomerang combo hit effects (attached by applyCombos)
        if (b.comboHitFns?.length) {
          for (const cfn of b.comboHitFns) cfn(e, b.clubX, b.clubY, this);
        }
      }
    }

    if (b.t >= 1) this._boomerangPhaseEnd(which);
  }

  _boomerangPhaseEnd(which) {
    const b = which === 'secondary' ? this.boomerang2 : this.boomerang;
    if (!b) return;
    if (b.phase === 'outbound') {
      b.phase = 'return';
      b.t = 0;
    } else {
      if (which === 'secondary') {
        this.boomerang2 = null;
      } else {
        this.boomerang = null;
        this.abilityCd = this.abilityMaxCd;
      }
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

  _getDir() {
    const dx = Math.cos(this.facing);
    const dy = Math.sin(this.facing);
    if (dx >= 0) return dy >= 0 ? 'dr' : 'ur';
    return dy >= 0 ? 'dl' : 'ul';
  }

  _animName() {
    if (this.dead) return 'death';
    const dir = this._getDir();
    if (this.moving) return `walk_${dir}`;
    return `idle_${dir}`;
  }

  _tickAnim(dt) {
    const sprite = resolveAsset('heroes', this.type);
    if (!sprite?.isAnimated) return;
    const name = this._animName();
    const anim = sprite.animations[name] || sprite.animations.idle_dr || sprite.animations.idle;
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

  // stats: resolved weapon stats object from resolveWeaponStats(slot).
  // Caller (per-slot loop) sets slot.atkCd after this returns.
  attack(enemy, stats) {
    if (!stats) stats = resolveWeaponStats(this.weaponSlots[0] || { key: 'hockey_club', level: 1 });
    this.facing = Math.atan2(enemy.y - this.y, enemy.x - this.x);
    this.swing = 1;

    if (stats.type === 'ranged') {
      this._attackRanged(stats, enemy);
    } else if (stats.type === 'thrown') {
      this._attackThrown(stats, enemy);
    } else if (stats.cleave) {
      this._attackCleave(stats);
    } else {
      this._attackMelee(stats, enemy);
    }
  }

  _gainWeaponXp(dmg) {
    this.weaponXp += dmg;
    while (this.weaponXp >= this.weaponXpThreshold) {
      this.weaponXp -= this.weaponXpThreshold;
      this.weaponXpThreshold = WEAPON_XP_CONFIG.A * this.weaponXpThreshold + WEAPON_XP_CONFIG.B;
      this.weaponXpPicks = (this.weaponXpPicks || 0) + 1;
      state.pendingLevelUps = (state.pendingLevelUps || 0) + 1;
      if (!state.pendingWeaponUpgrades) state.pendingWeaponUpgrades = [];
      if (!state.pendingWeaponUpgrades.includes(this.type)) {
        state.pendingWeaponUpgrades.push(this.type);
      }
      state._levelUpFlash = 0.9;
      playSfx('ui.levelup');
    }
  }

  // Weapon Effects (Habib Tree 3): if any hero has an active weapon effect window,
  // roll the trigger chance and apply the enchant to the struck enemy.
  _applyWeaponEffect(enemy) {
    if (!enemy || enemy.dead) return;
    let src = null;
    for (const u of state.units) {
      if (!u.dead && u.weaponEffectTimer > 0) { src = u; break; }
    }
    if (!src) return;
    if (Math.random() >= src.weaponEffectChance) return;
    const p = src.weaponEffectParams;
    if (src.weaponEffectType === 'flame') {
      enemy.hp -= p.damage ?? 10;
      enemy.hurtFlash = 0.5;
      enemy.fireDot = Math.max(enemy.fireDot || 0, p.burnTimer ?? 3);
      state.particles.push({ x: enemy.x, y: enemy.y, vx: rand(-40, 40), vy: rand(-80, -20), life: 0.4, maxLife: 0.4, color: '#ff6020', size: rand(2, 4), realtime: true });
    } else if (src.weaponEffectType === 'stun') {
      enemy.stunTimer = Math.max(enemy.stunTimer, p.stunTime ?? 1.2);
      enemy.hurtFlash = 0.4;
    } else if (src.weaponEffectType === 'lightning') {
      const jumps = p.chainCount ?? 3;
      let cx = enemy.x, cy = enemy.y;
      const hit = new Set([enemy]);
      const pts = [{ x: cx, y: cy }];
      for (let i = 0; i < jumps; i++) {
        let next = null, nd = 180;
        for (const e of state.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = dist2(cx, cy, e.x, e.y);
          if (d < nd) { nd = d; next = e; }
        }
        if (!next) break;
        hit.add(next);
        pts.push({ x: next.x, y: next.y });
        next.hp -= 12;
        next.hurtFlash = 0.5;
        cx = next.x; cy = next.y;
      }
      if (pts.length > 1) state.bolts.push({ points: pts, life: 0.35, maxLife: 0.35 });
    }
  }

  _attackMelee(stats, enemy) {
    if (stats.dual) this.dualSide = !this.dualSide;
    if (this.z === 0) this.vz = 120;
    const dmg = Math.round((stats.atkDmg ?? 24) * (this.rageTimer > 0 ? 2 : 1) * (this.upgradeDmgMult || 1));
    const kb = (stats.knockback ?? 80) * (this.rageTimer > 0 ? 1.75 : 1);
    playSfx(stats.sfxAttack || 'weapon.attack.default', { fallback: stats.sfxFallback || 'weapon.attack.default' });
    playSfx(enemy.kind === 'bigboss' || enemy.kind === 'miniboss' ? 'boss.hit.default' : 'alien.hit.default');
    enemy.hp -= dmg;
    this._gainWeaponXp(dmg);
    this._applyWeaponEffect(enemy);
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

  _attackCleave(stats) {
    playSfx(stats.sfxAttack || 'weapon.samurai.attack');
    const halfArc = Math.PI * ((stats.cleaveArc ?? 60) / 180);
    const kb = stats.knockback ?? 120;
    let hit = 0;
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (dist2(this.x, this.y, e.x, e.y) > stats.atkRange + e.r) continue;
      let da = Math.atan2(e.y - this.y, e.x - this.x) - this.facing;
      while (da >  Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > halfArc) continue;
      const dmg = Math.round((stats.atkDmg ?? 24) * (this.rageTimer > 0 ? 2 : 1) * (this.upgradeDmgMult || 1));
      e.hp -= dmg;
      this._gainWeaponXp(dmg);
      this._applyWeaponEffect(e);
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
    if (hit > 0) playSfx('alien.hit.default');
    state.particles.push({ x: this.x + Math.cos(this.facing) * 24, y: this.y + Math.sin(this.facing) * 24, vx: 0, vy: 0, life: 0.18, maxLife: 0.18, color: 'rgba(255,245,200,0.8)', size: 9, realtime: true, additive: true });
    if (!state.settings.noShake) state.shake   = Math.max(state.shake,   hit > 1 ? 4    : 2.5);
    if (hit > 0 && !state.settings.noShake) state.hitStop = Math.max(state.hitStop, hit > 2 ? 0.06 : 0.03);
  }

  _attackThrown(stats, enemy) {
    this.throwArm = 1;
    const sx = this.x + Math.cos(this.facing) * (this.r + 6);
    const sy = this.y + Math.sin(this.facing) * (this.r + 6);
    const dmg = Math.round((stats.atkDmg ?? 24) * (this.rageTimer > 0 ? 2 : 1) * (this.upgradeDmgMult || 1));
    state.projectiles.push(new Projectile(sx, sy, enemy, dmg, this.facing, this, stats));
    if (!state.settings.noShake) state.shake = Math.max(state.shake, 1.5);
  }

  _attackRanged(stats, enemy) {
    this.throwArm = 1;
    playSfx(stats.sfxFire || 'weapon.throw.default');
    const count  = stats.bulletCount ?? 1;
    const spread = stats.spread ?? 0;
    const baseDmg = Math.round((stats.atkDmg ?? 24) * (this.rageTimer > 0 ? 2 : 1) * (this.upgradeDmgMult || 1));
    const dmgPer = count > 1 ? baseDmg * 0.5 : baseDmg;
    for (let i = 0; i < count; i++) {
      const offset = count > 1 ? (i / (count - 1) - 0.5) * spread * 2 : 0;
      const ang = this.facing + offset;
      const sx = this.x + Math.cos(ang) * (this.r + 6);
      const sy = this.y + Math.sin(ang) * (this.r + 6);
      state.projectiles.push(new ShotgunBullet(sx, sy, ang, dmgPer, stats));
    }
    if (!state.settings.noShake) state.shake = Math.max(state.shake, count > 1 ? 2.5 : 1.2);
  }

  _findTarget(range) {
    if (this.aggroTarget && !this.aggroTarget.dead) {
      const d = dist2(this.x, this.y, this.aggroTarget.x, this.aggroTarget.y);
      if (d < range + 40) return this.aggroTarget;
      this.aggroTarget = null;
    }
    let target = null, nd = range;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = dist2(this.x, this.y, e.x, e.y);
      if (d < nd) { nd = d; target = e; }
    }
    return target;
  }

  _slotAtkRate(stats) {
    const base = stats.atkRate ?? 0.5;
    const rageMult = this.rageTimer > 0 ? 0.4 : 1;
    const alchMult = this.rageTimer > 0 ? (1 / Math.max(1, this.alchemyRageMult)) : 1;
    const storiesMult = this.storiesRateBoost > 0 ? (1 / 1.3) : 1;
    return base * rageMult * alchMult * storiesMult * (this.upgradeRateMult || 1);
  }

  grantWeapon(key) {
    const freeIdx = this.weaponSlots.findIndex(s => s === null);
    if (freeIdx === -1) return false;
    this.weaponSlots[freeIdx] = { key, level: 1, atkCd: 0 };
    return true;
  }

  upgradeWeapon(slotIdx) {
    const slot = this.weaponSlots[slotIdx];
    if (!slot) return false;
    slot.level = Math.min(5, slot.level + 1);
    return true;
  }

  moveTo(x, y) {
    if (this.stonedTimer > 0) return;
    // During mill/vortex redirect the destination to the orbit center target
    // so the player can steer the spin with right-click like normal movement.
    if (this.millTimer > 0) {
      this._millTargetX = clamp(x, 6, G.WORLD_W - 6);
      this._millTargetY = clamp(y, 6, G.WORLD_H);
      return;
    }
    if (this.vortexTimer > 0) {
      this._vortexTargetX = clamp(x, 6, G.WORLD_W - 6);
      this._vortexTargetY = clamp(y, 6, G.WORLD_H);
      return;
    }
    let tx = clamp(x, 6, G.WORLD_W - 6);
    let ty = clamp(y, 6, G.WORLD_H - 6);
    if (!isWalkable(tx, ty)) {
      const w = nearestWalkable(tx, ty);
      tx = w.x; ty = w.y;
    }
    this.tx = tx;
    this.ty = ty;
    this.aggroTarget = null;
  }
  attackMove(enemy) {
    if (this.stonedTimer > 0) return;
    this.aggroTarget = enemy;
    this.tx = clamp(enemy.x, 6, G.WORLD_W - 6);
    this.ty = clamp(enemy.y, 6, G.WORLD_H);
  }
  stop() { this.tx = this.x; this.ty = this.y; this.aggroTarget = null; }

  cast() {
    if (this.dead || this.abilityCd > 0) return false;
    // Resolve level-specific ability via tree 1 levelAbilityIds
    const treeDef1 = (HERO_ABILITY_TREES[this.type] || []).find(t => t.treeNum === 1);
    const level1   = this.abilityTrees[1] ?? 1;
    const abilityId = treeDef1?.levelAbilityIds?.[level1 - 1] ?? this.abilityId;
    const def = ABILITY_DEFS[abilityId] ?? ABILITY_DEFS[this.abilityId];
    if (!def?.activate) return false;
    const result = def.activate(this);
    if (result !== false && def.sound) playSfx(def.sound);
    if (result !== false) {
      // Each successful base ability cast grants 20% superboost charge (5 uses = ready)
      this.superboostCharge = Math.min(1, this.superboostCharge + 0.2);
      if (state.devAbilityTest) this.superboostCharge = 1;
      // Check for active secondary combos on teammates
      applyCombos(this);
    }
    return result ?? true;
  }

  // Activate a secondary ability tree (treeNum 2 or 3).
  // Reads current tree level; if locked (0) or on cooldown, returns false.
  // Phase 5 will add level-specific handlers; for now dispatches to existing ability.
  castTree(treeNum) {
    if (this.dead) return false;
    const level = this.abilityTrees[treeNum] ?? 0;
    if (level === 0) return false;   // tree still locked
    if ((this.treeCd[treeNum] ?? 0) > 0) return false;

    const treeDef = (HERO_ABILITY_TREES[this.type] || []).find(t => t.treeNum === treeNum);
    if (!treeDef) return false;

    const levelAbilityId = treeDef.levelAbilityIds?.[level - 1] ?? treeDef.abilityId;
    const abilityDef = ABILITY_DEFS[levelAbilityId];
    if (!abilityDef?.activate) return false;

    const result = abilityDef.activate(this);
    if (result === false) return false;

    if (abilityDef.sound) playSfx(abilityDef.sound);
    this.treeCd[treeNum] = abilityDef.maxCd ?? 12;

    // Open combo detection window for this secondary tree
    this.comboTimer[treeNum] = COMBO_WINDOW;
    this.comboLevel[treeNum] = level;

    // Secondary ability casts also charge superboost (+20%)
    this.superboostCharge = Math.min(1, this.superboostCharge + 0.2);
    if (state.devAbilityTest) this.superboostCharge = 1;

    return true;
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
      // Blockade L2: stun attacker
      if (this.blockadeTimer > 0 && this.blockadeStunOnHit > 0) {
        attacker.stunTimer = Math.max(attacker.stunTimer, this.blockadeStunOnHit);
        attacker.hurtFlash = 0.5;
      }
      // Blockade L3: fire damage + burn
      if (this.blockadeTimer > 0 && this.blockadeFireOnHitDmg > 0) {
        attacker.hp -= this.blockadeFireOnHitDmg;
        attacker.hurtFlash = 0.7;
        if (!attacker.fireDot || attacker.fireDot < this.blockadeFireOnHitBurn) {
          attacker.fireDot = this.blockadeFireOnHitBurn;
        }
      }
      // Combo: Green Pipe L2 — slow attacker
      if (this.blockadeTimer > 0 && this.blockadeSlowOnHit > 0) {
        attacker.slowTimer = Math.max(attacker.slowTimer, this.blockadeSlowOnHit);
        attacker.slowFactor = Math.min(attacker.slowFactor ?? 1, TINKERING_SLOW_CONFIG.factor);
      }
      // Combo: White Powder — knockback attacker
      if (this.blockadeTimer > 0 && this.blockadeKbOnHit > 0) {
        const a = Math.atan2(attacker.y - this.y, attacker.x - this.x);
        attacker.knockX += Math.cos(a) * this.blockadeKbOnHit;
        attacker.knockY += Math.sin(a) * this.blockadeKbOnHit;
        if (this.blockadeAcidOnHit) {
          attacker.acidDot = Math.max(attacker.acidDot || 0, 3);
          attacker.hurtFlash = 0.6;
        }
      }
    }

    return dmg;
  }

  drawCorpse(ctx) {
    if (!this.dead || this.deathX === undefined) return;
    const sprite = resolveAsset('heroes', this.type);
    if (!sprite) return;
    ctx.save();
    ctx.translate(this.deathX, this.deathY);
    sprite.draw(ctx, this._anim, -32, -40, 64, 64);
    ctx.restore();
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

    const facingUp = this._getDir().startsWith('u');
    const canDrawWeapon = !(this.type === 'dick' && this.boomerang !== null);

    // Facing up: weapon behind body — draw weapon first
    if (facingUp && canDrawWeapon) this._drawWeapon(ctx);

    ctx.save();
    ctx.translate(this.x, this.y + wobble);

    const sprite = resolveAsset('heroes', this.type);
    if (sprite) {
      if (flashBoost > 0) { ctx.globalAlpha = 0.7 + flashBoost * 0.3; ctx.filter = 'brightness(2)'; }
      sprite.draw(ctx, this._anim, -32, -40, 64, 64);
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

    // Facing down: weapon in front of body — draw weapon after
    if (!facingUp && canDrawWeapon) this._drawWeapon(ctx);

    // Draw flying boomerang(s)
    if (this.boomerang !== null)  this._drawFlyingBoomerang(ctx, this.boomerang);
    if (this.boomerang2 !== null) this._drawFlyingBoomerang(ctx, this.boomerang2);

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

    if (this.danceOfDeathTimer > 0) {
      const t  = this.danceOfDeathTimer;
      const cx = this.danceOfDeathCenterX;
      const cy = this.danceOfDeathCenterY;
      const pulse = 0.6 + 0.4 * Math.sin(state.time * 8);
      ctx.strokeStyle = `rgba(255, 30, 0, ${Math.min(0.9, t * 0.28) * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, this.danceOfDeathPullR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 100, 30, ${Math.min(0.5, t * 0.18)})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, this.danceOfDeathPullR * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.swing > 0.3 && this._displayWDef.type === 'melee' && !(this.type === 'dick' && this.boomerang !== null)) {
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
    const slot = this._displaySlot;
    if (!slot) return;
    const key = slot.key;
    const wDef = WEAPON_DEFS[key] ?? {};

    // For Dual Clubs, determine if it's the alternate swing
    const isDual = wDef.dual;
    const sideSign = (isDual && this.dualSide) ? 1 : -1;

    let swingArc = 0;
    if (this.swing > 0 && wDef.type === 'melee') {
      swingArc = Math.sin((1 - this.swing) * Math.PI) * (wDef.swingArc || 2.4) - (wDef.swingOffset || 1.2);
    }
    
    const throwBoost = this.throwArm;
    let baseAng = this.facing - 0.35 + (swingArc * (isDual ? sideSign : 1));
    let scale = 1.4;
    let reach = this.r * 0.7;

    if (wDef.type === 'thrown' || wDef.type === 'ranged') {
      baseAng = this.facing + (throwBoost > 0 ? 0 : 0.4);
      reach = this.r * 0.65 + throwBoost * 6;
      if (key === 'bow' || key === 'crossbow' || key === 'shotgun') {
        baseAng = this.facing;
      }
    }

    const wx = this.x + Math.cos(baseAng) * reach;
    const wy = this.y + Math.sin(baseAng) * reach;

    // Optional Trail for Melee
    if (this.swing > 0.3 && wDef.type === 'melee') {
      const trailArc = (this.swing - 0.3) * 0.8;
      const tStart = baseAng - swingArc * 0.5;
      const tEnd = baseAng;
      ctx.strokeStyle = `rgba(255, 240, 200, ${trailArc})`;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      // Draw a crescent
      ctx.arc(this.x, this.y, reach + 16, Math.min(tStart, tEnd), Math.max(tStart, tEnd));
      ctx.stroke();
      
      ctx.strokeStyle = `rgba(255, 255, 255, ${trailArc * 1.5})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, reach + 16, Math.min(tStart, tEnd), Math.max(tStart, tEnd));
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // Dynamic rotation per weapon
    let spriteRot = baseAng + Math.PI / 4; // Sprites are mostly drawn diagonally top-right
    if (key === 'samurai_sword') {
      scale = 1.8;
    } else if (key === 'throwing_stone') {
      scale = 1.0;
    } else if (key === 'shotgun' || key === 'bow' || key === 'crossbow') {
      spriteRot = baseAng;
    }

    // Don't draw the boomerang if it is flying
    if (key === 'boomerang' && this.boomerang !== null && throwBoost >= 0.7) {
       return; 
    }

    // Actually draw the sprite
    drawWeaponSprite(ctx, key, wx, wy, scale, spriteRot);

    // If dual clubs, draw the idle club too
    if (isDual) {
      const idleAng = this.facing - 0.4 * (-sideSign) + 0.5 * (-sideSign);
      const ix = this.x + Math.cos(idleAng) * (this.r * 0.7);
      const iy = this.y + Math.sin(idleAng) * (this.r * 0.7);
      drawWeaponSprite(ctx, key, ix, iy, scale, idleAng + Math.PI / 4);
    }
  }

  _drawFlyingBoomerang(ctx, b) {
    if (!b) return;
    const angle = state.time * 18;

    // Trail — fading golden circles from oldest to newest
    const trail = b._trail;
    if (trail && trail.length > 1) {
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const frac = (i + 1) / trail.length;
        ctx.save();
        ctx.globalAlpha = frac * 0.55;
        ctx.fillStyle = i % 2 === 0 ? '#ff8c10' : '#ffd040';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + frac * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Glow halo around boomerang
    const glow = ctx.createRadialGradient(b.clubX, b.clubY, 0, b.clubX, b.clubY, 24);
    glow.addColorStop(0,   'rgba(255, 210, 80, 0.75)');
    glow.addColorStop(0.45,'rgba(255, 130, 20, 0.35)');
    glow.addColorStop(1,   'rgba(255, 80,  0, 0)');
    ctx.save();
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.clubX, b.clubY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawWeaponSprite(ctx, 'boomerang', b.clubX, b.clubY, 1.4, angle);
  }
}
