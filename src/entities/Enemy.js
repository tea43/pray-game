import { G } from '../globals.js';
import { rand, randInt, dist2, clamp } from '../utils/math.js';
import { state } from '../state.js';
import { ENEMY_DEFS } from '../config/enemies.js';
import { LOOT_DEFS } from '../config/loot.js';
import { Loot } from './Loot.js';

export class Enemy {
  constructor(x, y, kind) {
    this.x = x; this.y = y;
    this.kind = kind;
    this.knockX = 0; this.knockY = 0;
    this.dmgCd = 0;
    this.facing = 0;
    this.walkCycle = rand(0, 10);
    this.dead = false;
    this.deathTimer = 0;
    this.hurtFlash = 0;
    this.stunTimer = 0;
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
    this.r = def.r;
    this.speed = def.speed;
    this.hp = def.hp; this.maxHp = def.hp;
    this.dmg = def.dmg;
    this.color = def.color; this.skin = def.skin;
    this.hair = def.hair; this.bloodColor = def.bloodColor;
    this.kbResist = def.kbResist || this.kbResist;
    this.name = def.name;
  }

  update(dt) {
    if (this.dead) { this.deathTimer += dt; return; }

    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
    this.stunTimer = Math.max(0, this.stunTimer - dt);

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
            const ty = clamp(tgt.y + Math.sin(behindAng) * dist, 14, G.PLAY_BOTTOM - 14);
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
          state.shockwaves.push({
            x: this.slamX, y: this.slamY,
            r: this.r + 4, maxR: 320,
            hit: new Set(),
            life: 1.4, maxLife: 1.4,
            speed: 280, dmg: 35,
          });
          state.shake = Math.max(state.shake, 12);
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
        }
      }
      if (this.slamCharge > 0) {
        this.dmgCd -= dt;
        if (this.hp <= 0) this._die();
        return;
      }
    }

    let target = null, nd = Infinity;
    for (const u of state.units) {
      if (u.dead) continue;
      const d = dist2(this.x, this.y, u.x, u.y);
      if (d < nd) { nd = d; target = u; }
    }

    if (target) {
      const dx = target.x - this.x, dy = target.y - this.y;
      const d = Math.hypot(dx, dy);
      this.facing = Math.atan2(dy, dx);
      if (d > this.r + target.r - 2) {
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * dt;
        this.walkCycle += dt * 7;
      } else if (this.dmgCd <= 0) {
        target.hp -= this.dmg;
        target.hurtFlash = 1;
        this.dmgCd = 0.75;
        state.shake = Math.max(state.shake, 2);
        for (let i = 0; i < 6; i++) {
          state.particles.push({
            x: target.x + rand(-3, 3), y: target.y + rand(-3, 3),
            vx: rand(-60, 60), vy: rand(-80, -10),
            life: 0.5, maxLife: 0.5,
            color: '#a83a2a', size: rand(1, 2), realtime: true,
          });
        }
      }
    }

    this.dmgCd -= dt;
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.dead = true;
    state.kills++;
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
    state.shake = Math.max(state.shake, this.kind === 'bigboss' ? 14 : this.kind === 'miniboss' ? 8 : 4);

    if (this.kind === 'bigboss') {
      const drops = ['bomb', 'medkit', 'stimpack', 'medkit', 'medkit'];
      for (let i = 0; i < drops.length; i++) {
        const ang = (i / drops.length) * Math.PI * 2;
        const lx = clamp(this.x + Math.cos(ang) * 28, 12, G.W - 12);
        const ly = clamp(this.y + Math.sin(ang) * 28, 12, G.PLAY_BOTTOM - 12);
        state.loot.push(new Loot(lx, ly, drops[i]));
      }
      state.loot.push(new Loot(clamp(this.x + 40, 12, G.W - 12), clamp(this.y, 12, G.PLAY_BOTTOM - 12), 'banana_bomb'));
      const bbWeapons = ['spray_gun', 'samurai_sword'];
      const bbPick = bbWeapons[Math.floor(Math.random() * bbWeapons.length)];
      state.loot.push(new Loot(clamp(this.x - 40, 12, G.W - 12), clamp(this.y, 12, G.PLAY_BOTTOM - 12), bbPick));
      return;
    }
    if (this.kind === 'miniboss') {
      const drops = ['medkit', 'stimpack', 'bomb'];
      for (let i = 0; i < drops.length; i++) {
        const ang = (i / drops.length) * Math.PI * 2 + 0.4;
        const lx = clamp(this.x + Math.cos(ang) * 18, 12, G.W - 12);
        const ly = clamp(this.y + Math.sin(ang) * 18, 12, G.PLAY_BOTTOM - 12);
        state.loot.push(new Loot(lx, ly, drops[i]));
      }
      const mbWeapons = ['spray_gun', 'samurai_sword'];
      const mbPick = mbWeapons[Math.floor(Math.random() * mbWeapons.length)];
      const mbAng = Math.PI;
      state.loot.push(new Loot(
        clamp(this.x + Math.cos(mbAng) * 28, 12, G.W - 12),
        clamp(this.y + Math.sin(mbAng) * 28, 12, G.PLAY_BOTTOM - 12),
        mbPick
      ));
      return;
    }

    const def = ENEMY_DEFS[this.kind] || ENEMY_DEFS.ghoul;
    const dropRoll = Math.random();
    const dropChance = def.dropChance || 0;
    const lx = clamp(this.x + rand(-4, 4), 12, G.W - 12);
    const ly = clamp(this.y + rand(-4, 4), 12, G.PLAY_BOTTOM - 12);
    if (dropRoll < dropChance) {
      const r = Math.random();
      const lootType = LOOT_DEFS.basicDropWeights.find(drop => r < drop.threshold).type;
      state.loot.push(new Loot(lx, ly, lootType));
    }

    if (def.specialEligible) {
      if (Math.random() < LOOT_DEFS.bananaBombChance) {
        state.loot.push(new Loot(
          clamp(lx + rand(-8, 8), 12, G.W - 12),
          clamp(ly + rand(-8, 8), 12, G.PLAY_BOTTOM - 12),
          'banana_bomb'
        ));
      } else if (Math.random() < LOOT_DEFS.specialWeaponChance) {
        const weapons = LOOT_DEFS.specialWeapons;
        const pick = weapons[Math.floor(Math.random() * weapons.length)];
        state.loot.push(new Loot(
          clamp(lx + rand(-8, 8), 12, G.W - 12),
          clamp(ly + rand(-8, 8), 12, G.PLAY_BOTTOM - 12),
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

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.r - 1, this.r * 0.9, this.r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

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

    const wobble = this.stunTimer > 0 ? 0 : Math.sin(this.walkCycle) * 1.2;

    const prevAlpha = ctx.globalAlpha;
    if (this.kind === 'blinker') {
      ctx.globalAlpha = 0.78 + this.blinkAfterglow * 0.22;
    }

    ctx.save();
    ctx.translate(this.x, this.y + wobble);

    ctx.fillStyle = this.hurtFlash > 0 ? '#d97060' : this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0604';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(2, 3, this.r * 0.9, -0.3, 1.8);
    ctx.lineTo(0, 0);
    ctx.fill();

    ctx.fillStyle = this.hurtFlash > 0 ? '#ffb8a8' : this.skin;
    ctx.beginPath();
    ctx.arc(0, -this.r * 0.6, this.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0604';
    ctx.stroke();

    if (this.kind === 'mutant') {
      ctx.fillStyle = '#ff4020'; ctx.shadowColor = '#ff4020'; ctx.shadowBlur = 4;
      ctx.fillRect(-3, -this.r * 0.65, 1.8, 1.8);
      ctx.fillRect(1.2, -this.r * 0.65, 1.8, 1.8);
      ctx.shadowBlur = 0;
    } else if (this.kind === 'ghoul') {
      ctx.fillStyle = '#f0e890';
      ctx.fillRect(-3, -this.r * 0.65, 1.5, 1.2);
      ctx.fillRect(1.5, -this.r * 0.65, 1.5, 1.2);
    } else if (this.kind === 'runner') {
      ctx.fillStyle = '#fff8d0';
      ctx.fillRect(-3, -this.r * 0.7, 2, 1.4);
      ctx.fillRect(1, -this.r * 0.7, 2, 1.4);
      ctx.fillStyle = '#1a0a05';
      ctx.fillRect(-2.5, -this.r * 0.66, 1, 1);
      ctx.fillRect(1.5, -this.r * 0.66, 1, 1);
    } else if (this.kind === 'blinker') {
      ctx.fillStyle = '#e8c0ff'; ctx.shadowColor = '#c890ff'; ctx.shadowBlur = 5;
      ctx.fillRect(-3, -this.r * 0.65, 1.8, 1.8);
      ctx.fillRect(1.2, -this.r * 0.65, 1.8, 1.8);
      ctx.shadowBlur = 0;
    } else if (this.kind === 'miniboss') {
      ctx.fillStyle = '#ffd040'; ctx.shadowColor = '#ff8020'; ctx.shadowBlur = 5;
      ctx.fillRect(-5, -this.r * 0.72, 3, 2);
      ctx.fillRect(2, -this.r * 0.72, 3, 2);
      ctx.shadowBlur = 0;
    } else if (this.kind === 'bigboss') {
      ctx.fillStyle = '#fff060'; ctx.shadowColor = '#a0ff20'; ctx.shadowBlur = 9;
      ctx.fillRect(-7, -this.r * 0.72, 4, 3);
      ctx.fillRect(3, -this.r * 0.72, 4, 3);
      ctx.fillStyle = '#fffac0';
      ctx.fillRect(-6, -this.r * 0.72, 1.5, 1.5);
      ctx.fillRect(4, -this.r * 0.72, 1.5, 1.5);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#1a0f06';
      ctx.fillRect(-3, -this.r * 0.7, 1.5, 1);
      ctx.fillRect(1.5, -this.r * 0.7, 1.5, 1);
    }

    if (this.kind === 'raider') {
      ctx.fillStyle = this.hair;
      ctx.beginPath();
      ctx.arc(0, -this.r * 0.78, this.r * 0.48, Math.PI + 0.2, -0.2);
      ctx.fill();
    } else if (this.kind === 'mutant') {
      ctx.fillStyle = '#2a3a1a';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 3, -this.r * 0.85);
        ctx.lineTo(i * 3 - 1, -this.r * 1.2);
        ctx.lineTo(i * 3 + 1, -this.r * 1.2);
        ctx.closePath(); ctx.fill();
      }
    } else if (this.kind === 'runner') {
      ctx.fillStyle = this.hair;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 1.6, -this.r * 0.78);
        ctx.lineTo(i * 1.6 - 0.6, -this.r * 1.15);
        ctx.lineTo(i * 1.6 + 0.6, -this.r * 1.15);
        ctx.closePath(); ctx.fill();
      }
    } else if (this.kind === 'blinker') {
      ctx.fillStyle = '#1a1025';
      ctx.beginPath();
      ctx.arc(0, -this.r * 0.5, this.r * 0.7, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180, 130, 240, 0.6)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) {
        const ang = state.time * 1.5 + i * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * (this.r + 1), Math.sin(ang) * (this.r + 1));
        ctx.lineTo(Math.cos(ang) * (this.r + 5), Math.sin(ang) * (this.r + 5) - 1);
        ctx.stroke();
      }
    } else if (this.kind === 'miniboss') {
      ctx.fillStyle = '#1a0f06';
      ctx.beginPath();
      ctx.arc(0, -this.r * 0.72, this.r * 0.62, Math.PI - 0.2, 0.2);
      ctx.fill();
      ctx.fillStyle = '#5a3025';
      ctx.fillRect(-this.r * 0.55, -this.r * 0.6, this.r * 1.1, 2);
      ctx.fillStyle = '#3a2515';
      ctx.beginPath();
      ctx.moveTo(-this.r * 0.85, -2); ctx.lineTo(-this.r * 1.3, -this.r * 0.5); ctx.lineTo(-this.r * 0.6, -this.r * 0.2); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(this.r * 0.85, -2); ctx.lineTo(this.r * 1.3, -this.r * 0.5); ctx.lineTo(this.r * 0.6, -this.r * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(-this.r * 0.4, -this.r * 0.05, this.r * 0.8, this.r * 0.55);
      ctx.strokeStyle = '#1a0f06'; ctx.lineWidth = 0.8;
      ctx.strokeRect(-this.r * 0.4, -this.r * 0.05, this.r * 0.8, this.r * 0.55);
    } else if (this.kind === 'bigboss') {
      ctx.strokeStyle = 'rgba(160, 240, 80, 0.75)'; ctx.lineWidth = 1.4;
      ctx.shadowColor = '#a0ff40'; ctx.shadowBlur = 6;
      for (let i = 0; i < 5; i++) {
        const ang = i * (Math.PI * 2 / 5) + this.bossAura * 0.3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const r1 = this.r * 0.5, r2 = this.r * 0.95;
        ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        ctx.lineTo(Math.cos(ang + 0.25) * r2, Math.sin(ang + 0.25) * r2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a1505';
      for (let i = -2; i <= 2; i++) {
        const ang = i * 0.32 - Math.PI / 2;
        const baseR = this.r * 0.85, tipR = this.r * 1.45;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * baseR, Math.sin(ang) * baseR);
        ctx.lineTo(Math.cos(ang - 0.06) * baseR * 1.05, Math.sin(ang - 0.06) * baseR * 1.05);
        ctx.lineTo(Math.cos(ang) * tipR, Math.sin(ang) * tipR);
        ctx.lineTo(Math.cos(ang + 0.06) * baseR * 1.05, Math.sin(ang + 0.06) * baseR * 1.05);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#fff8d0';
      ctx.beginPath();
      ctx.moveTo(-2.5, -this.r * 0.4); ctx.lineTo(-1.5, -this.r * 0.2); ctx.lineTo(-0.5, -this.r * 0.4); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.5, -this.r * 0.4); ctx.lineTo(1.5, -this.r * 0.2); ctx.lineTo(2.5, -this.r * 0.4); ctx.fill();
    } else {
      ctx.fillStyle = '#5a4a35';
      ctx.fillRect(-3, -this.r * 0.9, 2, 2);
      ctx.fillRect(1, -this.r * 0.85, 2, 1.5);
    }

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

    const wpnLen = this.kind === 'bigboss' ? 14 : this.kind === 'miniboss' ? 11 : this.kind === 'mutant' ? 8 : 5;
    const wpnW   = this.kind === 'bigboss' ? 3.5 : this.kind === 'miniboss' ? 3  : this.kind === 'mutant' ? 2 : 1.5;
    const wx = this.x + Math.cos(this.facing) * (this.r + 2);
    const wy = this.y + Math.sin(this.facing) * (this.r + 2);
    ctx.strokeStyle = (this.kind === 'mutant' || this.kind === 'bigboss') ? '#8a7060' : '#4a3a28';
    ctx.lineWidth = wpnW;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + Math.cos(this.facing) * wpnLen, wy + Math.sin(this.facing) * wpnLen);
    ctx.stroke();

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
