import { G } from '../globals.js';
import { state } from '../state.js';

// No world-sized offscreen canvas — everything is drawn directly with viewport culling.
export function clearBackgroundCache() { /* no-op: kept for call-site compatibility */ }

// Called inside the camera transform — all positions are world-space.
// Draws only what's visible in the current viewport.
export function drawBackground() {
  const { ctx, camera, W, PLAY_BOTTOM, TILE, COLS, ROWS } = G;
  const t = state.time;

  // Viewport bounds in world space (with a small margin for overdraw)
  const vx0 = camera.x - TILE, vy0 = camera.y - TILE;
  const vx1 = camera.x + W + TILE, vy1 = camera.y + PLAY_BOTTOM + TILE;

  // ── Ground base ──────────────────────────────────────────────────────────
  const ground = ctx.createLinearGradient(camera.x, camera.y, camera.x, camera.y + PLAY_BOTTOM);
  ground.addColorStop(0,    '#5b3f22');
  ground.addColorStop(0.45, '#6b5335');
  ground.addColorStop(0.85, '#523a22');
  ground.addColorStop(1,    '#3a2614');
  ctx.fillStyle = ground;
  ctx.fillRect(camera.x, camera.y, W, PLAY_BOTTOM);

  // ── Terrain tiles (visible range only) ──────────────────────────────────
  if (state.terrain && state.terrain.length > 0 && COLS > 0) {
    const startCol = Math.max(0, Math.floor(camera.x / TILE));
    const endCol   = Math.min(COLS - 1, Math.ceil(vx1 / TILE));
    const startRow = Math.max(0, Math.floor(camera.y / TILE));
    const endRow   = Math.min(ROWS - 1, Math.ceil(vy1 / TILE));

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const terrain = state.terrain[r * COLS + c];
        if (terrain === 0) continue;
        const tx = c * TILE, ty = r * TILE;
        if (terrain === 1) {
          // Water base (shimmer drawn below)
          ctx.fillStyle = '#1a2e40';
          ctx.fillRect(tx, ty, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(tx + TILE - 3, ty, 3, TILE);
          ctx.fillRect(tx, ty + TILE - 3, TILE, 3);
        } else if (terrain === 2) {
          // Mountain
          ctx.fillStyle = '#2a2318';
          ctx.fillRect(tx, ty, TILE, TILE);
          ctx.fillStyle = 'rgba(100, 85, 60, 0.7)';
          ctx.fillRect(tx, ty, TILE, 7);
          ctx.fillStyle = 'rgba(80, 68, 50, 0.45)';
          ctx.fillRect(tx, ty, 5, TILE);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(tx, ty + TILE - 6, TILE, 6);
        }
      }
    }
  }

  // ── Water shimmer (animated, visible tiles only) ─────────────────────────
  for (const wt of state.waterTiles) {
    if (wt.tx > vx1 || wt.tx + TILE < vx0 || wt.ty > vy1 || wt.ty + TILE < vy0) continue;
    const shimmer = 0.18 + 0.12 * Math.sin(t * 1.6 + wt.tx * 0.008 + wt.ty * 0.006);
    ctx.fillStyle = `rgba(40, 100, 180, ${shimmer})`;
    ctx.fillRect(wt.tx, wt.ty, TILE, TILE);
  }

  // ── Soil mottling (viewport only, deterministic hash) ────────────────────
  ctx.fillStyle = 'rgba(90, 70, 45, 0.35)';
  for (let i = 0; i < 160; i++) {
    const mx = vx0 + (i * 173 + 37) % Math.max(1, W + TILE * 2);
    const my = vy0 + (i * 91  + 53) % Math.max(1, PLAY_BOTTOM + TILE * 2);
    ctx.fillRect(mx, my, 2, 1);
  }
  ctx.fillStyle = 'rgba(140, 110, 70, 0.28)';
  for (let i = 0; i < 110; i++) {
    const mx = vx0 + (i * 211 + 11) % Math.max(1, W + TILE * 2);
    const my = vy0 + (i * 67  + 31) % Math.max(1, PLAY_BOTTOM + TILE * 2);
    ctx.fillRect(mx, my, 1, 1);
  }

  // ── Cracks (viewport-culled) ─────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(20, 12, 6, 0.5)';
  ctx.lineWidth = 0.8;
  for (const crack of state.cracks) {
    if (crack[0].x > vx1 || crack[crack.length-1].x < vx0) continue;
    ctx.beginPath();
    ctx.moveTo(crack[0].x, crack[0].y);
    for (let i = 1; i < crack.length; i++) ctx.lineTo(crack[i].x, crack[i].y);
    ctx.stroke();
  }

  // ── Debris (viewport-culled) ─────────────────────────────────────────────
  for (const d of state.debris) {
    if (d.x < vx0 || d.x > vx1 || d.y < vy0 || d.y > vy1) continue;
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

  // ── Blood stains ─────────────────────────────────────────────────────────
  for (const b of state.bloodStains) {
    if (b.x < vx0 || b.x > vx1 || b.y < vy0 || b.y > vy1) continue;
    ctx.fillStyle = `rgba(50, 15, 10, ${b.a})`;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r, b.r * 0.55, b.rot, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Grass tufts (viewport-culled, animated sway) ─────────────────────────
  ctx.lineCap = 'round';
  for (const g of state.grassTufts) {
    if (g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue;
    const sway = Math.sin(t * 1.1 + g.phase) * 0.55;
    const half = (g.blades - 1) / 2;
    for (let b = 0; b < g.blades; b++) {
      const off = (b - half);
      const ax = g.x + off * 1.5 * g.size;
      const tipLen = (5.5 + Math.abs(off) * 0.6) * g.size;
      const bx = ax + (sway + off * 0.18) * g.size;
      const by = g.y - tipLen;
      ctx.strokeStyle = `hsl(${g.hue}, 55%, 22%)`;
      ctx.lineWidth = 1.6 * g.size;
      ctx.beginPath(); ctx.moveTo(ax, g.y); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = `hsla(${g.hue}, 80%, 60%, 0.95)`;
      ctx.lineWidth = 0.7 * g.size;
      ctx.beginPath(); ctx.moveTo(ax, g.y); ctx.lineTo(bx, by); ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';

  // ── Dust haze (viewport-culled) ──────────────────────────────────────────
  for (const p of state.dust) {
    if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
    const fade = 1 - Math.abs(p.life - 0.5) * 2;
    ctx.fillStyle = `rgba(210, 185, 140, ${0.32 * fade})`;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  // ── Bioluminescent grass glow (additive, viewport-culled) ────────────────
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of state.grassTufts) {
    if (g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue;
    const breath = 0.5 + 0.5 * Math.sin(t * 1.7 + g.phase);
    const r = (8 + breath * 4) * g.size;
    const grd = ctx.createRadialGradient(g.x, g.y - 3 * g.size, 0, g.x, g.y - 3 * g.size, r);
    grd.addColorStop(0,   `hsla(${g.hue}, 85%, 78%, ${0.22 * g.glow})`);
    grd.addColorStop(0.5, `hsla(${g.hue}, 85%, 55%, ${0.10 * g.glow})`);
    grd.addColorStop(1,   `hsla(${g.hue}, 85%, 40%, 0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(g.x - r, g.y - 3 * g.size - r, r * 2, r * 2);
  }
  ctx.restore();
}

// Called in screen-space (outside camera transform) — embers + vignette.
export function drawScreenAtmosphere() {
  const { ctx, W, H } = G;
  const t = state.time;

  // Drifting embers (additive, screen-space)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
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

  // Vignette + warm tint
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.20, W / 2, H / 2, Math.max(W, H) * 0.82);
  grad.addColorStop(0, 'rgba(80, 55, 25, 0)');
  grad.addColorStop(0.65, 'rgba(30, 15, 8, 0.5)');
  grad.addColorStop(1, 'rgba(4, 2, 0, 0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(140, 80, 30, 0.05)';
  ctx.fillRect(0, 0, W, H);
}
