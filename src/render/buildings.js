import { G } from '../globals.js';
import { state } from '../state.js';

// ── Post-soviet building renderer ──────────────────────────────────────────────
// Buildings are impassable terrain (type 2 tiles) generated as rectangular
// footprints in state.js. Each building renders its facade ONCE into an
// offscreen canvas (lazy, seeded → deterministic), then per-frame drawing is a
// single drawImage. Buildings join GameScene's painter Y-sort with y = baseY,
// so entities above the base edge are correctly hidden behind the facade.
// When a hero stands in the occluded band, the whole building fades to ~42%
// alpha so the hero stays visible (see updateBuildingOcclusion).
//
// Three styles: 'panelka' (concrete panel block), 'brick' (khrushchyovka),
// 'industrial' (garage/warehouse hall).

const PAD = 24; // cache margin for antennas / canopy overhangs (antennas reach ~21px above the roof)

// Deterministic per-building randomness — mulberry32
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function facadeHeight(b) { return b.h + b.extraUp; }
export function roofDepth(b)    { return Math.max(16, Math.min(40, b.h * 0.26)); }
export function visualTop(b)    { return b.baseY - facadeHeight(b) - roofDepth(b); }

// ── Occlusion fade — heroes behind a facade make it translucent ───────────────
export function updateBuildingOcclusion(realDt) {
  for (const b of state.buildings || []) {
    const top = visualTop(b);
    let occluded = false;
    for (const u of state.units) {
      if (u.dead || u.boarded) continue;
      if (u.y < b.baseY && u.y > top - 24 && u.x > b.x - 14 && u.x < b.x + b.w + 14) {
        occluded = true; break;
      }
    }
    const target = occluded ? 0.42 : 1.0;
    b.alpha += (target - b.alpha) * Math.min(1, realDt * 8);
  }
}

// ── Ground shadows — called inside the camera transform, before entities ──────
export function drawBuildingShadows(ctx, vx0, vy0, vx1, vy1) {
  for (const b of state.buildings || []) {
    if (b.x > vx1 + 80 || b.x + b.w < vx0 - 80 || b.baseY > vy1 + 80 || b.baseY < vy0 - 20) continue;
    const len = Math.min(60, facadeHeight(b) * 0.3);
    // Soft cast shadow to the lower-right (sun top-left)
    ctx.fillStyle = 'rgba(8, 10, 9, 0.16)';
    ctx.beginPath();
    ctx.moveTo(b.x + 3, b.baseY - 2);
    ctx.lineTo(b.x + b.w + 3, b.baseY - 2);
    ctx.lineTo(b.x + b.w + 3 + len * 0.55, b.baseY + len * 0.4);
    ctx.lineTo(b.x + 3 + len * 0.55, b.baseY + len * 0.4);
    ctx.closePath();
    ctx.fill();
    // Tight contact shadow grounding the base edge
    ctx.fillStyle = 'rgba(5, 6, 5, 0.28)';
    ctx.fillRect(b.x - 2, b.baseY - 3, b.w + 4, 7);
  }
}

// ── Per-frame draw (inside camera transform, from the Y-sorted entity pass) ───
export function drawBuilding(ctx, b) {
  if (!b._cv) _buildCache(b);
  const top = visualTop(b);
  if (b.alpha < 0.995) ctx.globalAlpha = Math.max(0.35, b.alpha);
  ctx.drawImage(b._cv, b.x - PAD, top - PAD, b._cv.width / b._cvScale, b._cv.height / b._cvScale);
  if (b.alpha < 0.995) ctx.globalAlpha = 1;

  // Flickering warm glow on lit windows — skipped while the facade is faded
  if (b.alpha > 0.85 && b.litWindows && b.litWindows.length) {
    const t = state.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lw of b.litWindows) {
      const a = 0.09 + 0.06 * (0.5 + 0.5 * Math.sin(t * 1.3 + lw.phase));
      const grd = ctx.createRadialGradient(lw.x, lw.y, 0, lw.x, lw.y, 11);
      grd.addColorStop(0, `rgba(255, 206, 120, ${a})`);
      grd.addColorStop(1, 'rgba(255, 180, 80, 0)');
      ctx.fillStyle = grd;
      ctx.fillRect(lw.x - 11, lw.y - 11, 22, 22);
    }
    ctx.restore();
  }
}

