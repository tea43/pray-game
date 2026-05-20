import { G } from '../globals.js';
import { rand } from '../utils/math.js';
import { state } from '../state.js';
import { getHighScore } from '../systems/score.js';
import { GameData } from '../systems/upgrades.js';
import { ABILITY_DEFS, HERO_ABILITY_TREES } from '../config/abilities.js';
import { HERO_DEFS } from '../config/heroes.js';
import { WEAPON_DEFS } from '../config/weapons.js';
import { drawWeaponSprite } from './weaponSprites.js';

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
const KEY_H       = 18;   // key-label strip at bottom of each button
const BUFF_ROW_H  = 16;   // active-buff indicator row between header and buttons
const WEAPON_ROW_H = 22;  // weapon slot strip: 3 icons + level pips

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

// Draw text with a 1-px dark drop-shadow for legibility on any background.
// Avoids shadowBlur (expensive on Canvas 2D).
function _txt(ctx, text, x, y, color, font) {
  if (font) ctx.font = font;
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

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

    ctx.textAlign = 'left';
    _txt(ctx, u.name.toUpperCase(), x + 27, y + 13,
         u.dead ? '#c06050' : '#f0e4c0', 'bold 13px Georgia, serif');

    if (u.dead) {
      _txt(ctx, 'DEAD', x + 27, y + HEADER_H + 9, '#e04030', 'bold 12px Georgia, serif');
      // Crosshatch over buff row + button area to make it visually non-interactive
      const btnY = y + HEADER_H + 2;
      const BH   = PANEL_H - HEADER_H - 4;
      ctx.fillStyle = 'rgba(40, 8, 5, 0.75)';
      ctx.fillRect(x, btnY, SLOT_W, BH);
      ctx.strokeStyle = 'rgba(120, 30, 20, 0.45)';
      ctx.lineWidth = 1;
      for (let xi = 0; xi < SLOT_W; xi += 8) {
        ctx.beginPath();
        ctx.moveTo(x + xi, btnY);
        ctx.lineTo(x + xi - BH, btnY + BH);
        ctx.stroke();
      }
      continue;
    }

    ctx.textAlign = 'right';
    _txt(ctx, `${Math.ceil(u.hp)}/${u.maxHp}`, x + SLOT_W - 5, y + 13,
         '#c0a060', '10px Georgia, serif');
    ctx.textAlign = 'left';

    const barL = x + 27, barW = SLOT_W - 27 - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barL, y + 16, barW, 5);
    const hpPct = u.hp / u.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#7aa853' : hpPct > 0.25 ? '#c5a247' : '#a83a2a';
    ctx.fillRect(barL, y + 16, barW * hpPct, 5);

    // ── Superboost charge bar ─────────────────────────────────────────────────
    const charge = u.superboostCharge || 0;
    const chargeReady = charge >= 1;
    const chargePulse = chargeReady ? 0.7 + 0.3 * Math.sin(state.time * 6) : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barL, y + 22, barW, 3);
    if (charge > 0) {
      ctx.fillStyle = chargeReady ? `rgba(255, 210, 50, ${chargePulse})` : 'rgba(100, 170, 255, 0.85)';
      ctx.fillRect(barL, y + 22, barW * charge, 3);
    }
    if (chargeReady) {
      ctx.fillStyle = `rgba(255, 220, 60, ${chargePulse * 0.5})`;
      ctx.fillRect(barL, y + 22, barW, 3);
    }

    // ── Active buff indicators ────────────────────────────────────────────────
    const buffY = y + HEADER_H + 1;
    _drawBuffRow(ctx, u, x, buffY, panelY);

    // ── Weapon slot strip ─────────────────────────────────────────────────────
    const weaponY = y + HEADER_H + BUFF_ROW_H + 1;
    _drawWeaponSlots(ctx, u, x, weaponY, panelY);

    // ── Ability buttons ───────────────────────────────────────────────────────
    const btnY = y + HEADER_H + BUFF_ROW_H + WEAPON_ROW_H + 2;
    const BH   = PANEL_H - HEADER_H - BUFF_ROW_H - WEAPON_ROW_H - 4;
    _drawAbilityButtons(ctx, u, x, btnY, BH, panelY);
  }

  if (_tooltip) _drawTooltip(ctx, _tooltip, W, panelY);
}

