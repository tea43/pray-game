import { G } from '../globals.js';
import { rand, randInt, dist2, clamp } from '../utils/math.js';
import { state } from '../state.js';
import { ENEMY_DEFS } from '../config/enemies.js';
import { DIFFICULTY_DEFS, rollItemDrops } from '../config/difficulty.js';
import { LOOT_DEFS } from '../config/loot.js';
import { resolveAsset } from '../config/assets.js';
import { Loot } from './Loot.js';
import { addKillScore } from '../systems/score.js';
import { playSfx } from '../systems/audio.js';
import { isWalkable, terrainSpeedMult } from '../utils/terrain.js';

export class Enemy {
  constructor(x, y, kind) {
    this.x = x; this.y = y;
    this.kind = kind;
    this.z = 0; this.vz = 0;
    this.knockX = 0; this.knockY = 0;
    this.dmgCd = 0;
    this.facing = 0;
    this.walkCycle = rand(0, 10);
    this.dead = false;
    this.deathTimer = 0;
    this.hurtFlash = 0;
    this.stunTimer = 0;
    this.acidDot = 0;
    this.kbResist = 1;

    this.blinkTimer = rand(2.5, 4);
    this.blinkTelegraph = 0;
    this.blinkTargetX = 0;
    this.blinkTargetY = 0;
    this.blinkAfterglow = 0;

    this.slamTimer = 5;
    this.slamCharge = 0;
    this.slamX = 0; this.slamY = 0;
    this.bossAura = 0;

    const def = ENEMY_DEFS[kind] || ENEMY_DEFS.ghoul;
    const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
    this.r = def.r;
    this.speed = def.speed * diff.enemy.speedMult;
    this.hp = Math.round(def.hp * diff.enemy.hpMult);
    this.maxHp = this.hp;
    this.dmg = Math.round(def.dmg * diff.enemy.dmgMult);
    this.color = def.color; this.skin = def.skin;
    this.hair = def.hair; this.bloodColor = def.bloodColor;
    this.kbResist = def.kbResist || this.kbResist;
    this.name = def.name;
    this.turnSpeed = def.turnSpeed || 5;

    this.bigbossMutantTorso = false; // config flag as requested
    this._anim = { name: 'walk', frame: 0, timer: 0 };
  }

  update(dt) {
    if (this.dead) { this.deathTimer += dt; return; }

    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
    this.stunTimer = Math.max(0, this.stunTimer - dt);

    if (this.z > 0 || this.vz !== 0) {
      this.vz -= 800 * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        this.vz = 0;
      }
    }

    if (Math.abs(this.knockX) > 1 || Math.abs(this.knockY) > 1) {
      this.x += this.knockX * dt * this.kbResist;
      this.y += this.knockY * dt * this.kbResist;
      const decay = Math.pow(0.001, dt);
      this.knockX *= decay;
      this.knockY *= decay;
    }

    if (this.stunTimer > 0) {
      if (this.hp <= 0) this._die();
      return;
    }