// ── Facade cache builder ───────────────────────────────────────────────────────
function _buildCache(b) {
  const S = Math.min(2, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  const fh = facadeHeight(b), rd = roofDepth(b);
  const cw = b.w + PAD * 2, ch = fh + rd + PAD * 2;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(cw * S); cv.height = Math.ceil(ch * S);
  const c = cv.getContext('2d');
  c.scale(S, S);
  c.translate(PAD, PAD); // (0,0) = top-left of roof; facade spans y ∈ [rd, rd+fh]

  const rng = mulberry(b.seed);
  b.litWindows = [];

  if (b.style === 'industrial') _drawIndustrial(c, b, rng, fh, rd);
  else _drawBlock(c, b, rng, fh, rd, b.style === 'brick');

  _drawWeathering(c, b, rng, fh, rd);
  _drawRoofClutter(c, b, rng, rd);

  // Volume shading: light from top-left
  let g = c.createLinearGradient(0, rd, b.w, rd);
  g.addColorStop(0, 'rgba(255, 250, 235, 0.07)');
  g.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(10, 10, 15, 0.20)');
  c.fillStyle = g;
  c.fillRect(0, rd, b.w, fh);
  g = c.createLinearGradient(0, rd, 0, rd + fh);
  g.addColorStop(0, 'rgba(255, 250, 235, 0.05)');
  g.addColorStop(1, 'rgba(5, 5, 8, 0.16)');
  c.fillStyle = g;
  c.fillRect(0, rd, b.w, fh);

  b._cv = cv;
  b._cvScale = S;
}

// Residential block — concrete panel ('panelka') or brick khrushchyovka
function _drawBlock(c, b, rng, fh, rd, isBrick) {
  const w = b.w;
  const wall = isBrick
    ? `hsl(${14 + rng() * 8}, ${24 + rng() * 10}%, ${34 + rng() * 7}%)`
    : `hsl(${48 + rng() * 18}, ${7 + rng() * 6}%, ${50 + rng() * 9}%)`;
  c.fillStyle = wall;
  c.fillRect(0, rd, w, fh);

  if (isBrick) {
    // Brick courses
    c.strokeStyle = 'rgba(30, 18, 12, 0.18)';
    c.lineWidth = 0.6;
    for (let y = rd + 5; y < rd + fh; y += 5.5) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }
    // Fallen-plaster patches exposing lighter render
    const patches = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < patches; i++) {
      const pw = 14 + rng() * 30, ph2 = 10 + rng() * 22;
      const px = rng() * (w - pw), py = rd + rng() * (fh - ph2 - 24);
      c.fillStyle = `rgba(190, 180, 158, ${0.35 + rng() * 0.3})`;
      c.fillRect(px, py, pw, ph2);
      c.strokeStyle = 'rgba(25, 15, 10, 0.3)';
      c.strokeRect(px, py, pw, ph2);
    }
  } else {
    // Concrete panel seams — vertical every ~2 windows, horizontal per story
    c.strokeStyle = 'rgba(45, 44, 38, 0.45)';
    c.lineWidth = 1;
    for (let x = 30; x < w - 8; x += 60) {
      c.beginPath(); c.moveTo(x, rd); c.lineTo(x, rd + fh); c.stroke();
    }
    for (let y = rd + 26; y < rd + fh - 20; y += 26) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }
    // A few discoloured replacement panels
    const panels = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < panels; i++) {
      c.fillStyle = `rgba(${110 + rng() * 50}, ${105 + rng() * 40}, ${90 + rng() * 30}, 0.30)`;
      c.fillRect(Math.floor(rng() * (w / 60)) * 60 + 30, rd + Math.floor(rng() * (fh / 26)) * 26, 30, 26);
    }
  }

  // Faded soviet accent colour for balcony fronts
  const accents = ['#5e7d86', '#6f8678', '#8a8060', '#6e7e96', '#86706a'];
  const accent = accents[Math.floor(rng() * accents.length)];

  // Window grid
  const cellW = 30, cellH = 26;
  const mTop = 8, mBot = 30, mSide = 10;
  const cols = Math.max(1, Math.floor((w - mSide * 2) / cellW));
  const rows = Math.max(1, Math.floor((fh - mTop - mBot) / cellH));
  const gridW = cols * cellW;
  const ox = (w - gridW) / 2;

  // 1–2 balcony columns for panelki
  const balconyCols = new Set();
  if (!isBrick && cols >= 3) {
    balconyCols.add(1 + Math.floor(rng() * (cols - 2)));
    if (cols >= 5 && rng() < 0.6) balconyCols.add(1 + Math.floor(rng() * (cols - 2)));
  }

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const wx = ox + col * cellW + (cellW - 16) / 2;
      const wy = rd + mTop + r * cellH + (cellH - 18) / 2;
      _drawWindow(c, b, rng, wx, wy, 16, 18, isBrick, rd, fh);
      if (balconyCols.has(col) && r > 0) {
        // Balcony: slab + accent front panel + railing
        const bx = ox + col * cellW + 1;
        const by = wy + 8;
        c.fillStyle = 'rgba(40, 38, 34, 0.85)';
        c.fillRect(bx - 2, by + 10, cellW + 2, 3);
        c.fillStyle = accent;
        c.globalAlpha = 0.65 + rng() * 0.25;
        c.fillRect(bx, by, cellW - 2, 11);
        c.globalAlpha = 1;
        c.strokeStyle = 'rgba(25, 25, 22, 0.6)';
        c.lineWidth = 0.8;
        for (let rx = bx + 3; rx < bx + cellW - 3; rx += 5) {
          c.beginPath(); c.moveTo(rx, by); c.lineTo(rx, by + 10); c.stroke();
        }
        c.strokeRect(bx, by, cellW - 2, 11);
      }
    }
  }

  // Entrance — door, canopy on posts, worn steps
  const doorX = ox + Math.floor(rng() * cols) * cellW + 4;
  const doorY = rd + fh - 24;
  c.fillStyle = '#16140f';
  c.fillRect(doorX, doorY, 15, 24);
  c.fillStyle = '#3c3527';
  c.fillRect(doorX + 1.5, doorY + 2, 12, 20);
  c.fillStyle = '#13110d';
  c.fillRect(doorX + 6.5, doorY + 2, 2, 20);
  c.fillStyle = 'rgba(60, 58, 52, 0.95)'; // canopy slab
  c.fillRect(doorX - 5, doorY - 5, 25, 4);
  c.fillStyle = 'rgba(35, 33, 28, 0.9)';
  c.fillRect(doorX - 4, doorY - 1, 2, 21);
  c.fillRect(doorX + 17, doorY - 1, 2, 21);
}

