import { G } from '../globals.js';
import { state } from '../state.js';

export function drawBackground() {
  const { ctx, W, H, PLAY_BOTTOM } = G;

  const t = state.time;

  // Layered ground gradient — warmer crust on top, cooler shadow toward the bottom.
  const ground = ctx.createLinearGradient(0, 0, 0, H);
  ground.addColorStop(0,   '#5b3f22');
  ground.addColorStop(0.45,'#6b5335');
  ground.addColorStop(0.85,'#523a22');
  ground.addColorStop(1,   '#3a2614');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);

  // Soft soil mottling.
  ctx.fillStyle = 'rgba(90, 70, 45, 0.35)';
  for (let i = 0; i < 160; i++) {
    const x = (i * 173 + 37) % W;
    const y = (i * 91 + 53) % H;
    ctx.fillRect(x, y, 2, 1);
  }
  ctx.fillStyle = 'rgba(140, 110, 70, 0.28)';
  for (let i = 0; i < 110; i++) {
    const x = (i * 211 + 11) % W;
    const y = (i * 67 + 31) % H;
    ctx.fillRect(x, y, 1, 1);
  }

  // Larger soil patches with very faint warm rim.
  for (let i = 0; i < 25; i++) {
    const px = (i * 97 + 31) % W;
    const py = (i * 53 + 19) % H;
    ctx.fillStyle = `rgba(30, 20, 10, ${0.13 + (i % 3) * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(px, py, 50 + (i * 7) % 40, 30 + (i * 5) % 25, (i * 0.3) % (Math.PI * 2), 0, Math.PI * 2);
    ctx.fill();
  }

  // Cracks.
  ctx.strokeStyle = 'rgba(20, 12, 6, 0.5)';
  ctx.lineWidth = 0.8;
  for (const crack of state.cracks) {
    ctx.beginPath();
    ctx.moveTo(crack[0].x, crack[0].y);
    for (let i = 1; i < crack.length; i++) ctx.lineTo(crack[i].x, crack[i].y);
    ctx.stroke();
  }

  // Old blood splatters bake into the ground.
  for (const b of state.bloodStains) {
    ctx.fillStyle = `rgba(50, 15, 10, ${b.a})`;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r, b.r * 0.55, b.rot, 0, Math.PI * 2);
    ctx.fill();
  }

  // Debris scatter.
  for (const d of state.debris) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.scale(d.size, d.size);
    if (d.type === 0) {
      ctx.fillStyle = `rgba(210, 195, 160, ${d.shade * 0.85})`;
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0f06';
      ctx.fillRect(-2, -1, 1.2, 1.5); ctx.fillRect(0.8, -1, 1.2, 1.5); ctx.fillRect(-0.5, 1.2, 1, 1);
    } else if (d.type === 1) {
      ctx.strokeStyle = `rgba(25, 18, 12, ${d.shade})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(50, 35, 25, ${d.shade * 0.6})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.stroke();
    } else if (d.type === 2) {
      ctx.fillStyle = `rgba(75, 45, 25, ${d.shade})`;
      ctx.fillRect(-7, -1.2, 14, 2.4);
      ctx.fillStyle = `rgba(40, 25, 12, ${d.shade * 0.8})`;
      ctx.fillRect(-7, -1.2, 14, 0.8);
    } else if (d.type === 3) {
      ctx.fillStyle = `rgba(215, 200, 170, ${d.shade * 0.8})`;
      ctx.fillRect(-5, -0.8, 10, 1.6);
      ctx.beginPath();
      ctx.arc(-5, 0, 1.6, 0, Math.PI * 2); ctx.arc(5, 0, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(110, 55, 28, ${d.shade * 0.85})`;
      ctx.fillRect(-4, -3, 8, 6);
      ctx.fillStyle = `rgba(30, 15, 8, ${d.shade * 0.5})`;
      ctx.fillRect(-3, -2, 2, 1); ctx.fillRect(1, 0, 2, 2);
      ctx.fillStyle = `rgba(180, 90, 45, ${d.shade * 0.3})`;
      ctx.fillRect(-2, -1, 1, 1);
    }
    ctx.restore();
  }

  // P-RAY grass tufts (silhouette pass).
  ctx.lineCap = 'round';
  for (const g of state.grassTufts) {
    const sway = Math.sin(t * 1.1 + g.phase) * 0.55;
    const half = (g.blades - 1) / 2;
    for (let b = 0; b < g.blades; b++) {
      const off = (b - half);
      const ax = g.x + off * 1.5 * g.size;
      const ay = g.y;
      const tipLen = (5.5 + Math.abs(off) * 0.6) * g.size;
      const bx = ax + (sway + off * 0.18) * g.size;
      const by = ay - tipLen;
      ctx.strokeStyle = `hsl(${g.hue}, 55%, 22%)`;
      ctx.lineWidth = 1.6 * g.size;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = `hsla(${g.hue}, 80%, 60%, 0.95)`;
      ctx.lineWidth = 0.7 * g.size;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';

  // Dust haze (existing motes).
  for (const p of state.dust) {
    const fade = 1 - Math.abs(p.life - 0.5) * 2;
    ctx.fillStyle = `rgba(210, 185, 140, ${0.32 * fade})`;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  // Bioluminescent bloom for the tufts (additive).
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of state.grassTufts) {
    const breath = 0.5 + 0.5 * Math.sin(t * 1.7 + g.phase);
    const r = (8 + breath * 4) * g.size;
    const grd = ctx.createRadialGradient(g.x, g.y - 3 * g.size, 0, g.x, g.y - 3 * g.size, r);
    grd.addColorStop(0, `hsla(${g.hue}, 85%, 78%, ${0.22 * g.glow})`);
    grd.addColorStop(0.5, `hsla(${g.hue}, 85%, 55%, ${0.10 * g.glow})`);
    grd.addColorStop(1, `hsla(${g.hue}, 85%, 40%, 0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(g.x - r, g.y - 3 * g.size - r, r * 2, r * 2);
  }
  // Drifting embers (warm motes).
  for (const e of state.embers) {
    const lifeT = e.life / e.maxLife;
    const fade = lifeT < 0.5 ? lifeT * 2 : 1 - (lifeT - 0.5) * 2;
    const r = e.size * 2.5;
    const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
    grd.addColorStop(0, `hsla(${e.hue}, 95%, 70%, ${0.45 * fade})`);
    grd.addColorStop(1, `hsla(${e.hue}, 95%, 40%, 0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
  }
  ctx.restore();

  // Vignette + warm tint.
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.78);
  grad.addColorStop(0, 'rgba(80, 55, 25, 0)');
  grad.addColorStop(0.7, 'rgba(40, 20, 10, 0.42)');
  grad.addColorStop(1, 'rgba(8, 4, 2, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(140, 80, 30, 0.05)';
  ctx.fillRect(0, 0, W, H);
}
