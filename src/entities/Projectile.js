import { G } from '../globals.js';
import { rand, dist2 } from '../utils/math.js';
import { state } from '../state.js';
import { pushDamageNumber } from '../render/effects.js';

export class Projectile {
  constructor(x, y, target, dmg, facing) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    const dx = target.x - x, dy = target.y - y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const speed = 380;
    this.vx = (dx / d) * speed;
    this.vy = (dy / d) * speed;
    this.maxRange = 280;
    this.dmg = dmg;
    this.dead = false;
    this.rot = facing;
    this.spin = 18;
    this.facing = facing;
    this.r = 5;
    this.life = 0;
  }

  update(dt) {
    if (this.dead) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.spin * dt;
    this.life += dt;

    const traveled = Math.hypot(this.x - this.startX, this.y - this.startY);
    if (traveled > this.maxRange) { this.dead = true; return; }
    if (this.x < -10 || this.x > G.W + 10 || this.y < -10 || this.y > G.PLAY_BOTTOM + 10) {
      this.dead = true; return;
    }

    for (const e of state.enemies) {
      if (e.dead) continue;
      if (dist2(this.x, this.y, e.x, e.y) < e.r + this.r) {
        e.hp -= this.dmg;
        e.hurtFlash = 1;
        e.knockX += this.vx * 0.32;
        e.knockY += this.vy * 0.32;
        state.bloodStains.push({ x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), r: e.r * rand(0.5, 0.8), rot: rand(0, Math.PI), a: rand(0.3, 0.5) });
        for (let i = 0; i < 9; i++) {
          state.particles.push({
            x: e.x + rand(-3, 3), y: e.y + rand(-3, 3),
            vx: rand(-90, 90), vy: rand(-110, -10),
            life: rand(0.3, 0.6), maxLife: 0.6,
            color: e.bloodColor, size: rand(1.2, 2.5), realtime: true,
          });
        }
        // Wood splinters glow for an instant.
        for (let i = 0; i < 4; i++) {
          state.particles.push({
            x: this.x, y: this.y,
            vx: rand(-50, 50), vy: rand(-60, 0),
            life: rand(0.18, 0.36), maxLife: 0.36,
            color: 'rgba(255, 220, 160, 1)', size: rand(1.5, 3), realtime: true, additive: true,
          });
        }
        pushDamageNumber(e.x, e.y - e.r - 4, this.dmg);
        state.shake = Math.max(state.shake, 2.5);
        state.hitStop = Math.max(state.hitStop, 0.022);
        this.dead = true;
        return;
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;

    // Additive motion streak.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const streakR = 9;
    const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, streakR);
    grd.addColorStop(0, 'rgba(255, 220, 150, 0.6)');
    grd.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(this.x - streakR, this.y - streakR, streakR * 2, streakR * 2);
    ctx.restore();

    ctx.strokeStyle = 'rgba(180, 160, 130, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(this.x - this.vx * 0.025, this.y - this.vy * 0.025);
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