// Industrial hall — concrete base, corrugated upper, big rusted gates
function _drawIndustrial(c, b, rng, fh, rd) {
  const w = b.w;
  c.fillStyle = `hsl(${200 + rng() * 20}, 4%, ${36 + rng() * 6}%)`;
  c.fillRect(0, rd, w, fh);
  // Concrete plinth
  const plinthH = Math.min(26, fh * 0.3);
  c.fillStyle = `hsl(45, 7%, ${42 + rng() * 5}%)`;
  c.fillRect(0, rd + fh - plinthH, w, plinthH);
  // Corrugated ribs
  c.strokeStyle = 'rgba(20, 22, 24, 0.22)';
  c.lineWidth = 1;
  for (let x = 4; x < w; x += 7) {
    c.beginPath(); c.moveTo(x, rd + 2); c.lineTo(x, rd + fh - plinthH); c.stroke();
  }
  // High window strip, some panes broken
  const winY = rd + 8;
  for (let x = 10; x < w - 26; x += 32) {
    const broken = rng() < 0.35;
    c.fillStyle = broken ? '#0c0d0f' : 'rgba(120, 140, 145, 0.55)';
    c.fillRect(x, winY, 20, 9);
    c.strokeStyle = 'rgba(30, 30, 28, 0.8)';
    c.strokeRect(x, winY, 20, 9);
    if (broken) {
      c.strokeStyle = 'rgba(150, 160, 160, 0.5)';
      c.beginPath(); c.moveTo(x + 4, winY + 1); c.lineTo(x + 9, winY + 8); c.stroke();
    }
  }
  // Big sliding gates with X-bracing and rust wash
  const gates = w > 200 && rng() < 0.7 ? 2 : 1;
  for (let i = 0; i < gates; i++) {
    const gw = Math.min(46, w * 0.3);
    const gx = (w / (gates + 1)) * (i + 1) - gw / 2;
    const gy = rd + fh - 34;
    c.fillStyle = '#473a2c';
    c.fillRect(gx, gy, gw, 34);
    const rust = c.createLinearGradient(0, gy, 0, gy + 34);
    rust.addColorStop(0, 'rgba(120, 70, 35, 0.15)');
    rust.addColorStop(1, 'rgba(140, 75, 30, 0.5)');
    c.fillStyle = rust;
    c.fillRect(gx, gy, gw, 34);
    c.strokeStyle = 'rgba(25, 20, 14, 0.85)';
    c.lineWidth = 1.4;
    c.strokeRect(gx, gy, gw, 34);
    c.beginPath();
    c.moveTo(gx, gy); c.lineTo(gx + gw, gy + 34);
    c.moveTo(gx + gw, gy); c.lineTo(gx, gy + 34);
    c.moveTo(gx + gw / 2, gy); c.lineTo(gx + gw / 2, gy + 34);
    c.stroke();
  }
  // Wall pipe running to the roof
  const px = 6 + rng() * (w - 12);
  c.strokeStyle = 'rgba(70, 60, 50, 0.9)';
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(px, rd + fh); c.lineTo(px, rd - 4); c.stroke();
  c.strokeStyle = 'rgba(130, 75, 35, 0.4)';
  c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(px, rd + fh - 10); c.lineTo(px, rd + 10); c.stroke();
}

