import { G } from '../globals.js';
import { rand } from '../utils/math.js';
import { state } from '../state.js';
import { getHighScore } from '../systems/score.js';
import { GameData } from '../systems/upgrades.js';
import { HERO_DEFS } from '../config/heroes.js';

// Key bindings per hero: [basic, active slot 0, active slot 1]
const HERO_KEYS = {
  eliott: ['1', 'Q', 'A'],
  dick:   ['2', 'W', 'S'],
  habib:  ['3', 'E', 'D'],
};

const SLOT_W  = 180;  // hero card width
const SLOT_G  = 12;   // gap between cards
// Button layout: 3 buttons fill SLOT_W exactly
// 2px left margin + 58px btn + 2px gap + 58px btn + 2px gap + 58px btn = 182 → trim right
const BW      = 58;   // button width
const BG      = 2;    // gap between buttons
const B_LEFT  = 2;    // left margin before first button
const KEY_H   = 18;   // key-label strip at bottom of each button
// Button height fills from HEADER_H to PANEL_H - 2 (computed in draw)

// Lazy image loader
const _imgCache = new Map();
function _img(src) {
  if (!src) return null;
  if (_imgCache.has(src)) return _imgCache.get(src);
  _imgCache.set(src, null);
  const el = new Image();
  el.onload  = () => _imgCache.set(src, el);
  el.onerror = () => _imgCache.set(src, false);
  el.src = src;
  return null;
}

let _tooltip = null;

export function drawAbilityPanel() {
  const { ctx, W, H, PANEL_H } = G;
  const slots  = state.units;
  const totalW = slots.length * SLOT_W + (slots.length - 1) * SLOT_G;
  const startX = (W - totalW) / 2;
  const panelY = H - PANEL_H - 12;

  // Panel background stripe
  ctx.fillStyle = 'rgba(10, 6, 3, 0.6)';
  ctx.fillRect(0, panelY - 4, W, PANEL_H + 10);
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, panelY - 4); ctx.lineTo(W, panelY - 4);
  ctx.stroke();

  _tooltip = null;

  for (let i = 0; i < slots.length; i++) {
    const u = slots[i];
    const x = startX + i * (SLOT_W + SLOT_G);
    const y = panelY;

    // Card background + border
    ctx.fillStyle = u.dead ? 'rgba(30, 8, 5, 0.88)' : 'rgba(20, 12, 6, 0.92)';
    ctx.fillRect(x, y, SLOT_W, PANEL_H);
    ctx.strokeStyle = u.dead ? '#5a2a1a' : u.selected ? '#c5a572' : '#3a2a18';
    ctx.lineWidth = u.selected && !u.dead ? 2 : 1;
    ctx.strokeRect(x, y, SLOT_W, PANEL_H);

    if (u.type === 'dick' && u.rageTimer > 0) {
      const pulse = 0.5 + Math.sin(state.time * 12) * 0.5;
      ctx.strokeStyle = `rgba(255, 60, 30, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 1, y - 1, SLOT_W + 2, PANEL_H + 2);
    }

    // ── Header: portrait + name + HP bar ─────────────────────────────────────
    const HEADER_H = 26;

    ctx.save();
    ctx.translate(x + 12, y + 13);
    ctx.scale(0.50, 0.50);
    const savedSel = u.selected;
    u.selected = false;
    if (u.type === 'eliott') u._drawEliott(ctx, 0);
    else if (u.type === 'dick') u._drawDick(ctx, 0);
    else if (u.type === 'habib') u._drawHabib(ctx, 0);
    u.selected = savedSel;
    ctx.restore();

    ctx.fillStyle = u.dead ? '#8a4a3a' : '#e8d8b0';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(u.name.toUpperCase(), x + 27, y + 12);

    if (u.dead) {
      ctx.fillStyle = '#a83a2a';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillText('DEAD', x + 27, y + HEADER_H + 8);
      continue;
    }

    ctx.font = '9px "Courier New", monospace';
    ctx.fillStyle = '#8a6b3a';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(u.hp)}/${u.maxHp}`, x + SLOT_W - 4, y + 12);
    ctx.textAlign = 'left';

    const barL = x + 27, barW = SLOT_W - 27 - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barL, y + 16, barW, 5);
    const hpPct = u.hp / u.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#7aa853' : hpPct > 0.25 ? '#c5a247' : '#a83a2a';
    ctx.fillRect(barL, y + 16, barW * hpPct, 5);

    // ── Ability buttons ───────────────────────────────────────────────────────
    const btnY = y + HEADER_H + 2;          // top of button area
    const BH   = PANEL_H - HEADER_H - 4;    // button height (fills rest of card)
    _drawAbilityButtons(ctx, u, x, btnY, BH, panelY);
  }

  if (_tooltip) _drawTooltip(ctx, _tooltip, W, panelY);
}