function _weaponDesc(wDef) {
  if (!wDef) return 'Temporary weapon active.';
  const t = wDef.type;
  if (t === 'ranged') return `Ranged: ${wDef.bulletCount > 1 ? wDef.bulletCount + ' shots per burst, ' : ''}${wDef.atkRange}px range, ${wDef.atkDmg} dmg/shot.`;
  if (t === 'melee' && wDef.cleave) return `Cleave: ±${wDef.cleaveArc}° arc, ${wDef.atkRange}px range, ${wDef.atkDmg} dmg.`;
  if (t === 'thrown') return `Thrown: ${wDef.returns ? 'returns after throw, ' : ''}${wDef.atkRange}px range, ${wDef.atkDmg} dmg.`;
  return `Melee: ${wDef.atkRange}px range, ${wDef.atkDmg} damage${wDef.dual ? ', dual swing' : ''}.`;
}

function _drawBuffRow(ctx, unit, sx, rowY, panelY) {
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(sx, rowY, SLOT_W, BUFF_ROW_H);

  const buffs = [];
  if (unit.weaponTimer > 0) {
    const wDef = WEAPON_DEFS[unit.weaponSlots?.[0]?.key];
    const maxT = wDef?.lootDuration || 15;
    buffs.push({ label: wDef?.displayName?.slice(0,4).toUpperCase() || 'WPN', time: unit.weaponTimer, maxTime: maxT, color: '#ffa040',
      name: wDef?.displayName || 'Weapon', desc: _weaponDesc(wDef) });
  }
  if (unit.rageTimer > 0) {
    buffs.push({ label: 'RAGE', time: unit.rageTimer, maxTime: 5, color: '#ff4020',
      name: 'Rage', desc: 'Double attack damage, 2.5× faster attack speed, and 1.75× knockback.' });
  }
  if (unit.medkitHealRemaining > 0) {
    const isRare = unit.medkitHealRemaining > 80;
    buffs.push({ label: isRare ? 'HEAL+' : 'HEAL', time: unit.medkitHealRemaining,
      maxTime: unit.medkitHealPerSec > 0 ? (unit.medkitHealRemaining / unit.medkitHealPerSec) : 4,
      color: '#40b0ff', isHeal: true,
      name: isRare ? 'Rare Medkit' : 'Medkit',
      desc: isRare ? 'Enhanced healing over time (1.8× normal rate).' : 'Healing over time from medkit.' });
  }
  if (unit.blockadeTimer > 0) {
    buffs.push({ label: 'SHLD', time: unit.blockadeTimer, maxTime: 6, color: '#50c0ff',
      name: 'Backdoor Shield', desc: 'Habib\'s blockade: 50% damage reduction from all sources.' });
  }
  if (unit.alchemyArmorTimer > 0) {
    buffs.push({ label: 'ARMR', time: unit.alchemyArmorTimer, maxTime: 5, color: '#60ff80',
      name: 'Alchemy Armor', desc: 'Green Pipe potion: 40% reduction to incoming damage.' });
  }
  if (unit.speedBoostTimer > 0) {
    buffs.push({ label: 'SPDD', time: unit.speedBoostTimer, maxTime: 6, color: '#80d0ff',
      name: 'Speed Boost', desc: 'Movement speed increased by 80%.' });
  }
  if (unit.stonedTimer > 0) {
    buffs.push({ label: 'STND', time: unit.stonedTimer, maxTime: 4, color: '#a0ff60',
      name: 'Stoned', desc: 'Invincible but immovable. Nearby enemies are drawn toward this hero.' });
  }
  if (unit.flamethrowerTimer > 0) {
    buffs.push({ label: 'FIRE', time: unit.flamethrowerTimer, maxTime: 6, color: '#ff8040',
      name: 'Flamethrower', desc: 'Cone of fire active — burns enemies in front.' });
  }
  if (unit.acidGunTimer > 0) {
    buffs.push({ label: 'ACID', time: unit.acidGunTimer, maxTime: 5, color: '#80ff40',
      name: 'Acid Gun', desc: 'Sustained acid projectile fire active.' });
  }

  if (buffs.length === 0) {
    ctx.strokeStyle = 'rgba(40,25,10,0.5)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, rowY + BUFF_ROW_H - 0.5);
    ctx.lineTo(sx + SLOT_W, rowY + BUFF_ROW_H - 0.5);
    ctx.stroke();
    return;
  }

  const PILL_W = 56, PILL_GAP = 3, PILL_H = BUFF_ROW_H - 3;
  let bx = sx + 2;
  const cy = rowY + BUFF_ROW_H / 2;
  const mx = state.mouse?.x ?? -1, my = state.mouse?.y ?? -1;

  for (const buff of buffs) {
    if (bx + PILL_W > sx + SLOT_W - 2) break;
    const pct = Math.max(0, Math.min(1, buff.time / buff.maxTime));
    // Pill background
    ctx.fillStyle = 'rgba(10,6,3,0.85)';
    ctx.fillRect(bx, rowY + 1, PILL_W, PILL_H);
    // Timer bar fill
    ctx.fillStyle = buff.color;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(bx, rowY + 1, PILL_W * pct, PILL_H);
    ctx.globalAlpha = 1;
    // Border
    ctx.strokeStyle = buff.color;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(bx, rowY + 1, PILL_W, PILL_H);
    // Label
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    _txt(ctx, buff.label, bx + 3, cy, buff.color, 'bold 9px Georgia, serif');
    // Time value
    const timeStr = buff.isHeal ? Math.ceil(buff.time) + 'hp' : Math.ceil(buff.time) + 's';
    ctx.textAlign = 'right';
    _txt(ctx, timeStr, bx + PILL_W - 2, cy, '#e0d090', '9px Georgia, serif');
    ctx.textBaseline = 'alphabetic';

    // Hover → tooltip
    if (mx >= bx && mx <= bx + PILL_W && my >= rowY + 1 && my <= rowY + 1 + PILL_H) {
      _tooltip = {
        x: bx, y: rowY + 1, bh: PILL_H,
        name: buff.name,
        description: buff.desc,
        isBuff: true,
        buffTimeStr: buff.isHeal ? Math.ceil(buff.time) + ' HP remaining' : Math.ceil(buff.time) + 's remaining',
        buffColor: buff.color,
        panelY,
      };
    }

    bx += PILL_W + PILL_GAP;
  }
}

