import { rand } from '../utils/math.js';
import { resolveAsset } from '../config/assets.js';

export class Loot {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.type = type;
    this.bob = rand(0, Math.PI * 2);
    this.spawnTime = 0;
    this.picked = false;
    this.z = 0;
    this.vz = 160;
    this.r = 9;
    this._anim = { name: 'idle', frame: 0, timer: 0 };
  }

  update(dt) {
    if (this.z > 0 || this.vz !== 0) {
      this.vz -= 800 * dt;
      this.z += this.vz * dt;
      if (this.z < 0) {
        this.z = 0;
        this.vz = -this.vz * 0.4;
        if (Math.abs(this.vz) < 30) this.vz = 0;
      }
    }
    this.bob += dt * 2.5;
    this.spawnTime += dt;
    const sprite = resolveAsset('loot', this.type);
    if (sprite?.isAnimated) {
      const anim = sprite.animations.idle;
      if (anim) {
        this._anim.timer += dt;
        const frameDur = 1 / anim.fps;
        while (this._anim.timer >= frameDur) {
          this._anim.timer -= frameDur;
          this._anim.frame = (this._anim.frame + 1) % anim.frames;
        }
      }
    }
  }

  draw(ctx) {
    if (this.picked) return;
    const yOff = Math.sin(this.bob) * 1.6 - this.z;
    const popIn = Math.min(1, this.spawnTime * 5);
    const easedPop = 1 - Math.pow(1 - popIn, 3);

    const glowColor = this.type === 'medkit'       ? 'rgba(255, 90, 80, 0.22)'
                    : this.type === 'stimpack'      ? 'rgba(80, 240, 130, 0.22)'
                    : this.type === 'spray_gun'     ? 'rgba(255, 160, 40, 0.35)'
                    : this.type === 'samurai_sword' ? 'rgba(220, 220, 80, 0.35)'
                    : this.type === 'banana_bomb'   ? 'rgba(200, 240, 60, 0.4)'
                    : 'rgba(255, 170, 60, 0.28)';
    const haloR = (12 + Math.sin(this.bob * 1.5) * 2.5) * easedPop;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y + yOff, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(this.x, this.y + yOff);
    ctx.scale(easedPop, easedPop);

    const sprite = resolveAsset('loot', this.type);
    if (sprite) {
      sprite.draw(ctx, this._anim, -this.r, -this.r, this.r * 2, this.r * 2);
      ctx.restore();
      return;
    }

    if (this.type === 'medkit') {
      ctx.fillStyle = '#e8e0c8';
      ctx.fillRect(-6, -5, 12, 10);
      ctx.strokeStyle = '#1a0f06';
      ctx.lineWidth = 0.9;
      ctx.strokeRect(-6, -5, 12, 10);
      ctx.fillStyle = '#5a4a30';
      ctx.fillRect(-6, -5, 2, 1.4);
      ctx.fillRect(4, -5, 2, 1.4);
      ctx.fillRect(-6, 3.6, 2, 1.4);
      ctx.fillRect(4, 3.6, 2, 1.4);
      ctx.fillStyle = '#c53030';
      ctx.fillRect(-1.3, -3.5, 2.6, 7);
      ctx.fillRect(-3.5, -1.3, 7, 2.6);
      ctx.strokeStyle = '#5a1010';
      ctx.lineWidth = 0.4;
      ctx.strokeRect(-1.3, -3.5, 2.6, 7);
      ctx.strokeRect(-3.5, -1.3, 7, 2.6);
    } else if (this.type === 'stimpack') {
      ctx.fillStyle = '#d8d4c0';
      ctx.fillRect(-5, -2.2, 9, 4.4);
      ctx.strokeStyle = '#1a0f06';
      ctx.lineWidth = 0.7;
      ctx.strokeRect(-5, -2.2, 9, 4.4);
      ctx.fillStyle = '#2faa48';
      ctx.fillRect(-4, -1.6, 6.5, 3.2);
      ctx.fillStyle = '#5fd06a';
      ctx.fillRect(-4, -1.6, 6.5, 1);
      ctx.fillStyle = '#1a0f06';
      ctx.fillRect(-7.5, -2.8, 2.5, 5.6);
      ctx.fillStyle = '#5a3a25';
      ctx.fillRect(-7, -2.4, 1.5, 4.8);
      ctx.strokeStyle = '#9a9aa0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4, 0); ctx.lineTo(8.5, 0);
      ctx.stroke();
    } else if (this.type === 'bomb') {
      ctx.fillStyle = '#1a1a22';
      ctx.beginPath();
      ctx.arc(0, 1, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a0608';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(160, 150, 170, 0.55)';
      ctx.beginPath();
      ctx.arc(-2, -1, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(-1.5, -6, 3, 1.5);
      ctx.strokeStyle = '#5a4a30';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(3.5, -8.5, 5.5, -7);
      ctx.stroke();
      const sparkPhase = (this.bob * 4) % 1;
      ctx.fillStyle = '#ffe070';
      ctx.beginPath();
      ctx.arc(5.5, -7, 1.6 + sparkPhase * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffa040';
      ctx.beginPath();
      ctx.arc(5.5, -7, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8d0';
      ctx.beginPath();
      ctx.arc(5.5, -7, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'spray_gun') {
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(-7, -2.5, 13, 5);
      ctx.strokeStyle = '#1a1a28';
      ctx.lineWidth = 0.7;
      ctx.strokeRect(-7, -2.5, 13, 5);
      ctx.fillStyle = '#5a5a6a';
      ctx.fillRect(3, -1.2, 6, 2.4);
      ctx.fillStyle = '#2a2020';
      ctx.fillRect(-5, 2.5, 3.5, 4.5);
      ctx.strokeStyle = '#1a1010';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-5, 2.5, 3.5, 4.5);
      ctx.fillStyle = '#ffcc40';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(9.5, -2 + i * 2, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-1, 2.5); ctx.lineTo(1, 4.5);
      ctx.stroke();
    } else if (this.type === 'samurai_sword') {
      ctx.strokeStyle = '#d8e8f0';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-8, -0.8); ctx.lineTo(8, -0.8);
      ctx.stroke();
      ctx.fillStyle = '#c8a040';
      ctx.fillRect(-2, -3, 4, 6);
      ctx.strokeStyle = '#8a6820';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(-2, -3, 4, 6);
      ctx.fillStyle = '#2a1a0a';
      ctx.fillRect(-8, -1.5, 5, 3);
      ctx.strokeStyle = '#5a3a15';
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-7 + i * 1.5, -1.5); ctx.lineTo(-7 + i * 1.5, 1.5);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#e0eef8';
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(11, -1.5); ctx.lineTo(11, 1.5);
      ctx.closePath(); ctx.fill();
    } else if (this.type === 'banana_bomb') {
      ctx.strokeStyle = '#e8d820';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, 3);
      ctx.quadraticCurveTo(0, -9, 7, 2);
      ctx.stroke();
      ctx.strokeStyle = '#fff8a0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, 2);
      ctx.quadraticCurveTo(0, -7, 6, 1);
      ctx.stroke();
      ctx.fillStyle = '#8a7010';
      ctx.beginPath(); ctx.arc(-6, 3, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(7, 2, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a4a30';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(1, -6);
      ctx.quadraticCurveTo(4, -10, 6, -8);
      ctx.stroke();
      const bSpark = (this.bob * 3.5) % 1;
      ctx.fillStyle = '#ffe070';
      ctx.beginPath();
      ctx.arc(6, -8, 1.4 + bSpark * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineCap = 'butt';
    }

    ctx.restore();
  }
}
