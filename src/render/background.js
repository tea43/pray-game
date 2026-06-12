import { G } from '../globals.js';
import { state } from '../state.js';
import { drawBuildingShadows } from './buildings.js';

// Post-soviet wasteland ground: cold concrete-dust palette, cracked asphalt
// roads, murky flood water, urban debris, drifting cloud shadows. Everything is
// drawn directly with viewport culling; per-tile detail is hash-anchored to
// world tiles so it stays put as the camera moves.
export function clearBackgroundCache() { /* no-op: kept for call-site compatibility */ }

function hash2(c, r, seed) {
  let n = Math.imul((c * 7919 + r * 2311 + seed * 131) | 0, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0xac4d9413);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}

// Adds one water tile's outline to the current path. Exposed sides (no water
// neighbour) shift by `e` (outward when positive) and get rounded corners;
// connected sides overlap `ov` px into the neighbour so same-path fills merge
// into one seamless pool (nonzero winding paints the union once).
function _waterTilePath(ctx, wt, TILE, e, ov = 2) {
  const x0 = wt.tx + (wt.w ? -ov : -e);
  const x1 = wt.tx + TILE + (wt.e ? ov : e);
  const y0 = wt.ty + (wt.n ? -ov : -e);
  const y1 = wt.ty + TILE + (wt.s ? ov : e);
  if (x1 - x0 < 4 || y1 - y0 < 4) return;
  const R = Math.max(0, Math.min(Math.min(x1 - x0, y1 - y0) * 0.45, 16 + e));
  const rtl = (!wt.n && !wt.w) ? R : 0;
  const rtr = (!wt.n && !wt.e) ? R : 0;
  const rbr = (!wt.s && !wt.e) ? R : 0;
  const rbl = (!wt.s && !wt.w) ? R : 0;
  ctx.moveTo(x0 + rtl, y0);
  ctx.lineTo(x1 - rtr, y0);
  ctx.quadraticCurveTo(x1, y0, x1, y0 + rtr);
  ctx.lineTo(x1, y1 - rbr);
  ctx.quadraticCurveTo(x1, y1, x1 - rbr, y1);
  ctx.lineTo(x0 + rbl, y1);
  ctx.quadraticCurveTo(x0, y1, x0, y1 - rbl);
  ctx.lineTo(x0, y0 + rtl);
  ctx.quadraticCurveTo(x0, y0, x0 + rtl, y0);
  ctx.closePath();
}