function _drawAbilityButtons(ctx, unit, sx, btnY, BH, panelY) {
  const keys    = HERO_KEYS[unit.type] || ['?', '?', '?'];
  const upgPool = GameData.upgrades[unit.type] || [];
  const bxs     = [
    sx + B_LEFT,
    sx + B_LEFT + BW + BG,
    sx + B_LEFT + (BW + BG) * 2,
  ];

  // Basic ability
  _processBtn(ctx, {
    x: bxs[0], y: btnY, bh: BH,
    key:         keys[0],
    abilityId:   unit.abilityId,
    cd:          unit.abilityCd,
    maxCd:       unit.abilityMaxCd,
    color:       unit.abilityColor,
    name:        unit.abilityName,
    description: unit.abilityDescription,
    wavesLeft:   null,
    isEmpty:     false,
  }, panelY);

  // Active skill slots 0 and 1
  for (let si = 0; si < 2; si++) {
    const slot    = unit.activeSkillSlots[si];
    const upgDef  = slot ? upgPool.find(u => u.id === slot.id) : null;
    const iconCfg = slot ? (GameData.abilityIcons[slot.id] || null) : null;
    _processBtn(ctx, {
      x: bxs[si + 1], y: btnY, bh: BH,
      key:         keys[si + 1],
      abilityId:   slot?.id || '',
      cd:          slot?.cd ?? 0,
      maxCd:       slot?.maxCd ?? 1,
      color:       iconCfg?.color || '#6a5030',
      name:        upgDef?.name || '',
      description: upgDef?.description || '',
      wavesLeft:   slot?.wavesLeft ?? null,
      isEmpty:     !slot,
    }, panelY);
  }
}

function _processBtn(ctx, btn, panelY) {
  _drawBtn(ctx, btn);
  const mx = state.mouse?.x ?? -1, my = state.mouse?.y ?? -1;
  if (!btn.isEmpty && btn.name &&
      mx >= btn.x && mx <= btn.x + BW &&
      my >= btn.y && my <= btn.y + btn.bh) {
    _tooltip = { ...btn, panelY };
  }
}