function _drawWindow(c, b, rng, wx, wy, ww, wh, isBrick, rd, fh) {
  // Frame
  c.fillStyle = isBrick ? 'rgba(205, 198, 180, 0.85)' : 'rgba(80, 76, 66, 0.9)';
  c.fillRect(wx - 1.5, wy - 1.5, ww + 3, wh + 3);

  const roll = rng();
  if (roll < 0.07) {
    // Lit — warm interior; world-space centre recorded for the flicker pass
    const g = c.createLinearGradient(wx, wy, wx, wy + wh);
    g.addColorStop(0, '#f0cd84');
    g.addColorStop(1, '#b98c4e');
    c.fillStyle = g;
    c.fillRect(wx, wy, ww, wh);
    c.fillStyle = 'rgba(60, 40, 20, 0.55)';
    c.fillRect(wx, wy + wh * 0.45, ww, 1.2);
    if (b.litWindows.length < 5) {
      // Cache local (lx, ly) maps to world (b.x + lx, visualTop + ly)
      b.litWindows.push({
        x: b.x + wx + ww / 2,
        y: b.baseY - fh - rd + wy + wh / 2,
        phase: rng() * Math.PI * 2,
      });
    }
  } else if (roll < 0.23) {
    // Broken — black hole, glass shards
    c.fillStyle = '#0b0c0e';
    c.fillRect(wx, wy, ww, wh);
    c.strokeStyle = 'rgba(160, 170, 170, 0.45)';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(wx + 2, wy + 2); c.lineTo(wx + ww * 0.5, wy + wh * 0.55);
    c.moveTo(wx + ww - 2, wy + 3); c.lineTo(wx + ww * 0.55, wy + wh * 0.4);
    c.stroke();
  } else if (roll < 0.29) {
    // Boarded up
    c.fillStyle = '#141312';
    c.fillRect(wx, wy, ww, wh);
    c.strokeStyle = 'rgba(120, 96, 60, 0.9)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(wx - 1, wy + 3); c.lineTo(wx + ww + 1, wy + wh - 4);
    c.moveTo(wx - 1, wy + wh - 3); c.lineTo(wx + ww + 1, wy + 4);
    c.stroke();
  } else {
    // Intact dark glass with a diagonal sky reflection
    const g = c.createLinearGradient(wx, wy, wx + ww, wy + wh);
    g.addColorStop(0, '#252c33');
    g.addColorStop(1, '#11151a');
    c.fillStyle = g;
    c.fillRect(wx, wy, ww, wh);
    c.strokeStyle = 'rgba(150, 165, 175, 0.30)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(wx + 2, wy + wh - 3); c.lineTo(wx + ww - 3, wy + 2);
    c.stroke();
    c.fillStyle = 'rgba(50, 48, 42, 0.8)';
    c.fillRect(wx + ww / 2 - 0.6, wy, 1.2, wh);
  }
}

