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

const BTN  = 28;  // icon button size in px
const GAP  = 4;   // gap between buttons

// Lazy image loader — returns Image when ready, null while loading, false on error
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

// Tooltip set during drawAbilityPanel, rendered at the very end
let _tooltip = null;

export function drawAbilityPanel() {
  const { ctx, W, H, PANEL_H } = G;
  const slotW = 150, slotH = PANEL_H, gap = 12;
  const slots = state.units;
  const totalW = slots.length * slotW + (slots.length - 1) * gap;
  const startX = (W - totalW) / 2;
  const panelY  = H - slotH - 12;

  ctx.fillStyle = 'rgba(10, 6, 3, 0.6)';
  ctx.fillRect(0, panelY - 4, W, slotH + 10);
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, panelY - 4); ctx.lineTo(W, panelY - 4);
  ctx.stroke();

  _tooltip = null;

  for (let i = 0; i < slots.length; i++) {
    const u = slots[i];
    const x = startX + i * (slotW + gap);
    const y = panelY;

    ctx.fillStyle = u.dead ? 'rgba(30, 8, 5, 0.88)' : 'rgba(20, 12, 6, 0.92)';
    ctx.fillRect(x, y, slotW, slotH);
    ctx.strokeStyle = u.dead ? '#5a2a1a' : u.selected ? '#c5a572' : '#3a2a18';
    ctx.lineWidth = u.selected && !u.dead ? 2 : 1;
    ctx.strokeRect(x, y, slotW, slotH);

    if (u.type === 'dick' && u.rageTimer > 0) {
      const pulse = 0.5 + Math.sin(state.time * 12) * 0.5;
      ctx.strokeStyle = `rgba(255, 60, 30, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 1, y - 1, slotW + 2, slotH + 2);
    }

    // Mini portrait
    ctx.save();
    ctx.translate(x + 16, y + 20);
    ctx.scale(0.65, 0.65);
    const savedSel = u.selected;
    u.selected = false;
    if (u.type === 'eliott') u._drawEliott(ctx, 0);
    else if (u.type === 'dick') u._drawDick(ctx, 0);
    else if (u.type === 'habib') u._drawHabib(ctx, 0);
    u.selected = savedSel;
    ctx.restore();

    ctx.fillStyle = u.dead ? '#8a4a3a' : '#e8d8b0';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(u.name.toUpperCase(), x + 34, y + 16);

    if (u.dead) {
      ctx.fillStyle = '#a83a2a';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillText('DEAD', x + 34, y + 34);
      continue;
    }

    // HP
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#8a6b3a';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(u.hp)}/${u.maxHp}`, x + slotW - 8, y + 16);
    ctx.textAlign = 'left';

    const barLeft = x + 34, barW = slotW - 34 - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barLeft, y + 22, barW, 5);
    const hpPct = u.hp / u.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#7aa853' : hpPct > 0.25 ? '#c5a247' : '#a83a2a';
    ctx.fillRect(barLeft, y + 22, barW * hpPct, 5);

    // Ability buttons row
    _drawAbilityButtons(ctx, u, x, y, panelY);
  }

  if (_tooltip) _drawTooltip(ctx, _tooltip, W, panelY);
}