function _weaponSlotDesc(wDef, slot) {
  if (!wDef) return 'No weapon data.';
  const stats = wDef.levels?.[slot.level - 1] || {};
  const dmg   = stats.atkDmg   ?? wDef.atkDmg   ?? '?';
  const rate  = stats.atkRate  ?? wDef.atkRate   ?? '?';
  const range = stats.atkRange ?? wDef.atkRange  ?? '?';
  const t = wDef.type;
  if (t === 'ranged') {
    const bc = stats.bulletCount ?? wDef.bulletCount ?? 1;
    return `Ranged — ${bc > 1 ? bc + ' shots, ' : ''}${range}px range, ${dmg} dmg/shot, ${rate}s cooldown`;
  }
  if (t === 'thrown') return `Thrown — ${range}px range, ${dmg} dmg${wDef.returns ? ', returns' : ''}, ${rate}s cooldown`;
  if (wDef.cleave) return `Cleave — ±${wDef.cleaveArc}° arc, ${range}px range, ${dmg} dmg, ${rate}s cooldown`;
  if (wDef.dual)   return `Dual melee — ${range}px range, ${dmg} dmg, ${rate}s cooldown`;
  return `Melee — ${range}px range, ${dmg} dmg, ${rate}s cooldown`;
}

function _drawWeaponSlots(ctx, unit, sx, rowY, panelY) {
  const CELL = 16, GAP = 4;
  const totalW = 3 * CELL + 2 * GAP;
  let bx = sx + (SLOT_W - totalW) / 2;
  const mx = state.mouse?.x ?? -1, my = state.mouse?.y ?? -1;

  for (let i = 0; i < 3; i++) {
    const slot = unit.weaponSlots?.[i];
    const cx = bx + i * (CELL + GAP);

    if (!slot) {
      ctx.fillStyle = 'rgba(30, 20, 10, 0.6)';
      ctx.fillRect(cx, rowY, CELL, CELL);
      ctx.strokeStyle = 'rgba(80, 55, 25, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(cx, rowY, CELL, CELL);
      ctx.fillStyle = 'rgba(80, 60, 30, 0.55)';
      ctx.font = '10px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+', cx + CELL / 2, rowY + CELL - 4);
      ctx.textAlign = 'left';
    } else {
      const wDef = WEAPON_DEFS[slot.key];
      const typeColor = wDef?.type === 'ranged' ? 'rgba(255,154,48,0.25)' :
                        wDef?.type === 'thrown'  ? 'rgba(100,200,255,0.22)' :
                                                   'rgba(200,180,100,0.22)';
      // Highlight slot on hover
      const hovered = mx >= cx && mx <= cx + CELL && my >= rowY && my <= rowY + CELL + 6;
      ctx.fillStyle = hovered ? (wDef?.type === 'ranged' ? 'rgba(255,154,48,0.45)' :
                                  wDef?.type === 'thrown'  ? 'rgba(100,200,255,0.40)' :
                                                             'rgba(200,180,100,0.40)') : typeColor;
      ctx.fillRect(cx, rowY, CELL, CELL);
      ctx.strokeStyle = hovered ? '#ffcc60' : slot.level >= 5 ? '#ffaa18' : 'rgba(160,130,60,0.7)';
      ctx.lineWidth = hovered ? 1.5 : slot.level >= 5 ? 1.5 : 0.8;
      ctx.strokeRect(cx, rowY, CELL, CELL);

      drawWeaponSprite(ctx, slot.key, cx + CELL / 2, rowY + CELL / 2, 0.9, Math.PI / 4);

      const pipR = 1.8;
      const pipGap = 5;
      const pipStartX = cx + (CELL - (5 * pipGap - 1)) / 2;
      for (let p = 0; p < 5; p++) {
        ctx.beginPath();
        ctx.arc(pipStartX + p * pipGap, rowY + CELL + pipR + 1, pipR, 0, Math.PI * 2);
        ctx.fillStyle = p < slot.level ? '#d8a040' : 'rgba(80, 60, 25, 0.6)';
        ctx.fill();
      }

      // Populate tooltip on hover
      if (hovered && wDef) {
        const levelStr = `Lv ${slot.level}/5`;
        _tooltip = {
          x: cx, y: rowY, bh: CELL + 6,
          name: `${wDef.displayName || slot.key} — ${levelStr}`,
          description: _weaponSlotDesc(wDef, slot),
          cd: 0, maxCd: 1, wavesLeft: null,
          isEmpty: false, isPassive: false,
          panelY,
        };
      }
    }
  }
}