    if (this.kind === 'blinker') {
      this.blinkAfterglow = Math.max(0, this.blinkAfterglow - dt * 1.5);
      if (this.blinkTelegraph > 0) {
        this.blinkTelegraph += dt;
        if (this.blinkTelegraph >= 0.7) {
          this.x = this.blinkTargetX;
          this.y = this.blinkTargetY;
          this.blinkTelegraph = 0;
          this.blinkTimer = rand(2.8, 4.2);
          this.blinkAfterglow = 1;
          for (let i = 0; i < 14; i++) {
            const a = rand(0, Math.PI * 2);
            const v = rand(30, 110);
            state.particles.push({
              x: this.x, y: this.y,
              vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
              life: rand(0.3, 0.7), maxLife: 0.7,
              color: i % 2 === 0 ? '#c890ff' : '#8060c0',
              size: rand(1.2, 2.5), realtime: true,
            });
          }
        }
      } else {
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) {
          let tgt = null, nd = Infinity;
          for (const u of state.units) {
            if (u.dead) continue;
            const d = dist2(this.x, this.y, u.x, u.y);
            if (d < nd) { nd = d; tgt = u; }
          }
          if (tgt) {
            const behindAng = tgt.facing + Math.PI;
            const dist = rand(70, 95);
            const tx = clamp(tgt.x + Math.cos(behindAng) * dist, 14, G.W - 14);
            const ty = clamp(tgt.y + Math.sin(behindAng) * dist, 14, G.WORLD_H - 14);
            this.blinkTargetX = tx;
            this.blinkTargetY = ty;
            this.blinkTelegraph = 0.001;
          } else {
            this.blinkTimer = 1.5;
          }
        }
      }
      if (this.blinkTelegraph > 0) {
        this.dmgCd -= dt;
        if (this.hp <= 0) this._die();
        return;
      }
    }

    if (this.kind === 'bigboss') {
      this.bossAura += dt;
      if (this.slamCharge > 0) {
        this.slamCharge += dt;
        if (this.slamCharge >= 1.2) {
          playSfx('boss.attack.default');
          state.shockwaves.push({
            x: this.slamX, y: this.slamY,
            r: this.r + 4, maxR: 320,
            hit: new Set(),
            life: 1.4, maxLife: 1.4,
            speed: 280, dmg: 35,
          });
          if (!state.settings.noShake) state.shake = Math.max(state.shake, 12);
          this.slamCharge = 0;
          this.slamTimer = rand(4.5, 6.5);
          for (let i = 0; i < 30; i++) {
            const a = rand(0, Math.PI * 2);
            const v = rand(60, 220);
            state.particles.push({
              x: this.slamX, y: this.slamY,
              vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80,
              life: rand(0.4, 0.9), maxLife: 0.9,
              color: i % 3 === 0 ? '#a8c060' : '#5a4030',
              size: rand(1.8, 3.2), realtime: true,
            });
          }
        }
      } else {
        this.slamTimer -= dt;
        if (this.slamTimer <= 0) {
          this.slamX = this.x;
          this.slamY = this.y;
          this.slamCharge = 0.001;
          playSfx('boss.ability.default');
        }
      }
      if (this.slamCharge > 0) {
        this.dmgCd -= dt;
        if (this.hp <= 0) this._die();
        return;
      }
    }

    // Fire DoT
    if (this.fireDot > 0) {
      this.fireDot = Math.max(0, this.fireDot - dt);
      this.hp -= 6 * dt;
      if (Math.random() < dt * 8) {
        state.particles.push({ x: this.x + rand(-4, 4), y: this.y + rand(-6, 0), vx: rand(-20, 20), vy: rand(-50, -10), life: rand(0.2, 0.5), maxLife: 0.5, color: rand(0, 1) > 0.5 ? '#ff6020' : '#ffa040', size: rand(1.5, 3), realtime: true });
      }
    }

    // Acid DoT
    if (this.acidDot > 0) {
      this.acidDot = Math.max(0, this.acidDot - dt);
      this.hp -= 5 * dt;
      if (Math.random() < dt * 6) {
        state.particles.push({ x: this.x + rand(-4,4), y: this.y+rand(-4,2), vx: rand(-15,15), vy: rand(-30,-5), life: rand(0.2,0.5), maxLife:0.5, color: rand(0,1)>0.5?'#40ff40':'#80ff80', size: rand(1.5,3), realtime: true });
      }
    }

    // Target selection: prefer stoned hero > non-smoked nearest > smoked nearest
    let target = null, nd = Infinity;
    let stonedTarget = null;
    for (const u of state.units) {
      if (u.dead) continue;
      if (u.stonedTimer > 0) { stonedTarget = u; break; }
    }
    if (stonedTarget) {
      target = stonedTarget;
    } else {
      // Prefer heroes not inside a smoke zone
      for (const u of state.units) {
        if (u.dead) continue;
        if (_isSmoked(u)) continue;
        const d = dist2(this.x, this.y, u.x, u.y);
        if (d < nd) { nd = d; target = u; }
      }
      // Fallback: all heroes smoked — pick nearest anyway
      if (!target) {
        nd = Infinity;
        for (const u of state.units) {
          if (u.dead) continue;
          const d = dist2(this.x, this.y, u.x, u.y);
          if (d < nd) { nd = d; target = u; }
        }
      }
    }

    if (target) {
      const dx = target.x - this.x, dy = target.y - this.y;
      const d = Math.hypot(dx, dy);

      // Direct chase by default; flow field only when the direct step is physically blocked
      let moveDx = dx / d, moveDy = dy / d;
      const stepSize = this.speed * dt;
      if (!isWalkable(this.x + moveDx * stepSize, this.y + moveDy * stepSize)) {
        const ff = state.flowField;
        if (ff && G.COLS > 0) {
          const col = Math.max(0, Math.min(G.COLS - 1, Math.floor(this.x / G.TILE)));
          const row = Math.max(0, Math.min(G.ROWS - 1, Math.floor(this.y / G.TILE)));
          const fi = (row * G.COLS + col) * 2;
          const fdx = ff[fi], fdy = ff[fi + 1];
          if (fdx !== 0 || fdy !== 0) { moveDx = fdx; moveDy = fdy; }
        }
      }

      // Gradual turn — worms cannot spin instantly
      const targetFacing = Math.atan2(moveDy, moveDx);
      let dFacing = targetFacing - this.facing;
      while (dFacing >  Math.PI) dFacing -= Math.PI * 2;
      while (dFacing < -Math.PI) dFacing += Math.PI * 2;
      this.facing += Math.sign(dFacing) * Math.min(Math.abs(dFacing), this.turnSpeed * dt);
      if (d > this.r + target.r - 2) {
        const terrMult = terrainSpeedMult(this.x, this.y);
        const ex = this.x + moveDx * this.speed * dt * terrMult;
        const ey = this.y + moveDy * this.speed * dt * terrMult;
        if (isWalkable(ex, ey)) {
          this.x = ex; this.y = ey;
        } else if (isWalkable(ex, this.y)) {
          this.x = ex;
        } else if (isWalkable(this.x, ey)) {
          this.y = ey;
        }
        this.walkCycle += dt * 7;
        if (this.kind === 'bigboss' || this.kind === 'miniboss') {
          playSfx('boss.walk.default', { cooldownKey: `boss.walk.${this.kind}` });
        }
      } else if (this.dmgCd <= 0) {
        const actualDmg = target.applyDamage ? target.applyDamage(this.dmg, this) : this.dmg;
        if (actualDmg > 0) {
          if (!target.applyDamage) { target.hp -= actualDmg; target.hurtFlash = 1; }
          this.dmgCd = 0.75;
          playSfx('alien.attack.default', { synthetic: 'hit' });
          playSfx('character.damaged.default', { synthetic: 'hit' });
          if (!state.settings.noShake) state.shake = Math.max(state.shake, 2);
          for (let i = 0; i < 6; i++) {
            state.particles.push({
              x: target.x + rand(-3, 3), y: target.y + rand(-3, 3),
              vx: rand(-60, 60), vy: rand(-80, -10),
              life: 0.5, maxLife: 0.5,
              color: '#a83a2a', size: rand(1, 2), realtime: true,
            });
          }
        } else {
          this.dmgCd = 0.75; // still apply cooldown even if blocked
        }
      }
    }

    this.dmgCd -= dt;

    if (this.hp <= 0) this._die();

    this._tickAnim(dt);
  }

  _animName() {
    if (this.dead) return 'death';
    if (this.hurtFlash > 0.6) return 'hurt';
    if (this.kind === 'blinker' && this.blinkTelegraph > 0) return 'blink';
    if (this.kind === 'bigboss' && this.slamCharge > 0) return 'slam';
    if (this.dmgCd > 0.5) return 'attack';
    return 'walk';
  }

  _tickAnim(dt) {
    const sprite = resolveAsset('enemies', this.kind);
    if (!sprite?.isAnimated) return;
    const name = this._animName();
    const anim = sprite.animations[name] || sprite.animations.walk;
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

  _die() {
    this.dead = true;
    playSfx(this.kind === 'bigboss' || this.kind === 'miniboss' ? 'boss.death.default' : 'alien.death.default');
    state.kills++;
    addKillScore(this.kind);
    this._spawnBloodBurst();
    this._spawnBossGlowBurst();   // no-op for regular enemies
    this._triggerScreenEffects();
    this._spawnLootDrops();
  }

  // Blood splatter particles — same for all enemy types, scaled by radius.
  _spawnBloodBurst() {
    const burst = (this.kind === 'bigboss') ? 80 : (this.kind === 'miniboss') ? 40 : 18;
    for (let i = 0; i < burst; i++) {
      state.particles.push({
        x: this.x, y: this.y,
        vx: rand(-140, 140) * (this.r / 10),
        vy: rand(-160, -20) * (this.r / 10),
        life: rand(0.6, 1.4), maxLife: 1.4,
        color: this.bloodColor, size: rand(1.5, 3.5), realtime: true,
      });
    }
  }

  // Additive glow burst — bosses only so regular deaths stay gritty.
  _spawnBossGlowBurst() {
    const glowBurst = (this.kind === 'bigboss') ? 10 : (this.kind === 'miniboss') ? 5 : 0;
    if (glowBurst === 0) return;
    const glowColor = this.kind === 'bigboss' ? 'rgba(180, 255, 120, 1)' : 'rgba(255, 160, 80, 1)';
    for (let i = 0; i < glowBurst; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(60, 220) * (this.r / 14);
      state.particles.push({
        x: this.x, y: this.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - rand(20, 90),
        life: rand(0.5, 1.1), maxLife: 1.1,
        color: glowColor, size: rand(2, 4.5), realtime: true, additive: true,
      });
    }
  }

  // Screen shake, flash overlay, and hit-stop — bosses only.
  _triggerScreenEffects() {
    if (this.kind === 'bigboss') {
      state.shockwaves.push({
        x: this.x, y: this.y,
        r: this.r, maxR: 360,
        hit: new Set(),
        life: 1.0, maxLife: 1.0,
        speed: 360, dmg: 0,
      });
      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.7); state.flashColor = '#c8ff90'; }
      if (!state.settings.noShake) { state.hitStop = Math.max(state.hitStop, 0.14); state.shake = Math.max(state.shake, 4); }
    } else if (this.kind === 'miniboss') {
      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.45); state.flashColor = '#ffb070'; }
      if (!state.settings.noShake) { state.hitStop = Math.max(state.hitStop, 0.08); state.shake = Math.max(state.shake, 3); }
    }
    // Regular enemies: no shake, no flash, no hit-stop.
  }

  // Loot drops — boss guaranteed drops, then regular chance-based drops.
  _spawnLootDrops() {
    if (this.kind === 'bigboss') {
      const drops = ['bomb', 'medkit', 'stimpack', 'medkit', 'medkit'];
      for (let i = 0; i < drops.length; i++) {
        const ang = (i / drops.length) * Math.PI * 2;
        const lx = clamp(this.x + Math.cos(ang) * 28, 12, G.WORLD_W - 12);
        const ly = clamp(this.y + Math.sin(ang) * 28, 12, G.WORLD_H - 12);
        state.loot.push(new Loot(lx, ly, drops[i]));
      }
      state.loot.push(new Loot(clamp(this.x + 40, 12, G.WORLD_W - 12), clamp(this.y, 12, G.WORLD_H - 12), 'banana_bomb'));
      const bbWeapons = ['shotgun', 'samurai_sword'];
      const bbPick = bbWeapons[Math.floor(Math.random() * bbWeapons.length)];
      state.loot.push(new Loot(clamp(this.x - 40, 12, G.WORLD_W - 12), clamp(this.y, 12, G.WORLD_H - 12), bbPick));
      return;
    }
    if (this.kind === 'miniboss') {
      const drops = ['medkit', 'stimpack', 'bomb'];
      for (let i = 0; i < drops.length; i++) {
        const ang = (i / drops.length) * Math.PI * 2 + 0.4;
        const lx = clamp(this.x + Math.cos(ang) * 18, 12, G.WORLD_W - 12);
        const ly = clamp(this.y + Math.sin(ang) * 18, 12, G.WORLD_H - 12);
        state.loot.push(new Loot(lx, ly, drops[i]));
      }
      const mbWeapons = ['shotgun', 'samurai_sword'];
      const mbPick = mbWeapons[Math.floor(Math.random() * mbWeapons.length)];
      const mbAng = Math.PI;
      state.loot.push(new Loot(
        clamp(this.x + Math.cos(mbAng) * 28, 12, G.WORLD_W - 12),
        clamp(this.y + Math.sin(mbAng) * 28, 12, G.WORLD_H - 12),
        mbPick
      ));
      return;
    }

    const def = ENEMY_DEFS[this.kind] || ENEMY_DEFS.ghoul;
    const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
    const dropChance = (def.dropChance || 0) * diff.loot.dropChanceMult;
    const lx = clamp(this.x + rand(-4, 4), 12, G.WORLD_W - 12);
    const ly = clamp(this.y + rand(-4, 4), 12, G.WORLD_H - 12);
    if (Math.random() < dropChance) {
      const drops = rollItemDrops(diff);
      drops.forEach((type, i) => {
        state.loot.push(new Loot(
          clamp(lx + i * 14, 12, G.WORLD_W - 12),
          clamp(ly, 12, G.WORLD_H - 12),
          type
        ));
      });
    }

    if (def.specialEligible) {
      if (Math.random() < LOOT_DEFS.bananaBombChance * diff.loot.specialDropMult) {
        state.loot.push(new Loot(
          clamp(lx + rand(-8, 8), 12, G.WORLD_W - 12),
          clamp(ly + rand(-8, 8), 12, G.WORLD_H - 12),
          'banana_bomb'
        ));
      } else if (Math.random() < LOOT_DEFS.specialWeaponChance * diff.loot.specialDropMult) {
        const weapons = LOOT_DEFS.specialWeapons;
        const pick = weapons[Math.floor(Math.random() * weapons.length)];
        state.loot.push(new Loot(
          clamp(lx + rand(-8, 8), 12, G.WORLD_W - 12),
          clamp(ly + rand(-8, 8), 12, G.WORLD_H - 12),
          pick
        ));
      }
    }
  }

  draw(ctx) {
    if (this.dead && this.deathTimer > 3) return;

    if (this.dead) {
      const t = this.deathTimer;
      const fade = Math.max(0, 1 - t / 3);
      ctx.fillStyle = `rgba(60, 20, 15, ${0.55 * fade})`;
      ctx.beginPath();
      const spread = Math.min(t * 1.5, 1);
      ctx.ellipse(this.x, this.y + 2, this.r * 1.6 * spread, this.r * 0.7 * spread, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(40, 30, 20, ${0.7 * fade})`;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 0.9, this.r * 0.5, this.facing, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const sprite = resolveAsset('enemies', this.kind);
    if (sprite) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      sprite.draw(ctx, this._anim, -this.r * 1.5, -this.r * 1.5, this.r * 3, this.r * 3);
      ctx.restore();
      this._drawHpBar(ctx);
      return;
    }

    if (this.kind === 'blinker' && this.blinkTelegraph > 0) {
      const t = this.blinkTelegraph / 0.7;
      ctx.strokeStyle = `rgba(200, 140, 255, ${0.4 + t * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#c890ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.blinkTargetX, this.blinkTargetY, 14 + Math.sin(state.time * 18) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.blinkTargetX, this.blinkTargetY, 6 * (1 - t), 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(180, 120, 240, ${0.25 * t})`;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.blinkTargetX, this.blinkTargetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.kind === 'miniboss' || this.kind === 'bigboss') {
      const auraR = this.r + (this.kind === 'bigboss' ? 14 : 8) + Math.sin(this.bossAura * 3) * 2;
      const auraColor = this.kind === 'bigboss' ? 'rgba(140, 220, 80, 0.18)' : 'rgba(200, 80, 40, 0.16)';
      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.r - 1, auraR, auraR * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.kind === 'bigboss' && this.slamCharge > 0) {
      const t = this.slamCharge / 1.2;
      ctx.strokeStyle = `rgba(255, 220, 80, ${0.4 + t * 0.5})`;
      ctx.lineWidth = 2 + t * 2;
      ctx.shadowColor = '#ffe060';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.slamX, this.slamY, this.r + 8 + (1 - t) * 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 100, 40, ${t * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.slamX, this.slamY, this.r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const prevAlpha = ctx.globalAlpha;
    if (this.kind === 'blinker') ctx.globalAlpha = 0.78 + this.blinkAfterglow * 0.22;

    ctx.save();
    ctx.translate(this.x, this.y - this.z);
    ctx.rotate(this.facing);
    this._drawWorm(ctx);

    ctx.restore();
    ctx.globalAlpha = prevAlpha;

    if (this.kind === 'bigboss' && Math.random() < 0.25) {
      const a = rand(0, Math.PI * 2);
      const r = rand(this.r * 0.6, this.r + 4);
      state.particles.push({
        x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r,
        vx: rand(-10, 10), vy: rand(-30, -5),
        life: rand(0.4, 0.8), maxLife: 0.8,
        color: '#a0ff60', size: rand(1, 2), realtime: true,
      });
    }

    if (this.stunTimer > 0) {
      ctx.strokeStyle = 'rgba(180, 220, 255, 0.85)'; ctx.lineWidth = 1.2;
      ctx.shadowColor = '#80c8ff'; ctx.shadowBlur = 5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(this.x + rand(-this.r, this.r), this.y + rand(-this.r, this.r));
        ctx.lineTo(this.x + rand(-this.r, this.r), this.y + rand(-this.r, this.r));
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      for (let i = 0; i < 3; i++) {
        const a = state.time * 6 + (i * Math.PI * 2 / 3);
        const sx = this.x + Math.cos(a) * (this.r + 5);
        const sy = this.y - this.r * 0.5 + Math.sin(a) * 3;
        ctx.fillStyle = '#c0e8ff'; ctx.shadowColor = '#80c8ff'; ctx.shadowBlur = 6;
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
      ctx.shadowBlur = 0;
    }

    this._drawHpBar(ctx);
  }

  // ── Worm drawing ─────────────────────────────────────────────────────────────
  // Called inside ctx.save/translate(x,y)/rotate(facing), so +X = forward, (0,0) = head.

  _drawWorm(ctx) {
    switch (this.kind) {
      case 'raider':   this._wRaider(ctx);   break;
      case 'runner':   this._wRunner(ctx);   break;
      case 'ghoul':    this._wGhoul(ctx);    break;
      case 'mutant':   this._wMutant(ctx);   break;
      case 'blinker':  this._wBlinker(ctx);  break;
      case 'miniboss': this._wMiniboss(ctx); break;
      case 'bigboss':  this._wBigboss(ctx);  break;
      default:         this._wRaider(ctx);
    }
  }

  _segs(ctx, n, gap, colors, wAmp = 1.8) {
    const hurt = this.hurtFlash > 0;
    for (let i = n - 1; i >= 0; i--) {
      const wobY = this.stunTimer > 0 ? 0 : Math.sin(this.walkCycle - i * 0.8) * wAmp;
      const sr = this.r * Math.pow(0.84, i);
      const cx = -gap * i;
      const baseColor = hurt ? (i === 0 ? '#d97060' : '#b05040') : colors[Math.min(i, colors.length - 1)];
      
      ctx.beginPath();
      ctx.arc(cx, wobY, sr, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.fill();

      // 2.5D shading overlay
      const shadeGrd = ctx.createRadialGradient(cx - sr * 0.3, wobY - sr * 0.3, sr * 0.1, cx, wobY, sr);
      shadeGrd.addColorStop(0, 'rgba(255,255,255,0.35)');
      shadeGrd.addColorStop(0.5, 'rgba(0,0,0,0)');
      shadeGrd.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = shadeGrd;
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  _wRaider(ctx) {
    const r = this.r;
    this._segs(ctx, 4, r * 1.1, ['#7a5535', '#5e3f22', '#48301a', '#321f0e'], 1.6);
    if (this.hurtFlash) return;
    ctx.fillStyle = '#cc2a1a';
    ctx.fillRect(r * 0.2, -r * 0.42, 2.2, 2.2);
    ctx.fillRect(r * 0.2,  r * 0.14, 2.2, 2.2);
  }

  _wRunner(ctx) {
    const r = this.r;
    this._segs(ctx, 3, r * 1.35, ['#8a6030', '#6a4820', '#4a3012'], 2.2);
    if (this.hurtFlash) return;
    ctx.fillStyle = '#a87840';
    ctx.beginPath();
    ctx.moveTo(r * 0.9, 0);
    ctx.lineTo(r * 1.7, -r * 0.22);
    ctx.lineTo(r * 1.7,  r * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,145,65,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.62); ctx.lineTo(-r * 2.4, -r * 0.52); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.4,  r * 0.62); ctx.lineTo(-r * 2.4,  r * 0.52); ctx.stroke();
    ctx.fillStyle = '#ffe090';
    ctx.fillRect(r * 0.15, -r * 0.38, 2, 2);
    ctx.fillRect(r * 0.15,  r * 0.18, 2, 2);
  }

  _wGhoul(ctx) {
    const r = this.r;
    this._segs(ctx, 5, r * 0.94, ['#848c68', '#6a7250', '#58603e', '#46502c', '#34401a'], 1.0);
    if (this.hurtFlash) return;
    for (let i = 1; i <= 3; i++) {
      const sx = -r * 0.94 * i;
      const sw = r * Math.pow(0.84, i);
      ctx.strokeStyle = '#3a4828';
      ctx.lineWidth = 1.5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx, side * sw * 0.7);
        ctx.lineTo(sx + r * 0.35, side * (sw + r * 0.55));
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#c0b84e';
    ctx.fillRect(r * 0.1, -r * 0.44, 2.4, 2);
    ctx.fillRect(r * 0.1,  r * 0.22, 2.4, 2);
  }

  _wMutant(ctx) {
    const r = this.r;
    this._segs(ctx, 4, r * 1.12, ['#3c5428', '#2e4220', '#223218', '#182612'], 1.4);
    if (this.hurtFlash) return;
    for (let i = 0; i < 3; i++) {
      const sx = -r * 1.12 * i;
      const sw = r * Math.pow(0.84, i);
      ctx.fillStyle = 'rgba(18,28,12,0.55)';
      ctx.fillRect(sx - sw * 0.52, -sw * 0.26, sw * 1.04, sw * 0.52);
    }
    ctx.strokeStyle = '#223818';
    ctx.lineWidth = 2.8;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.65, side * r * 0.45);
      ctx.lineTo(r * 1.65, side * r * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 1.45, side * r * 0.7);
      ctx.lineTo(r * 1.65, side * r * 0.9);
      ctx.lineTo(r * 1.65, side * r * 0.48);
      ctx.stroke();
    }
    ctx.fillStyle = '#e03010'; ctx.shadowColor = '#ff4020'; ctx.shadowBlur = 5;
    ctx.fillRect(r * 0.22, -r * 0.46, 3, 3);
    ctx.fillRect(r * 0.22,  r * 0.15, 3, 3);
    ctx.shadowBlur = 0;
  }

  _wBlinker(ctx) {
    const r = this.r;
    this._segs(ctx, 3, r * 1.2, ['#6a3a8a', '#4a2468', '#2e1448'], 2.0);
    if (this.hurtFlash) return;
    ctx.fillStyle = '#e8c0ff'; ctx.shadowColor = '#c890ff'; ctx.shadowBlur = 7;
    ctx.fillRect(r * 0.1, -r * 0.38, 3, 3);
    ctx.fillRect(r * 0.1,  r * 0.1,  3, 3);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(190, 140, 250, 0.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = state.time * 1.5 + i * 2.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r,       Math.sin(a) * r);
      ctx.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5) - 1);
      ctx.stroke();
    }
  }

  _wMiniboss(ctx) {
    const r = this.r;
    this._segs(ctx, 5, r * 1.02, ['#703020', '#5a2418', '#421a10', '#2e120a', '#1e0c06'], 2.5);
    if (this.hurtFlash) return;
    for (let i = 0; i < 4; i++) {
      const sx = -r * 1.02 * i;
      const sw = r * Math.pow(0.84, i);
      ctx.fillStyle = 'rgba(28,10,5,0.55)';
      ctx.fillRect(sx - sw * 0.5, -sw * 0.2, sw, sw * 0.4);
    }
    ctx.strokeStyle = '#8a5a30';
    ctx.lineWidth = 3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.45, side * r * 0.65);
      ctx.lineTo(r * 1.25, side * r * 1.3);
      ctx.stroke();
    }
    ctx.strokeStyle = '#2a1005';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.22);
    ctx.quadraticCurveTo(r * 1.05, 0, r * 0.55, r * 0.22);
    ctx.stroke();
    ctx.fillStyle = '#ffd040'; ctx.shadowColor = '#ff8020'; ctx.shadowBlur = 7;
    ctx.fillRect(r * 0.14, -r * 0.5, 4, 3.5);
    ctx.fillRect(r * 0.14,  r * 0.18, 4, 3.5);
    ctx.shadowBlur = 0;
  }

  _wBigboss(ctx) {
    const r = this.r;
    this._segs(ctx, 6, r * 0.94, ['#3a5a28', '#2a4a1e', '#1e3a16', '#162e0e', '#0e220a', '#081806'], 3.2);
    if (this.hurtFlash) return;
    ctx.strokeStyle = 'rgba(120, 255, 60, 0.65)'; ctx.shadowColor = '#80ff40'; ctx.shadowBlur = 6;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 5; i++) {
      const sx = -r * 0.94 * i;
      const sw = r * Math.pow(0.84, i);
      ctx.beginPath();
      ctx.moveTo(sx, -sw * 0.9);
      ctx.lineTo(sx - sw * 0.15, -sw * 1.55);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (let i = 1; i < 5; i++) {
      const sx = -r * 0.94 * i;
      const sw = r * Math.pow(0.84, i);
      ctx.fillStyle = 'rgba(50,80,28,0.5)';
      ctx.fillRect(sx - sw * 0.5, -sw * 0.24, sw, sw * 0.48);
    }
    ctx.fillStyle = '#161a0a';
    ctx.beginPath();
    ctx.moveTo(r,       -r * 0.72);
    ctx.lineTo(r * 1.62, -r * 0.28);
    ctx.lineTo(r * 1.62,  r * 0.28);
    ctx.lineTo(r,        r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a0a08';
    ctx.beginPath();
    ctx.moveTo(r * 1.06, -r * 0.38);
    ctx.lineTo(r * 1.52,  0);
    ctx.lineTo(r * 1.06,  r * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8d8a0';
    for (const t of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.94, t * r * 0.46 - r * 0.16);
      ctx.lineTo(r * 1.28, t * r * 0.46);
      ctx.lineTo(r * 0.94, t * r * 0.46 + r * 0.16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#c8ff40'; ctx.shadowColor = '#a0ff20'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(r * 0.38, -r * 0.46, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.38,  r * 0.46, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  _drawHpBar(ctx) {
    if (this.hp < this.maxHp || this.kind === 'miniboss' || this.kind === 'bigboss') {
      const isBoss = this.kind === 'miniboss' || this.kind === 'bigboss';
      const barW = isBoss ? this.r * 3.6 : this.r * 2.2;
      const barH = isBoss ? 4 : 2.5;
      const barX = this.x - barW / 2;
      const barY = this.y - this.r - (isBoss ? 18 : 9);
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      const hpPct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = this.kind === 'bigboss' ? '#a8d040' : this.kind === 'miniboss' ? '#d05a35' : '#a83a2a';
      ctx.fillRect(barX, barY, barW * hpPct, barH);
      if (isBoss) {
        ctx.fillStyle = this.kind === 'bigboss' ? '#c8ff80' : '#ffb070';
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
        ctx.fillText(this.name, this.x, barY - 4);
        ctx.shadowBlur = 0; ctx.textAlign = 'left';
      }
    }
  }
}

function _isSmoked(unit) {
  const zones = state.smokeZones;
  if (!zones || zones.length === 0) return false;
  return zones.some(sz => dist2(unit.x, unit.y, sz.x, sz.y) < sz.r);
}