function _drawAbilityButtons(ctx, unit, sx, sy, panelY) {
  const keys  = HERO_KEYS[unit.type] || ['?', '?', '?'];
  const upgPool = GameData.upgrades[unit.type] || [];
  const btnY  = sy + 32;
  const bx    = [sx + 34, sx + 34 + BTN + GAP, sx + 34 + (BTN + GAP) * 2];

  // Basic ability
  _processBtn(ctx, {
    x: bx[0], y: btnY,
    key: keys[0],
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
    const slot   = unit.activeSkillSlots[si];
    const upgDef = slot ? upgPool.find(u => u.id === slot.id) : null;
    const iconCfg = slot ? (GameData.abilityIcons[slot.id] || null) : null;
    _processBtn(ctx, {
      x: bx[si + 1], y: btnY,
      key: keys[si + 1],
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

  // Hover → queue tooltip
  const mx = state.mouse?.x ?? -1, my = state.mouse?.y ?? -1;
  if (!btn.isEmpty && btn.name &&
      mx >= btn.x && mx <= btn.x + BTN &&
      my >= btn.y && my <= btn.y + BTN) {
    _tooltip = { ...btn, panelY };
  }
}

function _drawBtn(ctx, btn) {
  const { x, y, key, abilityId, cd, maxCd, color, isEmpty, wavesLeft } = btn;
  const cx = x + BTN / 2, cy = y + BTN / 2;

  // Background
  ctx.fillStyle = isEmpty ? 'rgba(12,8,4,0.75)' : 'rgba(22,15,8,0.95)';
  ctx.fillRect(x, y, BTN, BTN);

  if (isEmpty) {
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, BTN, BTN);
    ctx.fillStyle = '#2a1a0a';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('—', cx, cy);
    ctx.textBaseline = 'alphabetic';
    _drawKeyLabel(ctx, x, y, key, false);
    return;
  }

  const iconCfg = GameData.abilityIcons[abilityId];
  const imgSrc  = iconCfg?.icon;
  const imgCol  = iconCfg?.color || color;
  const img     = _img(imgSrc);
  const PAD = 3;

  if (img) {
    ctx.save();
    if (cd > 0) ctx.globalAlpha = 0.45;
    ctx.drawImage(img, x + PAD, y + PAD, BTN - PAD * 2, BTN - PAD * 2);
    ctx.restore();
  } else {
    // Coloured placeholder
    ctx.fillStyle = imgCol;
    ctx.globalAlpha = cd > 0 ? 0.22 : 0.50;
    ctx.fillRect(x + PAD, y + PAD, BTN - PAD * 2, BTN - PAD * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = cd > 0 ? '#5a4020' : '#e0d0b0';
    ctx.font = `bold ${Math.round(BTN * 0.42)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((abilityId || '?').charAt(0).toUpperCase(), cx, cy + 1);
    ctx.textBaseline = 'alphabetic';
  }

  // Border — glows when ready
  ctx.strokeStyle = cd > 0 ? '#3a2818' : imgCol;
  ctx.lineWidth   = cd > 0 ? 1 : 1.5;
  ctx.strokeRect(x, y, BTN, BTN);

  // Cooldown pie overlay
  if (cd > 0) {
    const r   = BTN / 2 - 2;
    const pct = cd / maxCd;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * pct);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Remaining seconds
    ctx.save();
    ctx.fillStyle = '#d0c080';
    ctx.font = `bold 8px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(cd) + 's', cx, cy + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // Durability pips — top-right corner, for active skills only
  if (wavesLeft !== null) {
    const pipCol = wavesLeft >= 3 ? '#80c040' : wavesLeft === 2 ? '#c0a040' : '#c04020';
    for (let p = 0; p < wavesLeft; p++) {
      ctx.fillStyle = pipCol;
      ctx.beginPath();
      ctx.arc(x + BTN - 4 - p * 5, y + 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawKeyLabel(ctx, x, y, key, cd <= 0);
}

function _drawKeyLabel(ctx, bx, by, key, ready) {
  const lw = 13, lh = 10;
  ctx.fillStyle = ready ? 'rgba(50,35,15,0.95)' : 'rgba(16,10,4,0.95)';
  ctx.fillRect(bx + 1, by + BTN - lh - 1, lw, lh);
  ctx.fillStyle = ready ? '#c5a572' : '#4a3020';
  ctx.font = 'bold 7px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(key, bx + 1 + lw / 2, by + BTN - lh / 2 - 1);
  ctx.textBaseline = 'alphabetic';
}

function _drawTooltip(ctx, data, W, panelY) {
  const { x, y, name, description, cd, maxCd, wavesLeft } = data;
  const PAD  = 8;
  const TW   = 200;
  const LH   = 13;

  ctx.font = '9px "Courier New", monospace';
  const descLines = description ? _wrapText(ctx, description, TW - PAD * 2) : [];

  // Count lines: name + desc + status + maybe pips
  const statusLine = cd > 0 ? `CD: ${Math.ceil(cd)}s  (max ${Math.round(maxCd)}s)` : 'READY';
  const allLines = [
    { text: name,       bold: true,  color: '#e8d8b0' },
    ...descLines.map(t => ({ text: t, bold: false, color: '#9a8060' })),
    { text: statusLine, bold: cd <= 0, color: cd > 0 ? '#c5a572' : '#80c040' },
  ];
  if (wavesLeft !== null) {
    const pipCol = wavesLeft >= 3 ? '#80c040' : wavesLeft === 2 ? '#c0a040' : '#c04020';
    allLines.push({ text: `Durability: ${wavesLeft} wave${wavesLeft !== 1 ? 's' : ''} left`, bold: false, color: pipCol });
  }

  const TH = allLines.length * LH + PAD * 2;
  let tx = x + BTN / 2 - TW / 2;
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
