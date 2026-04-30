import { G } from '../globals.js';
import { rand } from '../utils/math.js';
import { state } from '../state.js';

export function drawBolts() {
  const { ctx } = G;
  for (const bolt of state.bolts) {
    const intensity = bolt.life / bolt.maxLife;
    ctx.strokeStyle = `rgba(120, 180, 255, ${intensity * 0.4})`;
    ctx.lineWidth = 6;
    ctx.shadowColor = '#80c8ff';
    ctx.shadowBlur = 14 * intensity;
    for (let i = 0; i < bolt.points.length - 1; i++) {
      drawZigzag(bolt.points[i].x, bolt.points[i].y, bolt.points[i + 1].x, bolt.points[i + 1].y, 12);
    }
    ctx.strokeStyle = `rgba(180, 220, 255, ${intensity})`;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < bolt.points.length - 1; i++) {
      drawZigzag(bolt.points[i].x, bolt.points[i].y, bolt.points[i + 1].x, bolt.points[i + 1].y, 10);
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.95})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < bolt.points.length - 1; i++) {
      drawZigzag(bolt.points[i].x, bolt.points[i].y, bolt.points[i + 1].x, bolt.points[i + 1].y, 10);
    }
    ctx.shadowBlur = 0;
  }
}

export function drawZigzag(x1, y1, x2, y2, segments) {
  const { ctx } = G;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const px = x1 + (x2 - x1) * t + rand(-7, 7);
    const py = y1 + (y2 - y1) * t + rand(-7, 7);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawExplosions() {
  const { ctx } = G;
  for (const ex of state.explosions) {
    const t = 1 - ex.life / ex.maxLife;
    const alpha = ex.life / ex.maxLife;
    ctx.strokeStyle = `rgba(255, 220, 140, ${alpha * 0.85})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 140, 60, ${alpha * 0.5})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    if (t < 0.4) {
      const fa = 1 - t / 0.4;
      ctx.fillStyle = `rgba(255, 240, 200, ${fa * 0.5})`;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.maxR * 0.6 * fa, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawShockwaves() {
  const { ctx } = G;
  for (const sw of state.shockwaves) {
    const alpha = Math.min(1, sw.life / sw.maxLife);
    ctx.strokeStyle = `rgba(255, 220, 80, ${alpha * 0.85})`;
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ffe060';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(180, 240, 80, ${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r - 4, 0, Math.PI * 2);
    ctx.stroke();
    if (Math.random() < 0.6) {
      const a = rand(0, Math.PI * 2);
      state.particles.push({
        x: sw.x + Math.cos(a) * sw.r,
        y: sw.y + Math.sin(a) * sw.r,
        vx: Math.cos(a) * rand(40, 100),
        vy: Math.sin(a) * rand(40, 100) - 30,
        life: rand(0.3, 0.6), maxLife: 0.6,
        color: '#5a4a3a', size: rand(1.5, 3), realtime: true,
      });
    }
  }
}

export function drawParticles() {
  const { ctx } = G;
  for (const p of state.particles) {
    const a = Math.min(1, p.life / 0.3);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
