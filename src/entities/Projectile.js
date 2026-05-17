import { G } from '../globals.js';
import { rand, dist2 } from '../utils/math.js';
import { state } from '../state.js';
import { pushDamageNumber } from '../render/effects.js';
import { playSfx } from '../systems/audio.js';
import { drawWeaponSprite, WEAPON_SPRITES } from '../render/weaponSprites.js';

export class Projectile {
  constructor(x, y, target, dmg, facing, owner = null, wDef = {}) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    this.z = 12;
    this.owner = owner;
    this.target = target;
    this.targetX = target.x;
    this.targetY = target.y;
    this.speed = wDef.projectileSpeed ?? 430;
    this.returnSpeed = (wDef.projectileSpeed ?? 430) * 1.2;
    this.maxRange = wDef.projectileMaxRange ?? 280;
    this.returns = wDef.returns !== false;
    this.piercing = wDef.piercing ?? false;
    this.aoeRadius = wDef.aoeRadius ?? 0;
    this.dmg = dmg;
    this.dead = false;
    this.returning = false;
    this.hasHit = false;
    this.key = wDef.key;
    this.rot = facing;
    this.spin = (wDef.type === 'ranged') ? 0 : 18;
    this.facing = facing;
    this.r = 5;
    this.life = 0;
    this.maxLife = 2.5;
    const sfxThrow = wDef.sfxThrow || 'weapon.thrownClub.throw';
    const sfxSynthetic = wDef.sfxFallbackThrow || 'shoot';
    this.flightSound = playSfx(sfxThrow, { synthetic: sfxSynthetic });
    this._sfxImpact = wDef.sfxImpact || 'weapon.thrownClub.impact';
    this._sfxImpactFallback = wDef.sfxFallbackImpact || 'hit';
  }

  update(dt) {
    if (this.dead) return;
    this.life += dt;
    this.rot += this.spin * dt;

    if (this.life > this.maxLife) {
      this.cleanup();
      return;
    }

    if (this.returning) {
      this.updateReturn(dt);
    } else {
      this.updateOutbound(dt);
    }
  }

  updateOutbound(dt) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    this.facing = Math.atan2(dy, dx);
    this.x += (dx / d) * this.speed * dt;
    this.y += (dy / d) * this.speed * dt;

    const traveled = Math.hypot(this.x - this.startX, this.y - this.startY);
    if (traveled > this.maxRange || d < 8) {
      this.returns ? this.beginReturn() : this.cleanup();
      return;
    }

    for (const e of state.enemies) {
      if (e.dead) continue;
      if (dist2(this.x, this.y, e.x, e.y) < e.r + this.r) {
        this.hitEnemy(e);
        if (!this.piercing) {
          this.returns ? this.beginReturn() : this.cleanup();
          return;
        }
      }
    }
  }

  updateReturn(dt) {
    if (!this.owner || this.owner.dead) {
      this.cleanup();
      return;
    }

    const dx = this.owner.x - this.x;
    const dy = this.owner.y - this.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    this.facing = Math.atan2(dy, dx);
    this.x += (dx / d) * this.returnSpeed * dt;
    this.y += (dy / d) * this.returnSpeed * dt;

    if (d < this.owner.r + this.r + 5) {
      this.cleanup();
    }
  }

  hitEnemy(e) {
    if (!this.piercing && this.hasHit) return;
    if (this._hitSet?.has(e)) return;
    if (!this._hitSet) this._hitSet = new Set();
    this._hitSet.add(e);
    if (!this.piercing) this.hasHit = true;

    this.stopFlightSound();
    playSfx(this._sfxImpact, { fallback: 'weapon.impact.default', synthetic: this._sfxImpactFallback });
    playSfx(e.kind === 'bigboss' || e.kind === 'miniboss' ? 'boss.hit.default' : 'alien.hit.default', { synthetic: 'hit' });

    if (this.aoeRadius > 0) {
      for (const ae of state.enemies) {
        if (ae.dead || this._hitSet.has(ae)) continue;
        if (dist2(this.x, this.y, ae.x, ae.y) < this.aoeRadius) {
          ae.hp -= this.dmg * 0.6;
          ae.hurtFlash = 1;
          this._hitSet.add(ae);
        }
      }
    }

    e.hp -= this.dmg;
    e.knockX += Math.cos(this.facing) * this.speed * 0.32;
    e.knockY += Math.sin(this.facing) * this.speed * 0.32;
    e.hurtFlash = 1;
    state.bloodStains.push({ x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), r: e.r * rand(0.5, 0.8), rot: rand(0, Math.PI), a: rand(0.3, 0.5) });
    for (let i = 0; i < 9; i++) {
      state.particles.push({
        x: e.x + rand(-3, 3), y: e.y + rand(-3, 3),
        vx: rand(-90, 90), vy: rand(-110, -10),
        life: rand(0.3, 0.6), maxLife: 0.6,
        color: e.bloodColor, size: rand(1.2, 2.5), realtime: true,
      });
    }
    pushDamageNumber(e.x, e.y - e.r - 4, this.dmg);
    if (!state.settings?.noShake) state.shake = Math.max(state.shake, 1);
  }

  beginReturn() {
    this.returning = true;
    this.stopFlightSound();
  }

  stopFlightSound() {
    if (this.flightSound) {
      this.flightSound.stop(0.06);
      this.flightSound = null;
    }
  }

  cleanup() {
    this.stopFlightSound();
    this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;

    const trailScale = this.returning ? 0.014 : 0.024;
    ctx.strokeStyle = this.returning ? 'rgba(160, 190, 210, 0.35)' : 'rgba(180, 160, 130, 0.45)';
    ctx.lineWidth = this.returning ? 1.0 : 1.4;
    ctx.beginPath();
    ctx.moveTo(this.x - Math.cos(this.facing) * this.speed * trailScale, this.y - Math.sin(this.facing) * this.speed * trailScale);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();

    ctx.save();
    ctx.translate(this.x, this.y - this.z);
    ctx.rotate(this.rot);

    if (this.key === 'bow' || this.key === 'crossbow') {
      ctx.strokeStyle = '#5a3510';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      ctx.strokeStyle = '#cfd6dc';
      ctx.beginPath();
      ctx.moveTo(4, -3);
      ctx.lineTo(9, 0);
      ctx.lineTo(4, 3);
      ctx.stroke();
    } else if (this.key && WEAPON_SPRITES[this.key]) {
      drawWeaponSprite(ctx, this.key, 0, 0, 1.4, Math.PI / 4);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 6, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#3a2510';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(5, 0);
      ctx.stroke();
      ctx.strokeStyle = '#6b4a20';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(5, 0);
      ctx.stroke();
      ctx.strokeStyle = '#1a0f06';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(-3, 0);
      ctx.stroke();
      ctx.strokeStyle = '#2a1a08';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(8, 4);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.restore();
  }
}
