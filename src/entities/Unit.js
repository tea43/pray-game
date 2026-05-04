import { G } from '../globals.js';
import { rand, dist2, clamp } from '../utils/math.js';
import { state } from '../state.js';
import { HERO_DEFS } from '../config/heroes.js';
import { DIFFICULTY_DEFS } from '../config/difficulty.js';
import { resolveAsset } from '../config/assets.js';
import { Projectile } from './Projectile.js';
import { SprayBullet } from './SprayBullet.js';
import { playSfx } from '../systems/audio.js';
import { pushDamageNumber } from '../render/effects.js';

export class Unit {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.tx = x; this.ty = y;
    this.r = 11;
    this.speed = 78;
    this.hp = 100; this.maxHp = 100;
    this.atkRange = 36;
    this.baseAtkDmg = 32;
    this.baseAtkRate = 0.55;
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
    this.activeWeapon = null;
    this.activeWeaponTimer = 0;

    const def = HERO_DEFS[type] || HERO_DEFS.elliot;
    const diff = DIFFICULTY_DEFS[state.difficulty] || DIFFICULTY_DEFS['brood-hunter'];
    this.name = def.name;
    this.abilityKey = def.abilityKey;
    this.abilityName = def.abilityName;
    this.abilityMaxCd = def.abilityMaxCd * diff.hero.abilityCdMult;
    this.abilityColor = def.abilityColor;
    this.weaponType = def.weaponType;
    this.maxHp = Math.round(def.maxHp * diff.hero.hpMult);
    this.hp = this.maxHp;
    this.atkRange = def.atkRange;
    this.baseAtkDmg = def.baseAtkDmg;
    this.baseAtkRate = def.baseAtkRate;
    this.palette = { ...def.palette };
  }

  get atkDmg() {
    let dmg = this.rageTimer > 0 ? this.baseAtkDmg * 2 : this.baseAtkDmg;
    if (this.activeWeapon === 'samurai_sword') dmg *= 2.2;
    return dmg;
  }
  get atkRate() {
    let rate = this.rageTimer > 0 ? this.baseAtkRate * 0.4 : this.baseAtkRate;
    if (this.activeWeapon === 'spray_gun') rate *= 0.25;
    return rate;
  }
  get moving() { return dist2(this.x, this.y, this.tx, this.ty) > 2.5; }

  update(dt) {
    if (this.dead) return;

    this.rageTimer = Math.max(0, this.rageTimer - dt);
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    if (this.activeWeaponTimer > 0) {
      this.activeWeaponTimer -= dt;
      if (this.activeWeaponTimer <= 0) {
        this.activeWeapon = null;
        this.activeWeaponTimer = 0;
      }
    }

    if (this.moving) {
      const dx = this.tx - this.x, dy = this.ty - this.y;
      const d = Math.hypot(dx, dy);
      this.facing = Math.atan2(dy, dx);
      const step = this.speed * dt;
      if (step >= d) { this.x = this.tx; this.y = this.ty; }
      else { this.x += (dx / d) * step; this.y += (dy / d) * step; }
      this.walkCycle += dt * 9;
    }

    this.atkCd -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
    this.swing = Math.max(0, this.swing - dt * 6);
    this.blinkFlash = Math.max(0, this.blinkFlash - dt * 2.5);
    this.throwArm = Math.max(0, this.throwArm - dt * 4);

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

  attack(enemy) {
    this.atkCd = this.atkRate;
    this.facing = Math.atan2(enemy.y - this.y, enemy.x - this.x);
    this.swing = 1;

    if (this.activeWeapon === 'spray_gun') {
      playSfx('weapon.throw.default', { synthetic: 'shoot' });
      this.throwArm = 1;
      const spread = 0.35;
      const bulletCount = 5;
      for (let i = 0; i < bulletCount; i++) {
        const angleOffset = (i / (bulletCount - 1) - 0.5) * spread * 2;
        const bulletAng = this.facing + angleOffset;
        const sx = this.x + Math.cos(bulletAng) * (this.r + 6);
        const sy = this.y + Math.sin(bulletAng) * (this.r + 6);
        state.projectiles.push(new SprayBullet(sx, sy, bulletAng, this.atkDmg * 0.5));
      }
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 2.5);
      return;
    }

    if (this.activeWeapon === 'samurai_sword') {
      playSfx('weapon.samurai.attack', { synthetic: 'hit' });
      const cleaveRange = 80;
      const halfArc = Math.PI * (60 / 180);
      let hit = 0;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const d = dist2(this.x, this.y, e.x, e.y);
        if (d > cleaveRange + e.r) continue;
        const angToE = Math.atan2(e.y - this.y, e.x - this.x);
        let diff = angToE - this.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) > halfArc) continue;
        const dmg = this.atkDmg;
        e.hp -= dmg;
        e.knockX += Math.cos(this.facing) * 120;
        e.knockY += Math.sin(this.facing) * 120;
        e.hurtFlash = 1;
        state.bloodStains.push({ x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), r: e.r * rand(0.6, 1.0), rot: rand(0, Math.PI), a: rand(0.3, 0.6) });
        for (let i = 0; i < 6; i++) {
          state.particles.push({
            x: e.x + rand(-3, 3), y: e.y + rand(-3, 3),
            vx: rand(-80, 80), vy: rand(-100, -10),
            life: rand(0.3, 0.6), maxLife: 0.6,
            color: '#e8d080', size: rand(1.2, 2.5), realtime: true,
          });
        }
        // Additive sword glints.
        for (let i = 0; i < 5; i++) {
          state.particles.push({
            x: e.x + rand(-4, 4), y: e.y + rand(-4, 4),
            vx: rand(-50, 50), vy: rand(-80, -10),
            life: rand(0.2, 0.5), maxLife: 0.5,
            color: 'rgba(255, 240, 180, 1)', size: rand(1.5, 3), realtime: true, additive: true,
          });
        }
        pushDamageNumber(e.x, e.y - e.r - 4, dmg, { crit: true, rgb: [255, 240, 160] });
        hit++;
      }
      if (hit > 0) playSfx('alien.hit.default', { synthetic: 'hit' });
      // Big arc slash — drawn as a brief expanding additive ring at the swing center.
      state.particles.push({
        x: this.x + Math.cos(this.facing) * 24,
        y: this.y + Math.sin(this.facing) * 24,
        vx: 0, vy: 0,
        life: 0.18, maxLife: 0.18,
        color: 'rgba(255, 245, 200, 1)', size: 16, realtime: true, additive: true,
      });
      if (!state.settings.noShake) state.shake = Math.max(state.shake, hit > 1 ? 7 : 3.5);
      if (hit > 0 && !state.settings.noShake) state.hitStop = Math.max(state.hitStop, hit > 2 ? 0.06 : 0.03);
      return;
    }

    if (this.weaponType === 'thrownClub') {
      this.throwArm = 1;
      const dmg = this.atkDmg;
      const sx = this.x + Math.cos(this.facing) * (this.r + 6);
      const sy = this.y + Math.sin(this.facing) * (this.r + 6);
      state.projectiles.push(new Projectile(sx, sy, enemy, dmg, this.facing, this));
      if (!state.settings.noShake) state.shake = Math.max(state.shake, 1.5);
      return;
    }

    if (this.weaponType === 'dualClubs') {
      this.dualSide = !this.dualSide;
    }

    const dmg = this.atkDmg;
    const attackSfx = this.weaponType === 'dualClubs' ? 'weapon.dualClubs.attack' : 'weapon.longClub.attack';
    playSfx(attackSfx, { fallback: 'weapon.attack.default', synthetic: 'hit' });
    playSfx(enemy.kind === 'bigboss' || enemy.kind === 'miniboss' ? 'boss.hit.default' : 'alien.hit.default', { synthetic: 'hit' });
    enemy.hp -= dmg;
    const kb = this.rageTimer > 0 ? 140 : 80;
    enemy.knockX += Math.cos(this.facing) * kb;
    enemy.knockY += Math.sin(this.facing) * kb;
    enemy.hurtFlash = 1;
    state.bloodStains.push({ x: enemy.x + rand(-6, 6), y: enemy.y + rand(-6, 6), r: enemy.r * rand(0.5, 0.8), rot: rand(0, Math.PI), a: rand(0.3, 0.5) });
    const hitCount = this.rageTimer > 0 ? 14 : 10;
    for (let i = 0; i < hitCount; i++) {
      state.particles.push({
        x: enemy.x + rand(-3, 3), y: enemy.y + rand(-3, 3),
        vx: rand(-90, 90), vy: rand(-110, -10),
        life: rand(0.3, 0.7), maxLife: 0.7,
        color: enemy.bloodColor, size: rand(1.2, 2.8), realtime: true,
      });
    }
    // Hit spark — additive flash at the impact point.
    const sparkX = enemy.x - Math.cos(this.facing) * (enemy.r * 0.5);
    const sparkY = enemy.y - Math.sin(this.facing) * (enemy.r * 0.5);
    state.particles.push({
      x: sparkX, y: sparkY, vx: 0, vy: 0,
      life: 0.16, maxLife: 0.16,
      color: this.rageTimer > 0 ? 'rgba(255, 160, 80, 1)' : 'rgba(255, 220, 160, 1)',
      size: this.rageTimer > 0 ? 9 : 6, realtime: true, additive: true,
    });
    pushDamageNumber(enemy.x, enemy.y - enemy.r - 4, dmg, {
      crit: this.rageTimer > 0,
      rgb: this.rageTimer > 0 ? [255, 120, 80] : [255, 230, 200],
    });
    if (!state.settings.noShake) state.shake = Math.max(state.shake, this.rageTimer > 0 ? 5 : 3);
    if (!state.settings.noShake) state.hitStop = Math.max(state.hitStop, this.rageTimer > 0 ? 0.04 : 0.018);
  }

  moveTo(x, y) {
    this.tx = clamp(x, 6, G.W - 6);
    this.ty = clamp(y, 6, G.PLAY_BOTTOM);
    this.aggroTarget = null;
  }
  attackMove(enemy) {
    this.aggroTarget = enemy;
    this.tx = clamp(enemy.x, 6, G.W - 6);
    this.ty = clamp(enemy.y, 6, G.PLAY_BOTTOM);
  }
  stop() { this.tx = this.x; this.ty = this.y; this.aggroTarget = null; }

  cast() {
    if (this.dead || this.abilityCd > 0) return false;
    if (this.type === 'elliot') return this._blink();
    if (this.type === 'dick')   return this._rage();
    if (this.type === 'habib')  return this._chainLightning();
    return false;
  }

  _blink() {
    const mx = state.mouse.x, my = state.mouse.y;
    const dx = mx - this.x, dy = my - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) return false;
    playSfx('ability_blink');
    const maxRange = 240;
    const step = Math.min(d, maxRange);
    // Departure burst.
    for (let i = 0; i < 14; i++) {
      state.particles.push({
        x: this.x, y: this.y,
        vx: rand(-90, 90), vy: rand(-110, 60),
        life: rand(0.35, 0.7), maxLife: 0.7,
        color: '#80c8ff', size: rand(1.5, 3), realtime: true,
      });
    }
    for (let i = 0; i < 10; i++) {
      state.particles.push({
        x: this.x, y: this.y,
        vx: rand(-60, 60), vy: rand(-60, 60),
        life: rand(0.3, 0.55), maxLife: 0.55,
        color: 'rgba(180, 230, 255, 1)', size: rand(2, 4), realtime: true, additive: true,
      });
    }
    const nx = clamp(this.x + (dx / d) * step, 6, G.W - 6);
    const ny = clamp(this.y + (dy / d) * step, 6, G.PLAY_BOTTOM);
    // Streak trail (additive, fades along path).
    const steps = 16;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      state.particles.push({
        x: this.x + (nx - this.x) * t + rand(-1.5, 1.5),
        y: this.y + (ny - this.y) * t + rand(-1.5, 1.5),
        vx: 0, vy: 0,
        life: 0.32, maxLife: 0.32,
        color: 'rgba(180, 230, 255, 1)', size: 3.5, realtime: true, additive: true,
      });
    }
    this.x = nx; this.y = ny;
    this.tx = nx; this.ty = ny;
    this.blinkFlash = 1;
    for (let i = 0; i < 22; i++) {
      state.particles.push({
        x: this.x, y: this.y,
        vx: rand(-130, 130), vy: rand(-130, 80),
        life: rand(0.35, 0.7), maxLife: 0.7,
        color: '#80c8ff', size: rand(1.5, 3), realtime: true,
      });
    }
    for (let i = 0; i < 14; i++) {
      state.particles.push({
        x: this.x, y: this.y,
        vx: rand(-80, 80), vy: rand(-80, 80),
        life: rand(0.3, 0.6), maxLife: 0.6,
        color: 'rgba(200, 240, 255, 1)', size: rand(2, 4), realtime: true, additive: true,
      });
    }
    if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.18); state.flashColor = '#a0d8ff'; }
    this.abilityCd = this.abilityMaxCd;
    if (!state.settings.noShake) state.shake = Math.max(state.shake, 2);
    return true;
  }

  _rage() {
    playSfx('ability_rage');
    this.rageTimer = 5;
    this.abilityCd = this.abilityMaxCd;
    for (let i = 0; i < 28; i++) {
      state.particles.push({
        x: this.x, y: this.y,
        vx: rand(-80, 80), vy: rand(-110, -20),
        life: rand(0.5, 1.1), maxLife: 1.1,
        color: i % 2 ? '#ff3020' : '#ff8030',
        size: rand(1.5, 3), realtime: true,
      });
    }
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(60, 130);
      state.particles.push({
        x: this.x, y: this.y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
        life: rand(0.45, 0.9), maxLife: 0.9,
        color: i % 2 ? 'rgba(255, 90, 40, 1)' : 'rgba(255, 200, 90, 1)',
        size: rand(2.5, 4.5), realtime: true, additive: true,
      });
    }
    if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.22); state.flashColor = '#ff7040'; }
    if (!state.settings.noShake) state.shake = Math.max(state.shake, 4);
    return true;
  }

  _chainLightning() {
    playSfx('ability_lightning');
    const chains = 4;
    const maxRange = 200;
    let cx = this.x, cy = this.y;
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
      const dmg = 30;
      nearest.hp -= dmg;
      nearest.stunTimer = Math.max(nearest.stunTimer, 1.8);
      nearest.hurtFlash = 1;
      nearest.knockX += rand(-30, 30);
      nearest.knockY += rand(-30, 30);
      for (let j = 0; j < 10; j++) {
        state.particles.push({
          x: nearest.x, y: nearest.y,
          vx: rand(-100, 100), vy: rand(-120, -20),
          life: rand(0.3, 0.7), maxLife: 0.7,
          color: j % 2 ? '#a0e0ff' : '#e0f0ff',
          size: rand(1.2, 2.5), realtime: true,
        });
      }
      for (let j = 0; j < 8; j++) {
        state.particles.push({
          x: nearest.x, y: nearest.y,
          vx: rand(-90, 90), vy: rand(-90, 30),
          life: rand(0.25, 0.55), maxLife: 0.55,
          color: 'rgba(180, 230, 255, 1)', size: rand(2, 3.5), realtime: true, additive: true,
        });
      }
      pushDamageNumber(nearest.x, nearest.y - nearest.r - 4, dmg, { rgb: [180, 230, 255] });
      cx = nearest.x; cy = nearest.y;
    }
    if (points.length > 1) {
      state.bolts.push({ points, life: 0.4, maxLife: 0.4 });
      if (!state.settings.noLightning) { state.flashAlpha = Math.max(state.flashAlpha, 0.2); state.flashColor = '#a0d8ff'; }
      if (!state.settings.noShake) state.hitStop = Math.max(state.hitStop, 0.04);
    }
    this.abilityCd = this.abilityMaxCd;
    if (!state.settings.noShake) state.shake = Math.max(state.shake, 5);
    return true;
  }

  draw(ctx) {
    const shadowScale = 1 + Math.sin(state.time * 4 + this.x * 0.1) * 0.05;
    ctx.save();
    ctx.translate(this.x, this.y + this.r - 1);
    ctx.scale(1, 0.4);
    const shadowR = this.r * 1.4 * shadowScale;
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, shadowR);
    grd.addColorStop(0, 'rgba(15,10,5,0.7)');
    grd.addColorStop(1, 'rgba(15,10,5,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, shadowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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
      ctx.drawImage(sprite, -this.r * 1.5, -this.r * 1.5, this.r * 3, this.r * 3);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    } else if (this.type === 'elliot') {
      this._drawElliot(ctx, flashBoost);
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
      ctx.lineTo(this.x + Math.cos(a) * (r + rand(3, 7)) + rand(-2, 2),
                 this.y + Math.sin(a) * (r + rand(3, 7)) + rand(-2, 2));
      ctx.stroke();
    }

    this._drawWeapon(ctx);

    if (this.swing > 0.3 && this.weaponType !== 'thrownClub') {
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

    if (this.activeWeapon) {
      const pulse = 0.6 + Math.sin(state.time * 8) * 0.4;
      ctx.strokeStyle = this.activeWeapon === 'spray_gun'
        ? `rgba(255, 154, 48, ${pulse})`
        : `rgba(232, 224, 96, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = 'bold 8px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.activeWeapon === 'spray_gun' ? '#ff9a30' : '#e8e060';
      const label = this.activeWeapon === 'spray_gun' ? '🔫' : '⚔';
      ctx.fillText(`${label} ${this.activeWeaponTimer.toFixed(0)}s`, this.x, barY - 4);
      ctx.textAlign = 'left';
    }
  }

  _drawElliot(ctx, flashBoost) {
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

    ctx.fillStyle = flashBoost > 0 ? '#ffa090' : p.shirt;
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

    ctx.fillStyle = flashBoost > 0 ? '#ffcaba' : p.skin;
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
    if (this.weaponType === 'longClub')        this._drawLongClub(ctx);
    else if (this.weaponType === 'dualClubs')  this._drawDualClubs(ctx);
    else if (this.weaponType === 'thrownClub') this._drawHeldClubs(ctx);
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
