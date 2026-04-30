import { G } from '../globals.js';
import { state } from '../state.js';

export function drawBackground() {
  const { ctx, W, H, PLAY_BOTTOM } = G;

  ctx.fillStyle = '#6b5335';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(90, 70, 45, 0.4)';
  for (let i = 0; i < 160; i++) {
    const x = (i * 173 + 37) % W;
    const y = (i * 91 + 53) % H;
    ctx.fillRect(x, y, 2, 1);
  }
  ctx.fillStyle = 'rgba(130, 100, 60, 0.3)';
  for (let i = 0; i < 110; i++) {
    const x = (i * 211 + 11) % W;
    const y = (i * 67 + 31) % H;
    ctx.fillRect(x, y, 1, 1);
  }

  for (let i = 0; i < 25; i++) {
    const px = (i * 97 + 31) % W;
    const py = (i * 53 + 19) % H;
    ctx.fillStyle = `rgba(30, 20, 10, ${0.13 + (i % 3) * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(px, py, 50 + (i * 7) % 40, 30 + (i * 5) % 25, (i * 0.3) % (Math.PI * 2), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(20, 12, 6, 0.5)';
  ctx.lineWidth = 0.8;
  for (const crack of state.cracks) {
    ctx.beginPath();
    ctx.moveTo(crack[0].x, crack[0].y);
    for (let i = 1; i < crack.length; i++) ctx.lineTo(crack[i].x, crack[i].y);
    ctx.stroke();
  }

  for (const b of state.bloodStains) {
    ctx.fillStyle = `rgba(50, 15, 10, ${b.a})`;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r, b.r * 0.55, b.rot, 0, Math.PI * 2);
    ctx.fill();
  }

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

  for (const p of state.dust) {
    const fade = 1 - Math.abs(p.life - 0.5) * 2;
    ctx.fillStyle = `rgba(210, 185, 140, ${0.35 * fade})`;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, 'rgba(80, 55, 25, 0)');
  grad.addColorStop(0.7, 'rgba(40, 20, 10, 0.4)');
  grad.addColorStop(1, 'rgba(10, 5, 2, 0.8)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(140, 80, 30, 0.05)';
  ctx.fillRect(0, 0, W, H);
}
