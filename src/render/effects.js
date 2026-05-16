import { G } from '../globals.js';
import { rand } from '../utils/math.js';
import { state } from '../state.js';

export function drawBolts() {
  const { ctx } = G;
  if (!state.bolts.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bolt of state.bolts) {
    const intensity = bolt.life / bolt.maxLife;

    // Outer glow — two thick low-opacity strokes replace shadowBlur
    ctx.strokeStyle = `rgba(80, 150, 255, ${intensity * 0.10})`;
    ctx.lineWidth = 30;
    for (let i = 0; i < bolt.points.length - 1; i++) {
      drawZigzag(bolt.points[i].x, bolt.points[i].y, bolt.points[i + 1].x, bolt.points[i + 1].y, 14, 9);
    }
    ctx.strokeStyle = `rgba(120, 180, 255, ${intensity * 0.22})`;
    ctx.lineWidth = 14;
    for (let i = 0; i < bolt.points.length - 1; i++) {
      drawZigzag(bolt.points[i].x, bolt.points[i].y, bolt.points[i + 1].x, bolt.points[i + 1].y, 14, 9);
    }

    // Mid
    ctx.strokeStyle = `rgba(160, 210, 255, ${intensity * 0.85})`;
    ctx.lineWidth = 5;
    for (let i = 0; i < bolt.points.length - 1; i++) {
      drawZigzag(bolt.points[i].x, bolt.points[i].y, bolt.points[i + 1].x, bolt.points[i + 1].y, 12, 5);
    }

    // Core
    ctx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < bolt.points.length - 1; i++) {
      drawZigzag(bolt.points[i].x, bolt.points[i].y, bolt.points[i + 1].x, bolt.points[i + 1].y, 10, 3);
    }

    // Spark nodes — solid circles replace per-node radial gradient
    for (const p of bolt.points) {
      const r = 5 + Math.random() * 3;
      ctx.fillStyle = `rgba(200, 230, 255, ${intensity * 0.8})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawZigzag(x1, y1, x2, y2, segments, jitter) {
  const { ctx } = G;
  const j = jitter ?? 7;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const px = x1 + (x2 - x1) * t + rand(-j, j);
    const py = y1 + (y2 - y1) * t + rand(-j, j);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawExplosions() {
  const { ctx } = G;
  if (!state.explosions.length) return;

  // Expanding smoke/dust ring — no additive blend, no bright core.
  for (const ex of state.explosions) {
    const alpha = ex.life / ex.maxLife;
    ctx.strokeStyle = `rgba(40, 25, 18, ${alpha * 0.55})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r * 0.95, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(160, 80, 30, ${alpha * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawShockwaves() {
  const { ctx } = G;
  if (!state.shockwaves.length) return;
  ctx.save();
  for (const sw of state.shockwaves) {
    const alpha = Math.min(1, sw.life / sw.maxLife);
    ctx.globalCompositeOperation = 'lighter';
    const ringR = sw.r + 2;
    const grd = ctx.createRadialGradient(sw.x, sw.y, sw.r * 0.85, sw.x, sw.y, ringR + 6);
    grd.addColorStop(0, 'rgba(255, 220, 80, 0)');
    grd.addColorStop(0.5, `rgba(255, 220, 80, ${alpha * 0.65})`);
    grd.addColorStop(1, 'rgba(180, 240, 80, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, ringR + 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    // Outer soft ring (replaces shadowBlur 18)
    ctx.strokeStyle = `rgba(255, 220, 80, ${alpha * 0.25})`;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    // Bright ring
    ctx.strokeStyle = `rgba(255, 220, 80, ${alpha * 0.95})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(180, 240, 80, ${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r - 4, 0, Math.PI * 2);
    ctx.stroke();

    if (state.particles.length < 350 && Math.random() < 0.6) {
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
  ctx.restore();
}

export function drawParticles() {
  const { ctx } = G;
  if (!state.particles.length) return;

  // Pass 1: solid (regular) particles.
  for (const p of state.particles) {
    if (p.additive) continue;
    const a = Math.min(1, p.life / 0.3);
    ctx.globalAlpha = a;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    const speed = Math.hypot(p.vx, p.vy);
    const stretch = Math.min(speed * 0.04, 12);
    if (stretch > 1.5) {
      ctx.lineTo(p.x - (p.vx / speed) * stretch, p.y - (p.vy / speed) * stretch);
    } else {
      ctx.lineTo(p.x - 0.1, p.y);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;

  // Pass 2: additive glow particles — soft round bloom.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of state.particles) {
    if (!p.additive) continue;
    const a = Math.min(1, p.life / 0.3);
    const r = p.size * 2.4;
    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grd.addColorStop(0, p.color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = grd;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawFloatingTexts() {
  const { ctx } = G;
  if (!state.floatingTexts.length) return;
  ctx.save();
  ctx.textAlign = 'center';
  for (const ft of state.floatingTexts) {
    const t = 1 - ft.life / ft.maxLife;
    const alpha = ft.life > 0.18 ? Math.min(1, ft.life * 4) : ft.life / 0.18;
    const yOff = -t * 26 - (ft.crit ? 6 : 0);
    const size = ft.crit ? 17 : ft.size || 12;
    const [r, g, b] = ft.rgb;
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.65})`;
    ctx.fillText(ft.text, ft.x + 1, ft.y + yOff + 1);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fillText(ft.text, ft.x, ft.y + yOff);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

export function drawScreenFlash() {
  const { ctx, W, H } = G;
  if (state.flashAlpha <= 0.01 || state.settings.noLightning) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = state.flashColor;
  ctx.globalAlpha = Math.min(0.85, state.flashAlpha);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function pushFloatingText(x, y, text, rgb, opts) {
  const o = opts || {};
  state.floatingTexts.push({
    x, y, text,
    rgb,
    life: o.life || 0.85,
    maxLife: o.life || 0.85,
    crit: !!o.crit,
    size: o.size,
  });
}

export function pushDamageNumber(x, y, dmg, opts) {
  const o = opts || {};
  const crit = !!o.crit;
  const rgb = o.rgb || (crit ? [255, 220, 90] : [255, 230, 200]);
  pushFloatingText(x, y, Math.round(dmg).toString(), rgb, { crit, life: crit ? 1.0 : 0.7 });
}

export function drawPickupRings(ctx) {
  if (!state.settings.showPickupRing) return;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120, 220, 140, 0.18)';
  ctx.fillStyle   = 'rgba(120, 220, 140, 0.05)';
  for (const u of state.units) {
    if (u.dead) continue;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.pickupR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

let crtPattern = null;

export function drawCRTOverlay() {
  const { ctx, W, PLAY_BOTTOM } = G;
  
  if (!crtPattern) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 1;
    pCanvas.height = 3;
    const pCtx = pCanvas.getContext('2d');
    pCtx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    pCtx.fillRect(0, 0, 1, 1);
    pCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    pCtx.fillRect(0, 1, 1, 1);
    crtPattern = ctx.createPattern(pCanvas, 'repeat');
  }

  ctx.save();
  ctx.fillStyle = crtPattern;
  ctx.fillRect(0, 0, W, PLAY_BOTTOM);

  if (state.shake > 3) {
    const shift = Math.min(state.shake * 0.4, 6);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.06)';
    ctx.fillRect(shift, 0, W, PLAY_BOTTOM);
    ctx.fillStyle = 'rgba(0, 255, 255, 0.06)';
    ctx.fillRect(-shift, 0, W, PLAY_BOTTOM);
  }
  ctx.restore();
}