function _drawWeathering(c, b, rng, fh, rd) {
  const w = b.w;
  // Damp/rust streaks bleeding down the facade
  const streaks = 4 + Math.floor(rng() * 5);
  for (let i = 0; i < streaks; i++) {
    const sx = rng() * w;
    const sy = rd + rng() * fh * 0.5;
    const sl = 14 + rng() * (fh - (sy - rd)) * 0.7;
    const g = c.createLinearGradient(0, sy, 0, sy + sl);
    g.addColorStop(0, `rgba(30, 28, 24, ${0.18 + rng() * 0.14})`);
    g.addColorStop(1, 'rgba(30, 28, 24, 0)');
    c.fillStyle = g;
    c.fillRect(sx, sy, 1.6 + rng() * 2.2, sl);
  }
  // Grime band rising from the ground
  const g2 = c.createLinearGradient(0, rd + fh - 22, 0, rd + fh);
  g2.addColorStop(0, 'rgba(22, 20, 16, 0)');
  g2.addColorStop(1, 'rgba(22, 20, 16, 0.5)');
  c.fillStyle = g2;
  c.fillRect(0, rd + fh - 22, w, 22);
  // Graffiti tag near the ground
  if (rng() < 0.75) {
    const hue = Math.floor(rng() * 360);
    const gx = 8 + rng() * (w - 50);
    const gy = rd + fh - 10 - rng() * 12;
    c.strokeStyle = `hsla(${hue}, 70%, 55%, 0.55)`;
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.beginPath();
    let px = gx;
    c.moveTo(px, gy);
    const segs = 3 + Math.floor(rng() * 4);
    for (let s = 0; s < segs; s++) {
      px += 6 + rng() * 9;
      c.quadraticCurveTo(px - 4, gy - 6 + rng() * 12, px, gy + (rng() - 0.5) * 6);
    }
    c.stroke();
    c.lineCap = 'butt';
  }
  // Hairline cracks
  const cracks = 1 + Math.floor(rng() * 3);
  c.strokeStyle = 'rgba(20, 18, 14, 0.4)';
  c.lineWidth = 0.7;
  for (let i = 0; i < cracks; i++) {
    let cx = rng() * w, cy = rd + rng() * fh * 0.6;
    c.beginPath(); c.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) {
      cx += (rng() - 0.5) * 10; cy += 6 + rng() * 10;
      c.lineTo(cx, cy);
    }
    c.stroke();
  }
}

function _drawRoofClutter(c, b, rng, rd) {
  const w = b.w;
  // Roof slab — slight trapezoid for fake depth, tar surface with patches
  const inset = Math.min(14, w * 0.05);
  c.fillStyle = '#403e39';
  c.beginPath();
  c.moveTo(inset, 0); c.lineTo(w - inset, 0);
  c.lineTo(w, rd); c.lineTo(0, rd);
  c.closePath(); c.fill();
  const patches = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < patches; i++) {
    c.fillStyle = `rgba(${20 + rng() * 25}, ${20 + rng() * 22}, ${18 + rng() * 18}, 0.55)`;
    c.fillRect(inset + rng() * (w - inset * 2 - 24), 2 + rng() * (rd - 8), 14 + rng() * 22, 4 + rng() * 6);
  }
  // Parapet edge highlight at the facade junction
  c.fillStyle = 'rgba(190, 185, 168, 0.5)';
  c.fillRect(0, rd - 1.5, w, 1.5);
  c.fillStyle = 'rgba(15, 14, 12, 0.55)';
  c.fillRect(0, rd, w, 2);

  // Vent boxes
  const vents = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < vents; i++) {
    const vx = inset + 6 + rng() * (w - inset * 2 - 22);
    const vy = 3 + rng() * (rd - 12);
    c.fillStyle = '#56544c';
    c.fillRect(vx, vy, 10, 7);
    c.fillStyle = 'rgba(15, 15, 13, 0.6)';
    c.fillRect(vx, vy + 5, 10, 2);
  }
  // TV antenna — classic rooftop silhouette
  if (rng() < 0.8) {
    const ax = inset + 8 + rng() * (w - inset * 2 - 16);
    const ah = 12 + rng() * 9;
    c.strokeStyle = 'rgba(28, 28, 26, 0.9)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(ax, 2); c.lineTo(ax, 2 - ah);
    c.moveTo(ax - 6, 2 - ah); c.lineTo(ax + 6, 2 - ah);
    c.moveTo(ax - 4, 2 - ah + 4); c.lineTo(ax + 4, 2 - ah + 4);
    c.stroke();
  }
}