// Called inside the camera transform — all positions are world-space.
export function drawBackground() {
  const { ctx, camera, W, PLAY_BOTTOM, TILE, COLS, ROWS } = G;
  const t = state.time;

  // Viewport bounds in world space (with a small margin for overdraw)
  const vx0 = camera.x - TILE, vy0 = camera.y - TILE;
  const vx1 = camera.x + W + TILE, vy1 = camera.y + PLAY_BOTTOM + TILE;

  // ── Ground base — cold dust-and-concrete courtyard ───────────────────────
  const ground = ctx.createLinearGradient(camera.x, camera.y, camera.x, camera.y + PLAY_BOTTOM);
  ground.addColorStop(0,    '#45443a');
  ground.addColorStop(0.45, '#4e4b3f');
  ground.addColorStop(0.85, '#3b3930');
  ground.addColorStop(1,    '#2a2922');
  ctx.fillStyle = ground;
  ctx.fillRect(camera.x, camera.y, W, PLAY_BOTTOM);

  // ── World-anchored tile detail (deterministic, stays put under camera) ───
  const startCol = Math.max(0, Math.floor(vx0 / TILE));
  const endCol   = Math.min(COLS - 1, Math.ceil(vx1 / TILE));
  const startRow = Math.max(0, Math.floor(vy0 / TILE));
  const endRow   = Math.min(ROWS - 1, Math.ceil(vy1 / TILE));

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const tx = c * TILE, ty = r * TILE;
      const h0 = hash2(c, r, 1);

      // Soil/concrete mottling — a few specks per tile
      for (let i = 0; i < 3; i++) {
        const hx = hash2(c, r, 10 + i), hy = hash2(c, r, 20 + i);
        ctx.fillStyle = i === 0 ? 'rgba(115, 110, 90, 0.30)' : 'rgba(55, 52, 42, 0.35)';
        ctx.fillRect(tx + hx * TILE, ty + hy * TILE, i === 0 ? 2 : 1.5, 1.2);
      }

      if (h0 < 0.045) {
        // Oil / scorch stain
        ctx.fillStyle = 'rgba(18, 18, 16, 0.14)';
        ctx.beginPath();
        ctx.ellipse(tx + TILE * 0.5, ty + TILE * 0.5, 10 + h0 * 300, 6 + h0 * 180, h0 * 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (h0 > 0.965) {
        // Concrete rubble scatter
        for (let i = 0; i < 4; i++) {
          const hx = hash2(c, r, 30 + i), hy = hash2(c, r, 40 + i);
          ctx.fillStyle = `rgba(${130 + i * 8}, ${126 + i * 6}, 110, 0.4)`;
          ctx.fillRect(tx + hx * TILE, ty + hy * TILE, 2.5 + hx * 2, 2 + hy * 1.5);
        }
      } else if (h0 > 0.49 && h0 < 0.494) {
        // Manhole cover
        const mx = tx + TILE * 0.5, my = ty + TILE * 0.5;
        ctx.fillStyle = 'rgba(40, 38, 34, 0.9)';
        ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(90, 85, 70, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  // ── Roads — cracked asphalt with faded markings ──────────────────────────
  for (const rd of state.roads || []) {
    if (rd.x > vx1 || rd.x + rd.w < vx0 || rd.y > vy1 || rd.y + rd.h < vy0) continue;
    const rx0 = Math.max(rd.x, vx0), rx1 = Math.min(rd.x + rd.w, vx1);
    const ry0 = Math.max(rd.y, vy0), ry1 = Math.min(rd.y + rd.h, vy1);

    // Asphalt body
    ctx.fillStyle = '#2e2f2e';
    ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);

    // Worn edges + curb shadow
    ctx.fillStyle = 'rgba(120, 115, 95, 0.22)';
    if (rd.vertical) {
      ctx.fillRect(rd.x, ry0, 2.5, ry1 - ry0);
      ctx.fillRect(rd.x + rd.w - 2.5, ry0, 2.5, ry1 - ry0);
    } else {
      ctx.fillRect(rx0, rd.y, rx1 - rx0, 2.5);
      ctx.fillRect(rx0, rd.y + rd.h - 2.5, rx1 - rx0, 2.5);
    }

    // Faded centre dashes
    ctx.fillStyle = 'rgba(205, 195, 155, 0.16)';
    if (rd.vertical) {
      const cx = rd.x + rd.w / 2 - 1.5;
      for (let y = Math.floor(ry0 / 48) * 48; y < ry1; y += 48) {
        ctx.fillRect(cx, y, 3, 22);
      }
    } else {
      const cy = rd.y + rd.h / 2 - 1.5;
      for (let x = Math.floor(rx0 / 48) * 48; x < rx1; x += 48) {
        ctx.fillRect(x, cy, 22, 3);
      }
    }

    // Potholes and tar patches, hash-anchored along the road
    const step = 90;
    const a0 = rd.vertical ? ry0 : rx0;
    const a1 = rd.vertical ? ry1 : rx1;
    for (let a = Math.floor(a0 / step) * step; a < a1; a += step) {
      const hh = hash2(a / step, rd.seed % 1000, 3);
      if (hh < 0.3) continue;
      const off = (hash2(a / step, rd.seed % 1000, 4) - 0.5) * (rd.vertical ? rd.w : rd.h) * 0.6;
      const px = rd.vertical ? rd.x + rd.w / 2 + off : a + step * 0.5;
      const py = rd.vertical ? a + step * 0.5 : rd.y + rd.h / 2 + off;
      if (hh < 0.6) {
        ctx.fillStyle = 'rgba(14, 14, 13, 0.55)'; // pothole
        ctx.beginPath();
        ctx.ellipse(px, py, 4 + hh * 8, 3 + hh * 5, hh * 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(22, 23, 24, 0.6)'; // tar repair patch
        ctx.fillRect(px - 9, py - 6, 18 + hh * 8, 12);
      }
    }
  }

  // ── Water — murky flood pools (passable but slow) ────────────────────────
  // Connected tiles merge into organic blobs: corners are rounded only where
  // exposed (no water neighbour), so pool interiors stay seamless.
  const visWater = [];
  for (const wt of state.waterTiles) {
    if (wt.tx > vx1 || wt.tx + TILE < vx0 || wt.ty > vy1 || wt.ty + TILE < vy0) continue;
    visWater.push(wt);
  }
  if (visWater.length) {
    // Muddy bank ring (widest), then the water body over it
    ctx.fillStyle = '#2f2c20';
    ctx.beginPath();
    for (const wt of visWater) _waterTilePath(ctx, wt, TILE, 6);
    ctx.fill();
    ctx.fillStyle = '#1f2d24';
    ctx.beginPath();
    for (const wt of visWater) _waterTilePath(ctx, wt, TILE, 0);
    ctx.fill();
    // Deep centre shading
    ctx.fillStyle = 'rgba(8, 14, 11, 0.45)';
    ctx.beginPath();
    for (const wt of visWater) _waterTilePath(ctx, wt, TILE, -11);
    ctx.fill();

    for (const wt of visWater) {
      // Oily shimmer, kept inside the pool outline
      const shimmer = 0.12 + 0.09 * Math.sin(t * 1.6 + wt.tx * 0.008 + wt.ty * 0.006);
      ctx.fillStyle = `rgba(95, 125, 80, ${shimmer})`;
      ctx.beginPath();
      _waterTilePath(ctx, wt, TILE, -3, 0); // ov=0: translucent per-tile fill must not double-paint seams
      ctx.fill();
      // Sky glint streak
      const glint = 0.07 + 0.08 * Math.sin(t * 2.3 + wt.ty * 0.011 + wt.tx * 0.004);
      if (glint > 0.02) {
        ctx.fillStyle = `rgba(140, 160, 165, ${glint})`;
        ctx.fillRect(wt.tx + TILE * 0.22, wt.ty + TILE * 0.4, TILE * 0.45, 2);
      }
      // Light waterline rim on the exposed top bank + reeds on exposed edges
      if (!wt.n) {
        ctx.fillStyle = 'rgba(165, 175, 150, 0.18)';
        ctx.fillRect(wt.tx + 8, wt.ty + 1.5, TILE - 16, 1.5);
      }
      const hr = hash2(wt.tx / TILE, wt.ty / TILE, 7);
      if ((!wt.s || !wt.w) && hr < 0.55) {
        const rx = wt.tx + 4 + hr * (TILE - 10);
        const ry = !wt.s ? wt.ty + TILE + 3 : wt.ty + hr * TILE;
        const sway = Math.sin(t * 1.3 + rx * 0.05) * 1.4;
        ctx.strokeStyle = 'rgba(60, 75, 45, 0.85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.quadraticCurveTo(rx + sway * 0.4, ry - 6, rx + sway, ry - 11);
        ctx.moveTo(rx + 3, ry);
        ctx.quadraticCurveTo(rx + 3 + sway * 0.4, ry - 4, rx + 3 + sway, ry - 8);
        ctx.stroke();
      }
    }
  }

  // ── Cracks (viewport-culled) ─────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(18, 16, 12, 0.5)';
  ctx.lineWidth = 0.8;
  for (const crack of state.cracks) {
    if (crack[0].x > vx1 || crack[crack.length-1].x < vx0) continue;
    ctx.beginPath();
    ctx.moveTo(crack[0].x, crack[0].y);
    for (let i = 1; i < crack.length; i++) ctx.lineTo(crack[i].x, crack[i].y);
    ctx.stroke();
  }

  // ── Urban debris (viewport-culled) ───────────────────────────────────────
  for (const d of state.debris) {
    if (d.x < vx0 || d.x > vx1 || d.y < vy0 || d.y > vy1) continue;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.scale(d.size, d.size);
    if (d.type === 0) {
      // Skull — it's still the apocalypse
      ctx.fillStyle = `rgba(210, 195, 160, ${d.shade * 0.85})`;
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0f06';
      ctx.fillRect(-2, -1, 1.2, 1.5); ctx.fillRect(0.8, -1, 1.2, 1.5); ctx.fillRect(-0.5, 1.2, 1, 1);
    } else if (d.type === 1) {
      // Car tire
      ctx.strokeStyle = `rgba(16, 16, 16, ${d.shade})`; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(60, 58, 52, ${d.shade * 0.5})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(30, 28, 24, ${d.shade * 0.5})`;
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
    } else if (d.type === 2) {
      // Weathered plank
      ctx.fillStyle = `rgba(82, 64, 42, ${d.shade})`;
      ctx.fillRect(-7, -1.2, 14, 2.4);
      ctx.fillStyle = `rgba(40, 30, 18, ${d.shade * 0.8})`;
      ctx.fillRect(-7, -1.2, 14, 0.8);
      ctx.fillRect(2, -1.2, 0.6, 2.4);
    } else if (d.type === 3) {
      // Concrete chunk with rebar
      ctx.fillStyle = `rgba(150, 145, 128, ${d.shade * 0.85})`;
      ctx.beginPath();
      ctx.moveTo(-4, -2.5); ctx.lineTo(3.5, -3.2); ctx.lineTo(4.5, 2); ctx.lineTo(-3, 3); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(95, 60, 35, ${d.shade * 0.9})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(3, -2.5); ctx.lineTo(8, -4.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, 1); ctx.lineTo(9, 0.4); ctx.stroke();
    } else {
      // Rusty barrel lid / scrap
      ctx.fillStyle = `rgba(105, 62, 32, ${d.shade * 0.85})`;
      ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(40, 22, 10, ${d.shade * 0.7})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(160, 95, 45, ${d.shade * 0.4})`;
      ctx.fillRect(-2, -1.5, 2, 1.5);
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

  // ── P-RAY grass tufts (viewport-culled, animated sway) ───────────────────
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
    ctx.fillStyle = `rgba(190, 180, 150, ${0.28 * fade})`;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  // ── Cloud shadows — slow drifting darkness over the ground ───────────────
  const WW = G.WORLD_W || W, WH = G.WORLD_H || PLAY_BOTTOM;
  for (const cs of state.cloudShadows || []) {
    const spanX = WW + cs.r * 2, spanY = WH + cs.r * 2;
    const cx = ((((cs.x0 + t * cs.vx) % spanX) + spanX) % spanX) - cs.r;
    const cy = ((((cs.y0 + t * cs.vy) % spanY) + spanY) % spanY) - cs.r;
    if (cx + cs.r < vx0 || cx - cs.r > vx1 || cy + cs.r < vy0 || cy - cs.r > vy1) continue;
    const grd = ctx.createRadialGradient(cx, cy, cs.r * 0.15, cx, cy, cs.r);
    grd.addColorStop(0, `rgba(8, 10, 14, ${cs.a})`);
    grd.addColorStop(1, 'rgba(8, 10, 14, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(cx - cs.r, cy - cs.r, cs.r * 2, cs.r * 2);
  }

  // ── Building ground shadows (under entities) ─────────────────────────────
  drawBuildingShadows(ctx, vx0, vy0, vx1, vy1);

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

// Called in screen-space (outside camera transform) — embers, fog, vignette.
export function drawScreenAtmosphere() {
  const { ctx, W, H, PLAY_BOTTOM } = G;
  const t = state.time;

  // Drifting embers (additive, screen-space)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of state.embers) {
    const lifeT = e.life / e.maxLife;
    const fade = lifeT < 0.5 ? lifeT * 2 : 1 - (lifeT - 0.5) * 2;
    const r = e.size * 2.5;
    const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
    grd.addColorStop(0, `hsla(${e.hue}, 95%, 70%, ${0.40 * fade})`);
    grd.addColorStop(1, `hsla(${e.hue}, 95%, 40%, 0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
  }
  ctx.restore();

  // Low rolling fog — wide soft blobs drifting across the screen
  for (let i = 0; i < 5; i++) {
    const span = W + 700;
    const fx = ((((i * 0.23 + 0.07) * W + t * (7 + i * 2.6)) % span) + span) % span - 350;
    const fy = PLAY_BOTTOM * (0.22 + 0.16 * i) + Math.sin(t * 0.21 + i * 1.7) * 26;
    const fr = 240 + i * 55;
    const grd = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    grd.addColorStop(0, 'rgba(150, 158, 148, 0.040)');
    grd.addColorStop(0.6, 'rgba(140, 150, 142, 0.022)');
    grd.addColorStop(1, 'rgba(140, 150, 142, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
  }

  // Vignette — cold, heavy at the corners
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.82);
  grad.addColorStop(0, 'rgba(30, 38, 44, 0)');
  grad.addColorStop(0.65, 'rgba(14, 17, 20, 0.42)');
  grad.addColorStop(1, 'rgba(2, 3, 4, 0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Overcast colour cast — cold steel with a faint warm horizon band
  ctx.fillStyle = 'rgba(92, 108, 122, 0.045)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(150, 100, 45, 0.025)';
  ctx.fillRect(0, 0, W, Math.max(60, H * 0.18));
}
