import { G } from '../globals.js';
import { rand, dist2 } from '../utils/math.js';
import { state } from '../state.js';
import { pushDamageNumber } from '../render/effects.js';
import { playSfx } from '../systems/audio.js';

export class Projectile {
  constructor(x, y, target, dmg, facing, owner = null) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    this.owner = owner;
    this.target = target;
    this.targetX = target.x;
    this.targetY = target.y;
    this.maxRange = 280;
    this.speed = 430;
    this.returnSpeed = 520;
    this.dmg = dmg;
    this.dead = false;
    this.returning = false;
    this.hasHit = false;
    this.rot = facing;
    this.spin = 18;
    this.facing = facing;
    this.r = 5;
    this.life = 0;
    this.maxLife = 2.2;
    this.flightSound = playSfx('weapon.thrownClub.throw', { synthetic: 'shoot' });
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
      this.beginReturn();
      return;
    }

    for (const e of state.enemies) {
      if (e.dead) continue;
      if (dist2(this.x, this.y, e.x, e.y) < e.r + this.r) {
        this.hitEnemy(e);
        this.beginReturn();
        return;
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
    if (this.hasHit) return;
    this.hasHit = true;
    this.stopFlightSound();
    playSfx('weapon.thrownClub.impact', { fallback: 'weapon.impact.default', synthetic: 'hit' });
    playSfx(e.kind === 'bigboss' || e.kind === 'miniboss' ? 'boss.hit.default' : 'alien.hit.default', { synthetic: 'hit' });

    e.hp -= this.dmg;
    e.knockX += Math.cos(this.facing) * this.speed * 0.32;
    e.knockY += Math.sin(this.facing) * this.speed * 0.32;
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
    state.shake = Math.max(state.shake, 1);
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
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

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
    ctx.restore();
  }
}