function _drawAbilityButtons(ctx, unit, sx, btnY, BH, panelY) {
  const keys    = HERO_KEYS[unit.type] || ['?', '?', '?'];
  const treeDefs = HERO_ABILITY_TREES[unit.type] || [];
  const bxs     = [
    sx + B_LEFT,
    sx + B_LEFT + BW + BG,
    sx + B_LEFT + (BW + BG) * 2,
  ];

  // Tree 1 — main ability, resolved by current level
  const tree1     = treeDefs.find(t => t.treeNum === 1);
  const level1    = unit.abilityTrees?.[1] ?? 1;
  const mainId    = tree1?.levelAbilityIds?.[level1 - 1] ?? unit.abilityId;
  const mainDef   = ABILITY_DEFS[mainId] ?? {};
  const mainName  = tree1?.levelNames?.[level1 - 1] ?? unit.abilityName;
  const mainDesc  = tree1?.levelDescs?.[level1 - 1] ?? unit.abilityDescription;

  _processBtn(ctx, {
    x: bxs[0], y: btnY, bh: BH,
    key:         keys[0],
    abilityId:   mainId,
    cd:          unit.abilityCd,
    maxCd:       unit.abilityMaxCd,
    color:       mainDef.color ?? unit.abilityColor,
    name:        mainName,
    description: mainDesc,
    wavesLeft:   null,
    isEmpty:     false,
  }, panelY);

  // Trees 2 & 3 — secondary abilities (locked until leveled)
  for (let si = 0; si < 2; si++) {
    const treeNum  = si + 2;
    const treeDef  = treeDefs.find(t => t.treeNum === treeNum);
    const level    = unit.abilityTrees?.[treeNum] ?? 0;
    const secId    = level > 0 ? (treeDef?.levelAbilityIds?.[level - 1] ?? '') : '';
    const secDef   = secId ? (ABILITY_DEFS[secId] ?? null) : null;
    const secName  = level > 0 ? (treeDef?.levelNames?.[level - 1] ?? '') : '';
    const secDesc  = level > 0 ? (treeDef?.levelDescs?.[level - 1] ?? '') : '';
    _processBtn(ctx, {
      x: bxs[si + 1], y: btnY, bh: BH,
      key:         keys[si + 1],
      abilityId:   secId,
      cd:          unit.treeCd?.[treeNum] ?? 0,
      maxCd:       secDef?.maxCd ?? 1,
      color:       secDef?.color ?? '#6a5030',
      name:        secName,
      description: secDesc,
      wavesLeft:   null,
      isEmpty:     level === 0,
      isPassive:   false,
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
  const { x, y, bh, key, abilityId, cd, maxCd, color, isEmpty, wavesLeft, isPassive } = btn;
  const icnH = bh - KEY_H;       // icon area height (above key strip)
  const icx  = x + BW / 2;
  const icy  = y + icnH / 2;

  // Background
  ctx.fillStyle = isEmpty ? 'rgba(12,8,4,0.75)' : isPassive ? 'rgba(18,12,5,0.92)' : 'rgba(22,15,8,0.95)';
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
  const iconCfg = ABILITY_DEFS[abilityId];
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    _txt(ctx, (abilityId || '?').charAt(0).toUpperCase(), icx, icy,
         cd > 0 ? '#7a6030' : '#f0e0c0',
         `bold ${Math.round(BW * 0.55)}px Georgia, serif`);
    ctx.textBaseline = 'alphabetic';
  }

  // Border
  ctx.strokeStyle = isPassive ? '#5a4520' : cd > 0 ? '#3a2818' : imgCol;
  ctx.lineWidth   = isPassive ? 1 : cd > 0 ? 1 : 1.5;
  ctx.strokeRect(x, y, BW, bh);

  // Passive badge overlay
  if (isPassive) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(x, y, BW, icnH);
    ctx.fillStyle = '#8a6a2a';
    ctx.font = 'bold 7px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('PASSIVE', icx, y + icnH - 2);
    ctx.textBaseline = 'alphabetic';
    _drawKeyStrip(ctx, x, y, bh, '●', false);
    return;
  }

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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    _txt(ctx, Math.ceil(cd) + 's', icx, icy + 1, '#f0e060', 'bold 12px Georgia, serif');
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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  _txt(ctx, key, bx + BW / 2, sy + KEY_H / 2,
       ready ? '#ffe080' : '#7a5535', 'bold 13px Georgia, serif');
  ctx.textBaseline = 'alphabetic';
}


function _drawTooltip(ctx, data, W, panelY) {
  const { x, y, name, description, cd, maxCd, wavesLeft, isPassive, isBuff, buffTimeStr, buffColor } = data;
  const PAD = 9, TW = 230, LH = 16;

  ctx.font = '12px Georgia, serif';
  const descLines = description ? _wrapText(ctx, description, TW - PAD * 2) : [];
  const statusLine = isBuff     ? (buffTimeStr || '')
                   : isPassive  ? 'PASSIVE — always active'
                   : cd > 0     ? `CD: ${Math.ceil(cd)}s / ${Math.round(maxCd)}s`
                   : 'READY';
  const statusColor = isBuff    ? (buffColor || '#80c0ff')
                    : isPassive ? '#c5a030'
                    : cd > 0    ? '#c5a572'
                    : '#80c040';
  const allLines = [
    { text: name, bold: true, color: '#f4ecd4' },
    ...descLines.map(t => ({ text: t, bold: false, color: '#c0a870' })),
    { text: statusLine, bold: !isBuff && (isPassive || cd <= 0), color: statusColor },
  ];
  if (!isBuff && !isPassive && wavesLeft !== null) {
    const col = wavesLeft >= 3 ? '#80c040' : wavesLeft === 2 ? '#c0a040' : '#c04020';
    allLines.push({ text: `${wavesLeft} wave${wavesLeft !== 1 ? 's' : ''} remaining`, bold: false, color: col });
  }

  const TH = allLines.length * LH + PAD * 2;
  let tx = x + BW / 2 - TW / 2;
  let ty = y - TH - 6;
  tx = Math.max(4, Math.min(W - TW - 4, tx));
  ty = Math.max(4, ty);

  ctx.fillStyle = 'rgba(4, 2, 1, 0.97)';
  ctx.fillRect(tx, ty, TW, TH);
  ctx.strokeStyle = '#6a4820';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tx, ty, TW, TH);

  let ly = ty + PAD + 12;
  for (const line of allLines) {
    ctx.font = (line.bold ? 'bold 13px' : '12px') + ' Georgia, serif';
    ctx.textAlign = 'left';
    _txt(ctx, line.text, tx + PAD, ly, line.color);
    ly += LH;
  }
}

function _wrapText(ctx, text, maxW, font) {
  if (font) ctx.font = font;
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
