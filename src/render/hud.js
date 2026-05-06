import { G } from '../globals.js';
import { rand } from '../utils/math.js';
import { state } from '../state.js';
import { getHighScore } from '../systems/score.js';
import { GameData } from '../systems/upgrades.js';

// Hotkey labels per hero per slot
const ACTIVE_KEY_LABELS = {
  dick:   ['1', 'a'],
  habib:  ['2', 's'],
  eliott: ['3', 'd'],
};

export function drawAbilityPanel() {
  const { ctx, W, H, PANEL_H } = G;
  const slotW = 150, slotH = PANEL_H, gap = 12;
  const slots = state.units;
  const totalW = slots.length * slotW + (slots.length - 1) * gap;
  const startX = (W - totalW) / 2;
  const y = H - slotH - 12;

  ctx.fillStyle = 'rgba(10, 6, 3, 0.6)';
  ctx.fillRect(0, y - 4, W, slotH + 10);
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y - 4); ctx.lineTo(W, y - 4);
  ctx.stroke();

  for (let i = 0; i < slots.length; i++) {
    const u = slots[i];
    const x = startX + i * (slotW + gap);

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
    const pxc = x + 16, pyc = y + 20;
    ctx.save();
    ctx.translate(pxc, pyc);
    ctx.scale(0.65, 0.65);
    const savedSelected = u.selected;
    u.selected = false;
    if (u.type === 'eliott') u._drawEliott(ctx, 0);
    else if (u.type === 'dick') u._drawDick(ctx, 0);
    else if (u.type === 'habib') u._drawHabib(ctx, 0);
    u.selected = savedSelected;
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

    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#8a6b3a';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(u.hp)}/${u.maxHp}`, x + slotW - 8, y + 16);
    ctx.textAlign = 'left';

    const barLeft = x + 34;
    const barW = slotW - 34 - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barLeft, y + 22, barW, 5);
    const hpPct = u.hp / u.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#7aa853' : hpPct > 0.25 ? '#c5a247' : '#a83a2a';
    ctx.fillRect(barLeft, y + 22, barW * hpPct, 5);

    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = u.abilityCd > 0 ? '#6a5030' : u.abilityColor;
    ctx.fillText(`[${u.abilityKey}] ${u.abilityName}`, x + 8, y + 44);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x + 8, y + 49, slotW - 16, 5);
    if (u.abilityCd > 0) {
      const cdPct = 1 - (u.abilityCd / u.abilityMaxCd);
      ctx.fillStyle = '#5a3a70';
      ctx.fillRect(x + 8, y + 49, (slotW - 16) * cdPct, 5);
      ctx.fillStyle = '#c5a572';
      ctx.font = '9px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${u.abilityCd.toFixed(1)}s`, x + slotW - 8, y + 60);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = u.abilityColor;
      ctx.fillRect(x + 8, y + 49, slotW - 16, 5);
      ctx.fillStyle = u.abilityColor;
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('READY', x + slotW - 8, y + 60);
      ctx.textAlign = 'left';
    }

    // Active skill slots
    _drawActiveSlots(ctx, u, x, y + 63, slotW);
  }
}

function _drawActiveSlots(ctx, unit, x, topY, slotW) {
  const keyLabels = ACTIVE_KEY_LABELS[unit.type] || ['?', '?'];
  const pool = GameData.upgrades[unit.type] || [];

  for (let si = 0; si < 2; si++) {
    const slot = unit.activeSkillSlots[si];
    const rowY = topY + si * 14;
    const key = keyLabels[si];

    // Key label box
    ctx.fillStyle = slot ? 'rgba(40,30,15,0.9)' : 'rgba(20,15,8,0.7)';
    ctx.fillRect(x + 8, rowY, 12, 11);
    ctx.strokeStyle = slot ? '#6a4820' : '#3a2a18';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x + 8, rowY, 12, 11);
    ctx.font = 'bold 8px "Courier New", monospace';
    ctx.fillStyle = slot ? '#c5a572' : '#4a3520';
    ctx.textAlign = 'center';
    ctx.fillText(key, x + 14, rowY + 9);
    ctx.textAlign = 'left';

    if (!slot) {
      ctx.fillStyle = '#3a2a18';
      ctx.font = '8px "Courier New", monospace';
      ctx.fillText('empty', x + 24, rowY + 9);
      continue;
    }

    // Skill name (abbreviated)
    const upgDef = pool.find(u => u.id === slot.id);
    const name = upgDef ? upgDef.name.substring(0, 14) : slot.id.substring(0, 14);
    ctx.fillStyle = slot.cd > 0 ? '#5a4020' : '#c5a572';
    ctx.font = '8px "Courier New", monospace';
    ctx.fillText(name, x + 24, rowY + 9);

    // Cooldown mini-bar
    const barX = x + slotW - 36;
    const barW = 26;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, rowY + 1, barW, 9);
    if (slot.cd > 0) {
      const pct = 1 - slot.cd / slot.maxCd;
      ctx.fillStyle = '#5a3a70';
      ctx.fillRect(barX, rowY + 1, barW * pct, 9);
      ctx.fillStyle = '#8a68a0';
      ctx.font = '7px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${slot.cd.toFixed(0)}s`, barX + barW / 2, rowY + 9);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#c5a040';
      ctx.fillRect(barX, rowY + 1, barW, 9);
      ctx.fillStyle = '#201808';
      ctx.font = 'bold 7px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RDY', barX + barW / 2, rowY + 9);
      ctx.textAlign = 'left';
    }

    // Durability pips
    for (let p = 0; p < slot.wavesLeft; p++) {
      ctx.fillStyle = p < slot.wavesLeft ? '#80c040' : '#2a1a08';
      ctx.beginPath();
      ctx.arc(x + slotW - 7 - p * 5, rowY + 5.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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

  const bar = document.getElementById('timeBar');
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