function _drawBtn(ctx, btn) {
  const { x, y, bh, key, abilityId, cd, maxCd, color, isEmpty, wavesLeft } = btn;
  const icnH = bh - KEY_H;       // icon area height (above key strip)
  const icx  = x + BW / 2;
  const icy  = y + icnH / 2;

  // Background
  ctx.fillStyle = isEmpty ? 'rgba(12,8,4,0.75)' : 'rgba(22,15,8,0.95)';
  ctx.fillRect(x, y, BW, bh);

  if (isEmpty) {
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, BW, bh);
    // dim dash in icon area
    ctx.fillStyle = '#2a1a0a';
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('—', icx, icy);
    ctx.textBaseline = 'alphabetic';
    _drawKeyStrip(ctx, x, y, bh, key, false);
    return;
  }

  // ── Icon area ──────────────────────────────────────────────────────────────
  const iconCfg = GameData.abilityIcons[abilityId];
  const imgSrc  = iconCfg?.icon;
  const imgCol  = iconCfg?.color || color;
  const img     = _img(imgSrc);
  const PAD     = 4;

  if (img) {
    ctx.save();
    if (cd > 0) ctx.globalAlpha = 0.45;
    ctx.drawImage(img, x + PAD, y + PAD, BW - PAD * 2, icnH - PAD * 2);
    ctx.restore();
  } else {
    // Coloured placeholder with first letter
    ctx.fillStyle = imgCol;
    ctx.globalAlpha = cd > 0 ? 0.20 : 0.45;
    ctx.fillRect(x + PAD, y + PAD, BW - PAD * 2, icnH - PAD * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = cd > 0 ? '#5a4020' : '#e0d0b0';
    ctx.font = `bold ${Math.round(BW * 0.50)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((abilityId || '?').charAt(0).toUpperCase(), icx, icy);
    ctx.textBaseline = 'alphabetic';
  }

  // Border — colour-glow when ready
  ctx.strokeStyle = cd > 0 ? '#3a2818' : imgCol;
  ctx.lineWidth   = cd > 0 ? 1 : 1.5;
  ctx.strokeRect(x, y, BW, bh);

  // ── Cooldown pie (covers icon area only) ──────────────────────────────────
  if (cd > 0) {
    const r   = Math.min(BW, icnH) / 2 - 3;
    const pct = cd / maxCd;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, BW, icnH);   // clip to icon area
    ctx.clip();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(icx, icy);
    ctx.arc(icx, icy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * pct);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Seconds text
    ctx.fillStyle = '#d0c080';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(cd) + 's', icx, icy + 1);
    ctx.textBaseline = 'alphabetic';
  }

  // ── Durability pips (active skills only) — top-right of icon area ─────────
  if (wavesLeft !== null) {
    const pipCol = wavesLeft >= 3 ? '#80c040' : wavesLeft === 2 ? '#c0a040' : '#c04020';
    for (let p = 0; p < wavesLeft; p++) {
      ctx.fillStyle = pipCol;
      ctx.beginPath();
      ctx.arc(x + BW - 5 - p * 6, y + 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawKeyStrip(ctx, x, y, bh, key, cd <= 0);
}

function _drawKeyStrip(ctx, bx, by, bh, key, ready) {
  const sy = by + bh - KEY_H;
  // Strip background
  ctx.fillStyle = ready ? '#2a1a08' : '#130d04';
  ctx.fillRect(bx, sy, BW, KEY_H);
  // Top divider
  ctx.strokeStyle = ready ? '#6a4820' : '#2a1a0a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx, sy); ctx.lineTo(bx + BW, sy);
  ctx.stroke();
  // Key label
  ctx.fillStyle = ready ? '#e8c060' : '#6a4828';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(key, bx + BW / 2, sy + KEY_H / 2);
  ctx.textBaseline = 'alphabetic';
}

function _drawTooltip(ctx, data, W, panelY) {
  const { x, y, name, description, cd, maxCd, wavesLeft } = data;
  const PAD = 8, TW = 210, LH = 14;

  ctx.font = '9px "Courier New", monospace';
  const descLines = description ? _wrapText(ctx, description, TW - PAD * 2) : [];
  const statusLine = cd > 0 ? `CD: ${Math.ceil(cd)}s / ${Math.round(maxCd)}s` : 'READY';
  const allLines = [
    { text: name, bold: true, color: '#e8d8b0' },
    ...descLines.map(t => ({ text: t, bold: false, color: '#9a8060' })),
    { text: statusLine, bold: cd <= 0, color: cd > 0 ? '#c5a572' : '#80c040' },
  ];
  if (wavesLeft !== null) {
    const col = wavesLeft >= 3 ? '#80c040' : wavesLeft === 2 ? '#c0a040' : '#c04020';
    allLines.push({ text: `${wavesLeft} wave${wavesLeft !== 1 ? 's' : ''} remaining`, bold: false, color: col });
  }

  const TH = allLines.length * LH + PAD * 2;
  let tx = x + BW / 2 - TW / 2;
  let ty = y - TH - 6;
  tx = Math.max(4, Math.min(W - TW - 4, tx));
  ty = Math.max(4, ty);

  ctx.fillStyle = 'rgba(6, 4, 2, 0.96)';
  ctx.fillRect(tx, ty, TW, TH);
  ctx.strokeStyle = '#5a4020';
  ctx.lineWidth = 1;
  ctx.strokeRect(tx, ty, TW, TH);

  let ly = ty + PAD + 9;
  for (const line of allLines) {
    ctx.font = (line.bold ? 'bold ' : '') + '9px "Courier New", monospace';
    ctx.fillStyle = line.color;
    ctx.textAlign = 'left';
    ctx.fillText(line.text, tx + PAD, ly);
    ly += LH;
  }
}

function _wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW) {
      if (line) { lines.push(line); line = word; }
      else lines.push(word);
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function updateDust(dt) {
  const { W, PLAY_BOTTOM } = G;
  for (const p of state.dust) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life += dt * 0.4;
    if (p.life > 1 || p.x < -5 || p.x > W + 5 || p.y < -5 || p.y > PLAY_BOTTOM + 5) {
      p.life = 0;
      p.x = rand(0, W);
      p.y = rand(0, PLAY_BOTTOM);
      p.vx = rand(-10, 10);
      p.vy = rand(-3, 3);
    }
  }
}

export function updateHUD() {
  const alive = state.units.filter(u => !u.dead).length;
  document.getElementById('survCount').textContent = alive;
  document.getElementById('killCount').textContent = state.kills;
  document.getElementById('waveNum').textContent = state.wave;
  document.getElementById('scoreCount').textContent = state.score;
  document.getElementById('highScore').textContent = getHighScore();

  const bar   = document.getElementById('timeBar');
  const label = document.getElementById('timeLabel');
  bar.classList.remove('flowing', 'paused');
  const spaceHoldDriving = state.spaceHeld && state.spaceHoldDuration >= 1.0;
  if (spaceHoldDriving) {
    bar.classList.add('flowing');
    label.textContent = `TIME x${state.timeSpeed} — HOLDING`;
  } else if (state.spaceHeld) {
    bar.classList.add('paused');
    label.textContent = 'HOLD SPACE TO ADVANCE…';
  } else if (state.manualPause) {
    bar.classList.add('paused');
    label.textContent = `TIME x0 — SPACE TO RESUME`;
  } else if (state.timeFlow < 0.5) {
    bar.classList.add('paused');
    label.textContent = `TIME x0 — MOVE UNITS`;
  } else {
    bar.classList.add('flowing');
    label.textContent = `TIME x${state.timeSpeed}`;
  }
}
