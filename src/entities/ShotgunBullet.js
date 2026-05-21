import { G } from '../globals.js';
import { rand, dist2 } from '../utils/math.js';
import { state } from '../state.js';
import { pushDamageNumber } from '../render/effects.js';
import { playSfx } from '../systems/audio.js';

export class ShotgunBullet {
  constructor(x, y, angle, dmg, wDef = {}) {
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    const speed = wDef.projectileSpeed ?? 480;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.maxRange = wDef.atkRange ?? 320;
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
        playSfx('weapon.impact.default');
        playSfx(e.kind === 'bigboss' || e.kind === 'miniboss' ? 'boss.hit.default' : 'alien.hit.default');
        e.hp -= this.dmg;
        e.hurtFlash = 1;
        e.knockX += this.vx * 0.18;
        e.knockY += this.vy * 0.18;
        state.bloodStains.push({ x: e.x + rand(-5, 5), y: e.y + rand(-5, 5), r: e.r * rand(0.4, 0.7), rot: rand(0, Math.PI), a: rand(0.2, 0.4) });
        for (let i = 0; i < 5; i++) {
          state.particles.push({
            x: e.x + rand(-2, 2), y: e.y + rand(-2, 2),
            vx: rand(-60, 60), vy: rand(-80, -10),
            life: rand(0.2, 0.5), maxLife: 0.5,
            color: e.bloodColor, size: rand(1, 2), realtime: true,
          });
        }
        // Bright muzzle pop.
        state.particles.push({
          x: this.x, y: this.y, vx: 0, vy: 0,
          life: 0.13, maxLife: 0.13,
          color: 'rgba(255, 230, 140, 1)', size: 5, realtime: true, additive: true,
        });
        pushDamageNumber(e.x, e.y - e.r - 4, this.dmg, { rgb: [255, 220, 120] });
        this.dead = true;
        return;
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;
    // Additive tracer — orange-yellow streak.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const tx = this.x - this.vx * 0.024;
    const ty = this.y - this.vy * 0.024;
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.95)';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.lineCap = 'butt';
    const r = 5;
    const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    grd.addColorStop(0, 'rgba(255, 250, 220, 1)');
    grd.addColorStop(0.4, 'rgba(255, 200, 80, 0.6)');
    grd.addColorStop(1, 'rgba(255, 100, 40, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(this.x - r, this.y - r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = '#fffae0';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
