import { G } from '../globals.js';
import { rand, dist2 } from '../utils/math.js';
import { state } from '../state.js';

export class SprayBullet {
  constructor(x, y, angle, dmg) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    const speed = 480;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.maxRange = 320;
    this.dmg = dmg;
    this.dead = false;
    this.r = 3;
  }

  update(dt) {
    if (this.dead) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.hypot(this.x - this.startX, this.y - this.startY) > this.maxRange) { this.dead = true; return; }
    if (this.x < -10 || this.x > G.W + 10 || this.y < -10 || this.y > G.PLAY_BOTTOM + 10) { this.dead = true; return; }
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (dist2(this.x, this.y, e.x, e.y) < e.r + this.r) {
        e.hp -= this.dmg;
        e.hurtFlash = 1;
        e.knockX += this.vx * 0.18;
        e.knockY += this.vy * 0.18;
        for (let i = 0; i < 5; i++) {
          state.particles.push({
            x: e.x + rand(-2, 2), y: e.y + rand(-2, 2),
            vx: rand(-60, 60), vy: rand(-80, -10),
            life: rand(0.2, 0.5), maxLife: 0.5,
            color: e.bloodColor, size: rand(1, 2), realtime: true,
          });
        }
        this.dead = true;
        return;
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x - this.vx * 0.018, this.y - this.vy * 0.018);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.fillStyle = '#fff8c0';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
